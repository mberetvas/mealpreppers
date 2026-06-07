//! Rust types for the Recipe Catalog — mirrors the TypeScript `RecipeCatalogItem` shape.
//!
//! All struct fields use `snake_case`; serde maps them to camelCase for JSON
//! serialization so the wire format matches the existing Nitro API.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeIngredient {
    pub id: String,
    pub position: i64,
    pub raw_text: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeStep {
    pub id: String,
    pub position: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeCatalogItem {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub servings: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prep_time_minutes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cook_time_minutes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_time_minutes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<String>,
    pub categories: Vec<String>,
    pub tags: Vec<String>,
    pub ingredients: Vec<RecipeIngredient>,
    pub steps: Vec<RecipeStep>,
    pub created_at: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngredientInput {
    pub raw_text: String,
    pub name: String,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepInput {
    pub position: Option<i64>,
    pub text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeCreatePayload {
    #[serde(default)]
    pub title: String,
    pub description: Option<String>,
    pub source_url: Option<String>,
    pub source_host: Option<String>,
    pub image_url: Option<String>,
    pub servings: Option<i64>,
    pub prep_time_minutes: Option<i64>,
    pub cook_time_minutes: Option<i64>,
    pub total_time_minutes: Option<i64>,
    pub difficulty: Option<String>,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub ingredients: Vec<IngredientInput>,
    #[serde(default)]
    pub steps: Vec<StepInput>,
}

/// Update payload has the same shape as create.
pub type RecipeUpdatePayload = RecipeCreatePayload;

#[derive(Debug, Deserialize)]
pub struct BulkDeleteRequest {
    pub ids: Vec<String>,
}
