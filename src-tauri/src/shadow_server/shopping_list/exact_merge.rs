//! Exact-merge algorithm for shopping list consolidation.
//!
//! Ports `exactMerge.ts` and `buildConsolidationContext` from the Node.js service.
//!
//! The algorithm:
//! 1. Group lines by `normalised_name::normalised_unit` key.
//! 2. Sum quantities for each group.
//! 3. Assign stable IDs (L1, L2, …) in insertion order.
//! 4. Each merged line carries provenance (which recipe(s) contributed it).

use indexmap::IndexMap;

use super::models::{ConsolidationContext, ConsolidationContextIngredient, ConsolidationContextSection, MergedLine, RecipeProvenance};
use super::internal::{PolishBaseline, ShoppingListSection};

// ---------------------------------------------------------------------------
// Unit normalisation
// ---------------------------------------------------------------------------

/// Normalises a shopping-list unit string for grouping — lowercase, strip spaces.
/// `None` for "no unit" items (e.g. "1 onion").
pub fn normalise_unit(unit: Option<&str>) -> Option<String> {
    let u = unit
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())?;

    // Common Dutch/English alias table.
    let canonical = match u.as_str() {
        "gram" | "g." => "g",
        "kilogram" | "kilo" | "kg." => "kg",
        "milliliter" | "millilitre" | "ml." => "ml",
        "liter" | "litre" | "l." => "l",
        "eetlepel" | "eetl" | "eetl." | "el" | "el." => "el",
        "koffielepel" | "koffl" | "koffl." | "kl" | "kl." => "kl",
        "theelepel" | "tl" | "tl." => "tl",
        "stuk" | "stuks" | "pc" | "pcs" | "piece" | "pieces" => "stuk",
        "plak" | "plakken" | "plakje" | "plakjes" => "plak",
        "blad" | "bladeren" | "blaadjes" => "blad",
        "teen" | "tenen" | "teentje" | "teentjes" => "teen",
        "takje" | "takjes" | "tak" | "takken" => "takje",
        "snufje" | "snufjes" => "snufje",
        _ => u.as_str(),
    };
    Some(canonical.to_string())
}

/// Canonical display name — lowercase, strip outer whitespace.
pub fn canonical_display_name(name: &str) -> String {
    name.trim().to_lowercase()
}

/// Merge key: `canonical_name::canonical_unit`.
fn merge_key(name: &str, unit: Option<&str>) -> String {
    let n = canonical_display_name(name);
    let u = normalise_unit(unit)
        .unwrap_or_default();
    format!("{n}::{u}")
}

// ---------------------------------------------------------------------------
// Exact merge
// ---------------------------------------------------------------------------

struct Accumulator {
    id: String,
    name: String,
    unit: Option<String>,
    quantity_sum: Option<f64>,
    provenance: Vec<RecipeProvenance>,
}

/// Groups ingredients from all `sections` by name+unit, sums quantities, assigns L-IDs.
pub fn exact_merge(sections: &[ShoppingListSection]) -> PolishBaseline {
    let mut order: Vec<String> = Vec::new();
    let mut map: IndexMap<String, Accumulator> = IndexMap::new();
    let mut next_id: u32 = 1;

    for section in sections {
        let occurrence_multiplier = section.occurrence_count as f64;
        let prov = RecipeProvenance {
            recipe_id: section.recipe_id.clone(),
            recipe_title: section.recipe_title.clone(),
        };

        for ingredient in &section.ingredients {
            let key = merge_key(&ingredient.name, ingredient.unit.as_deref());

            if let Some(acc) = map.get_mut(&key) {
                // Accumulate quantity.
                if let Some(q) = ingredient.quantity {
                    let delta = q * occurrence_multiplier;
                    acc.quantity_sum = Some(acc.quantity_sum.unwrap_or(0.0) + delta);
                }
                // Add provenance if not already present.
                if !acc.provenance.iter().any(|p| p.recipe_id == prov.recipe_id) {
                    acc.provenance.push(prov.clone());
                }
            } else {
                let id = format!("L{next_id}");
                next_id += 1;
                let quantity_sum = ingredient.quantity.map(|q| q * occurrence_multiplier);
                order.push(key.clone());
                map.insert(
                    key,
                    Accumulator {
                        id,
                        name: ingredient.name.clone(),
                        unit: ingredient.unit.clone(),
                        quantity_sum,
                        provenance: vec![prov.clone()],
                    },
                );
            }
        }
    }

    let lines: Vec<MergedLine> = order
        .into_iter()
        .filter_map(|k| map.shift_remove(&k))
        .map(|acc| MergedLine {
            id: acc.id,
            name: acc.name,
            quantity: acc.quantity_sum,
            unit: acc.unit,
            provenance: acc.provenance,
            aisle_category: None,
        })
        .collect();

    PolishBaseline { lines, next_id }
}

