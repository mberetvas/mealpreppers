//! Consolidates ingredients from a saved weekplan into a shopping list.
//!
//! Orchestrates exact-merge and optional OpenRouter AI polish via
//! [`ShoppingListPolishPort`]. Algorithm modules (`exact_merge`, `openrouter`) are
//! called from the port infrastructure, not directly here.

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
        exact_merge::{build_consolidation_context, build_source_baseline, exact_merge},
        internal::{ShoppingListIngredient, ShoppingListSection},
        models::{
            coerce_aisle_category, ConsolidationResult, MergedLine, PolishResponse,
            PolishResponseChange, PolishStatus,
        },
        ports::{ShoppingListPolishPort, WeekplanForConsolidationReader},
    },
};

/// Mirrors `consolidationService.ts` — shown when AI polish is unavailable.
const AI_REQUIRED_WARNING: &str = "AI polish skipped — a supermarket aisle-grouped list requires successful AI consolidation. Configure OpenRouter or retry.";

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

fn attach_provenance_to_lines(
    response: &PolishResponse,
    source_baseline: &[MergedLine],
) -> Vec<MergedLine> {
    let source_by_id: HashMap<&str, &MergedLine> = source_baseline
        .iter()
        .map(|line| (line.id.as_str(), line))
        .collect();

    response
        .lines
        .iter()
        .map(|line| {
            let mut source_ids = vec![line.id.as_str()];
            if let Some(change) = response.changes.as_ref().and_then(|changes| {
                changes.iter().find(|c| c.id == line.id)
            }) {
                if let Some(absorbed) = &change.absorbed_ids {
                    for id in absorbed {
                        source_ids.push(id.as_str());
                    }
                }
            }

            let mut provenance = Vec::new();
            let mut seen_recipe_ids = std::collections::HashSet::new();
            for source_id in source_ids {
                let Some(source_line) = source_by_id.get(source_id) else {
                    continue;
                };
                for entry in &source_line.provenance {
                    if seen_recipe_ids.insert(entry.recipe_id.clone()) {
                        provenance.push(entry.clone());
                    }
                }
            }

            MergedLine {
                id: line.id.clone(),
                name: line.name.clone(),
                quantity: line.quantity,
                unit: line.unit.clone(),
                provenance,
                aisle_category: Some(coerce_aisle_category(&line.aisle_category).to_string()),
            }
        })
        .collect()
}

/// Runs the full consolidation pipeline for a saved weekplan.
pub async fn execute(
    weekplan_reader: Arc<dyn WeekplanForConsolidationReader>,
    recipes: Arc<dyn RecipeRepository>,
    polish: Arc<dyn ShoppingListPolishPort>,
    plan_id: &str,
    user_id: &str,
) -> Result<ConsolidationResult, AppError> {
    let plan_id_owned = plan_id.to_string();
    let user_id_owned = user_id.to_string();

    log::info!("shopping_list.consolidate_start plan_id={plan_id}");

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
        log::info!("shopping_list.empty_plan plan_id={plan_id}");
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

    let fallback_baseline = exact_merge(&sections);
    let mut baseline_lines: Vec<MergedLine> = fallback_baseline.lines.clone();

    let polish_configured = polish.is_configured();
    let (consolidated_lines, changes, polish_status) = if !polish_configured {
        log::info!("shopping_list.polish_skipped plan_id={plan_id} reason=missing_api_key");
        warnings.push(AI_REQUIRED_WARNING.to_string());
        (vec![], vec![], PolishStatus::AiSkipped)
    } else {
        let context = build_consolidation_context(&sections);
        let source_baseline = build_source_baseline(&context);
        let polish_port = polish.clone();
        let polish_result = spawn_blocking(move || polish_port.polish(&context))
            .await
            .map_err(|e| AppError::internal(format!("spawn error: {e}")))?;

        match polish_result {
            Ok(polish) => {
                let consolidated_lines =
                    attach_provenance_to_lines(&polish.response, &source_baseline.lines);
                let changes: Vec<PolishResponseChange> = polish.response.changes.unwrap_or_default();
                baseline_lines = source_baseline.lines;
                log::info!(
                    "shopping_list.polish_pending_review plan_id={plan_id} consolidated_line_count={}",
                    consolidated_lines.len()
                );
                (
                    consolidated_lines,
                    changes,
                    PolishStatus::PendingReview,
                )
            }
            Err(e) => {
                log::warn!("shopping_list.polish_failed plan_id={plan_id} polish_status=baseline_fallback error={e}");
                warnings.push(format!("AI polish failed. {AI_REQUIRED_WARNING}"));
                (vec![], vec![], PolishStatus::BaselineFallback)
            }
        }
    };

    log::info!(
        "shopping_list.consolidate_complete plan_id={plan_id} baseline_line_count={} consolidated_line_count={} polish_status={}",
        baseline_lines.len(),
        consolidated_lines.len(),
        polish_status.as_str()
    );

    Ok(ConsolidationResult {
        consolidated_lines,
        baseline_lines,
        changes,
        polish_status,
        warnings,
        source_fingerprint: Some(source_fingerprint),
    })
}
