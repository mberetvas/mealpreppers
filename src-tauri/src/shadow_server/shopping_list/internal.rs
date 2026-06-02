//! Shopping list input types for the exact-merge and consolidation pipeline.
//!
//! These are internal (not serialised to the API wire format directly) but
//! represent the intermediate representation built from weekplan + recipes.

use serde::Serialize;

/// One recipe's worth of ingredients that will be merged.
#[derive(Debug, Clone)]
pub struct ShoppingListIngredient {
    pub raw_text: String,
    pub name: String,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
}

/// One recipe section feeding into the consolidation pipeline.
#[derive(Debug, Clone)]
pub struct ShoppingListSection {
    pub recipe_id: String,
    pub recipe_title: String,
    /// How many times this recipe appears in the week plan.
    pub occurrence_count: u32,
    pub ingredients: Vec<ShoppingListIngredient>,
}

/// A "polish baseline" — output of `exact_merge`.
#[derive(Debug, Clone, Serialize)]
pub struct PolishBaseline {
    pub lines: Vec<super::models::MergedLine>,
    pub next_id: u32,
}
