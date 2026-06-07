//! Domain types for the Recipe Ingestion slice — recipe preview API.
//!
//! All fields use `snake_case`; serde maps to `camelCase` for wire format
//! to match the existing Nitro API contract.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Supported recipe hosts
// ---------------------------------------------------------------------------

/// Hostnames we can scrape (https only) — mirrors `SUPPORTED_RECIPE_HOSTS` in TypeScript.
pub const SUPPORTED_RECIPE_HOSTS: &[&str] = &[
    "15gram.be",
    "colruyt.be",
    "dagelijksekost.vrt.be",
    "delhaize.be",
    "libelle-lekker.be",
];

// ---------------------------------------------------------------------------
// Recipe draft shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeSource {
    pub url: String,
    pub host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeIngredientDraft {
    pub raw_text: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeStepDraft {
    pub position: usize,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeDraft {
    pub source: RecipeSource,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub servings: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_time_minutes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prep_time_minutes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cook_time_minutes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<String>,
    pub categories: Vec<String>,
    pub tags: Vec<String>,
    pub ingredients: Vec<RecipeIngredientDraft>,
    pub steps: Vec<RecipeStepDraft>,
}

// ---------------------------------------------------------------------------
// API request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipePreviewRequest {
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipePreviewResponse {
    pub draft: RecipeDraft,
    pub warnings: Vec<String>,
}
