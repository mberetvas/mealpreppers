//! Consolidates ingredients from a saved weekplan into a shopping list.
//!
//! Orchestrates exact-merge and optional OpenRouter AI polish. Algorithm modules
//! (`exact_merge`, `openrouter`) are called unchanged.

use std::{collections::HashMap, sync::Arc};

use indexmap::IndexMap;
use tokio::task::spawn_blocking;

use crate::shadow_server::{
    error::AppError,
    planning::models::WeekPlanV1,
    recipe_catalog::{
        models::RecipeCatalogItem,
        ports::RecipeRepository,
    },
    shopping_list::{
        exact_merge::{build_consolidation_context, exact_merge},
        internal::{ShoppingListIngredient, ShoppingListSection},
        models::{coerce_aisle_category, ConsolidationResult, MergedLine, PolishResponseChange, PolishStatus},
        openrouter::call_openrouter_polish,
        ports::WeekplanForConsolidationReader,
    },
};

fn collect_recipe_occurrences(body: &WeekPlanV1) -> IndexMap<String, u32> {
    let mut map: IndexMap<String, u32> = IndexMap::new();
    for day in ["1", "2", "3", "4", "5", "6", "7"] {
        let Some(d) = body.days.get(day) else {
            continue;
        };
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

fn build_shopping_sections(
    occurrences: &IndexMap<String, u32>,
    recipes_by_id: &HashMap<String, RecipeCatalogItem>,
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

/// Runs the full consolidation pipeline for a saved weekplan.
pub async fn execute(
    weekplan_reader: Arc<dyn WeekplanForConsolidationReader>,
    recipes: Arc<dyn RecipeRepository>,
    plan_id: &str,
    user_id: &str,
    openrouter_key: Option<String>,
) -> Result<ConsolidationResult, AppError> {
    let plan_id_owned = plan_id.to_string();
    let user_id_owned = user_id.to_string();

    let weekplan_reader_clone = weekplan_reader.clone();
    let (body, source_fingerprint) = spawn_blocking(move || {
        let weekplan = weekplan_reader_clone
            .get_for_consolidation(&plan_id_owned, &user_id_owned)
            .map_err(AppError::from_planning_repo)?;
        Ok((weekplan.body, weekplan.source_fingerprint))
    })
    .await
    .map_err(|e| AppError::internal(format!("spawn error: {e}")))??;

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

    let recipes_clone = recipes.clone();
    let recipes_all = spawn_blocking(move || {
        recipes_clone
            .list_recipes()
            .map_err(AppError::from_recipe_catalog_repo)
    })
    .await
    .map_err(|e| AppError::internal(format!("spawn error: {e}")))??;

    let recipes_by_id: HashMap<String, _> = recipes_all
        .into_iter()
        .map(|r| (r.id.clone(), r))
        .collect();

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

    let baseline = exact_merge(&sections);
    let baseline_lines: Vec<MergedLine> = baseline.lines.clone();

    let (consolidated_lines, changes, polish_status) = match openrouter_key {
        Some(key) => {
            let context = build_consolidation_context(&sections);
            let key_clone = key.clone();
            let polish_result = spawn_blocking(move || call_openrouter_polish(&key_clone, &context))
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
                            aisle_category: Some(coerce_aisle_category(&pl.aisle_category).to_string()),
                        })
                        .collect();
                    let changes: Vec<PolishResponseChange> = polish.changes.unwrap_or_default();
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
        None => (baseline_lines.clone(), vec![], PolishStatus::AiSkipped),
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