// ---------------------------------------------------------------------------
// Build consolidation context (for AI polish)
// ---------------------------------------------------------------------------

/// Builds the context object that is serialised and sent to OpenRouter.
/// Each ingredient gets a composite ID `{recipe_idx}:{ingredient_idx}`.
pub fn build_consolidation_context(sections: &[ShoppingListSection]) -> ConsolidationContext {
    let context_sections: Vec<ConsolidationContextSection> = sections
        .iter()
        .enumerate()
        .map(|(si, section)| {
            let ingredients: Vec<ConsolidationContextIngredient> = section
                .ingredients
                .iter()
                .enumerate()
                .map(|(ii, ing)| ConsolidationContextIngredient {
                    id: format!("{si}:{ii}"),
                    name: ing.name.clone(),
                    quantity: ing.quantity,
                    unit: ing.unit.clone(),
                })
                .collect();

            ConsolidationContextSection {
                recipe_id: section.recipe_id.clone(),
                recipe_title: section.recipe_title.clone(),
                ingredients,
            }
        })
        .collect();

    ConsolidationContext { sections: context_sections }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::internal::{ShoppingListIngredient, ShoppingListSection};

    fn section(recipe_id: &str, ingredients: Vec<(&str, Option<f64>, Option<&str>)>) -> ShoppingListSection {
        ShoppingListSection {
            recipe_id: recipe_id.to_string(),
            recipe_title: recipe_id.to_string(),
            occurrence_count: 1,
            ingredients: ingredients
                .into_iter()
                .map(|(name, qty, unit)| ShoppingListIngredient {
                    raw_text: name.to_string(),
                    name: name.to_string(),
                    quantity: qty,
                    unit: unit.map(|s| s.to_string()),
                })
                .collect(),
        }
    }

    #[test]
    fn test_exact_merge_sums_same_name_unit() {
        let sections = vec![
            section("r1", vec![("bloem", Some(200.0), Some("g"))]),
            section("r2", vec![("bloem", Some(100.0), Some("g"))]),
        ];
        let result = exact_merge(&sections);
        assert_eq!(result.lines.len(), 1);
        assert_eq!(result.lines[0].quantity, Some(300.0));
        assert_eq!(result.lines[0].id, "L1");
    }

    #[test]
    fn test_exact_merge_different_units_not_merged() {
        let sections = vec![
            section("r1", vec![("boter", Some(100.0), Some("g"))]),
            section("r2", vec![("boter", Some(2.0), Some("el"))]),
        ];
        let result = exact_merge(&sections);
        assert_eq!(result.lines.len(), 2);
    }

    #[test]
    fn test_occurrence_multiplied() {
        let mut s = section("r1", vec![("melk", Some(250.0), Some("ml"))]);
        s.occurrence_count = 3;
        let result = exact_merge(&[s]);
        assert_eq!(result.lines[0].quantity, Some(750.0));
    }

    #[test]
    fn test_provenance_recorded() {
        let sections = vec![
            section("r1", vec![("ei", Some(2.0), None)]),
            section("r2", vec![("ei", Some(1.0), None)]),
        ];
        let result = exact_merge(&sections);
        assert_eq!(result.lines.len(), 1);
        assert_eq!(result.lines[0].provenance.len(), 2);
    }
}
