//! Shopping list consolidation orchestration.
//!
//! Ports the Node.js `consolidationService.ts` — builds per-recipe sections
//! from a `WeekPlanV1`, runs exact-merge, optionally calls OpenRouter AI polish,
//! and returns a `ConsolidationResult`.

use std::collections::HashMap;

use indexmap::IndexMap;
use tokio::task::spawn_blocking;

use crate::shadow_server::{
    error::AppError,
    planning::{
        models::WeekPlanV1,
        repository::{compute_source_fingerprint, get_saved_weekplan_by_id, open_conn},
    },
    recipe_catalog::repository as catalog_repo,
};
use super::{
    exact_merge::{build_consolidation_context, exact_merge},
    internal::{ShoppingListIngredient, ShoppingListSection},
    models::{ConsolidationResult, MergedLine, PolishResponseChange, PolishStatus},
    openrouter::call_openrouter_polish,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Collects recipe IDs from the week plan in insertion order, with occurrence counts.
/// Preserves the order meals appear in the plan (days 1→7, breakfast→lunch→dinner).
fn collect_recipe_occurrences(body: &WeekPlanV1) -> IndexMap<String, u32> {
    let mut map: IndexMap<String, u32> = IndexMap::new();
    for day in ["1", "2", "3", "4", "5", "6", "7"] {
        let Some(d) = body.days.get(day) else { continue };
        for slot in [&d.breakfast, &d.lunch, &d.dinner] {
            if let Some(ref id) = slot.recipe_id {
                if !id.is_empty() {
                    *map.entry(id.clone()).or_insert(0) += 1;
                }
            }
        }
    }
    map
}

/// Builds `ShoppingListSection` entries from the occurrence map and loaded recipes.
fn build_shopping_sections(
    occurrences: &IndexMap<String, u32>,
    recipes_by_id: &HashMap<String, crate::shadow_server::recipe_catalog::models::RecipeCatalogItem>,
) -> (Vec<ShoppingListSection>, Vec<String>) {
    let mut sections = Vec::new();
    let mut warnings = Vec::new();

    for (recipe_id, &occurrence_count) in occurrences {
        let Some(recipe) = recipes_by_id.get(recipe_id) else {
            warnings.push(format!(
                "Recipe {recipe_id} is in the week plan but was not found in the catalog; skipped."
            ));
            continue;
        };

        let ingredients: Vec<ShoppingListIngredient> = recipe
            .ingredients
            .iter()
            .map(|ing| ShoppingListIngredient {
                raw_text: ing.raw_text.clone(),
                name: ing.name.clone(),
                quantity: ing.quantity,
                unit: ing.unit.clone(),
            })
            .collect();

        sections.push(ShoppingListSection {
            recipe_id: recipe_id.clone(),
            recipe_title: recipe.title.clone(),
            occurrence_count,
            ingredients,
        });
    }

    (sections, warnings)
}

// ---------------------------------------------------------------------------
// Main consolidation function
// ---------------------------------------------------------------------------

/// Runs the full consolidation pipeline for a saved weekplan.
///
/// - Loads the weekplan (verifies ownership).
/// - Loads all recipes referenced in the plan.
/// - Builds shopping sections (multiplied by occurrence count).
/// - Exact-merges into baseline lines.
/// - Optionally calls OpenRouter for AI polish when a key is available.
pub async fn consolidate_shopping_list(
    plan_id: String,
    user_id: String,
    db_path: std::path::PathBuf,
    openrouter_key: Option<String>,
) -> Result<ConsolidationResult, AppError> {
    // 1. Load weekplan and all recipes inside a blocking task.
    let plan_id_clone = plan_id.clone();
    let user_id_clone = user_id.clone();
    let db_path_clone = db_path.clone();

    let (body, source_fingerprint) = spawn_blocking(move || {
        let conn = open_conn(&db_path_clone).map_err(|e| {
            AppError::internal(format!("db open: {e:?}"))
        })?;
        let row = get_saved_weekplan_by_id(&conn, &plan_id_clone, &user_id_clone)
            .map_err(|e| match e {
                crate::shadow_server::planning::repository::RepoError::NotFound(m) => {
                    AppError::not_found(&m)
                }
                crate::shadow_server::planning::repository::RepoError::Forbidden(m) => {
                    AppError::forbidden(&m)
                }
                other => AppError::internal(format!("db: {other:?}")),
            })?;
        let fp = compute_source_fingerprint(&row.body);
        Ok::<_, AppError>((row.body, fp))
    })
    .await
    .map_err(|e| AppError::internal(format!("spawn error: {e}")))??;

    // 2. Gather recipe occurrences.
    let occurrences = collect_recipe_occurrences(&body);

    if occurrences.is_empty() {
        return Ok(ConsolidationResult {
            consolidated_lines: vec![],
            baseline_lines: vec![],
            changes: vec![],
            polish_status: PolishStatus::AiSkipped,
            warnings: vec![
                "This week plan has no recipes — nothing to consolidate.".to_string(),
            ],
            source_fingerprint: Some(source_fingerprint),
        });
    }

    // 3. Load all recipes (we load all and index by ID — catalog is small).
    let db_path_clone2 = db_path.clone();
    let recipes_all = spawn_blocking(move || {
        let conn = catalog_repo::open_conn(&db_path_clone2).map_err(|e| {
            AppError::internal(format!("db open: {e:?}"))
        })?;
        catalog_repo::list_recipes(&conn).map_err(|e| {
            AppError::internal(format!("list_recipes: {e:?}"))
        })
    })
    .await
    .map_err(|e| AppError::internal(format!("spawn error: {e}")))??;

    let recipes_by_id: HashMap<String, _> = recipes_all
        .into_iter()
        .map(|r| (r.id.clone(), r))
        .collect();

    // 4. Build sections.
    let (sections, mut warnings) = build_shopping_sections(&occurrences, &recipes_by_id);

    if sections.is_empty() {
        return Ok(ConsolidationResult {
            consolidated_lines: vec![],
            baseline_lines: vec![],
            changes: vec![],
            polish_status: PolishStatus::AiSkipped,
            warnings: {
                warnings.push("No matching recipes found in the catalog.".to_string());
                warnings
            },
            source_fingerprint: Some(source_fingerprint),
        });
    }

    // 5. Exact merge.
    let baseline = exact_merge(&sections);
    let baseline_lines: Vec<MergedLine> = baseline.lines.clone();

    // 6. Optional AI polish.
    let (consolidated_lines, changes, polish_status) = match openrouter_key {
        Some(key) => {
            let context = build_consolidation_context(&sections);
            let key_clone = key.clone();
            let polish_result = spawn_blocking(move || {
                call_openrouter_polish(&key_clone, &context)
            })
            .await
            .map_err(|e| AppError::internal(format!("spawn error: {e}")))?;

            match polish_result {
                Ok(polish) => {
                    let polished_lines: Vec<MergedLine> = polish
                        .lines
                        .into_iter()
                        .map(|pl| MergedLine {
                            id: pl.id.clone(),
                            name: pl.name,
                            quantity: pl.quantity,
                            unit: pl.unit,
                            provenance: baseline_lines
                                .iter()
                                .find(|b| b.id == pl.id)
                                .map(|b| b.provenance.clone())
                                .unwrap_or_default(),
                            aisle_category: Some(super::models::coerce_aisle_category(&pl.aisle_category).to_string()),
                        })
                        .collect();
                    let changes: Vec<PolishResponseChange> =
                        polish.changes.unwrap_or_default();
                    (polished_lines, changes, PolishStatus::Polished)
                }
                Err(e) => {
                    log::warn!("openrouter.polish_error plan_id={plan_id} error={e}");
                    warnings.push(
                        "AI polish failed; returning baseline shopping list.".to_string(),
                    );
                    (baseline_lines.clone(), vec![], PolishStatus::BaselineFallback)
                }
            }
        }
        None => {
            (baseline_lines.clone(), vec![], PolishStatus::AiSkipped)
        }
    };

    Ok(ConsolidationResult {
        consolidated_lines,
        baseline_lines,
        changes,
        polish_status,
        warnings,
        source_fingerprint: Some(source_fingerprint),
    })
}
