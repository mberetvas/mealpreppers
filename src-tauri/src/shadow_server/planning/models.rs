//! Domain types for the Planning slice: Saved Weekplans and month-plans.
//!
//! All struct fields use `snake_case`; serde maps them to `camelCase` for JSON
//! serialization so the wire format matches the existing Nitro API.
//!
//! `WeekPlanDays` uses a `HashMap<String, DayMeals>` so days "1"–"7" are iterated
//! programmatically during recipe-ID collection.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Stored body shapes (WeekPlanV1, MonthPlanV1)
// ---------------------------------------------------------------------------

/// A single meal slot — holds an optional recipe reference.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeIdSlot {
    pub recipe_id: Option<String>,
}

/// The three meals of a single day.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayMeals {
    pub breakfast: RecipeIdSlot,
    pub lunch: RecipeIdSlot,
    pub dinner: RecipeIdSlot,
}

/// Stored JSON body for a week template row (`meal_week_templates.body`).
///
/// `days` is a map from day number string ("1"–"7") to `DayMeals`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeekPlanV1 {
    pub version: String,
    pub days: HashMap<String, DayMeals>,
}

/// Stored JSON body for a month plan row (`meal_month_plans.body`).
///
/// `weeks` is a JSON array of 4 elements, each nullable `WeekPlanV1`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthPlanV1 {
    pub version: String,
    pub weeks: Vec<Option<WeekPlanV1>>,
}

// ---------------------------------------------------------------------------
// Response shapes — Saved Weekplans
// ---------------------------------------------------------------------------

/// List item shape returned by `GET /api/v1/saved-weekplans`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedWeekplanListItem {
    pub id: String,
    pub name: String,
    pub updated_at: String,
    pub has_saved_shopping_list: bool,
    pub shopping_list_deprecated: bool,
}

/// Full row shape returned by `GET /api/v1/saved-weekplans/:id`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedWeekplanRow {
    pub id: String,
    pub name: String,
    pub body: WeekPlanV1,
    pub created_at: String,
    pub updated_at: String,
    pub has_saved_shopping_list: bool,
    pub shopping_list_deprecated: bool,
}

// ---------------------------------------------------------------------------
// Response shapes — Month Plans
// ---------------------------------------------------------------------------

/// List item shape returned by `GET /api/v1/planning/month-plans`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthPlanListItem {
    pub id: String,
    pub name: Option<String>,
    pub updated_at: String,
}

/// Full row shape returned by `GET /api/v1/planning/month-plans/:id`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthPlanRow {
    pub id: String,
    pub name: Option<String>,
    pub body: MonthPlanV1,
    pub created_at: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// Request payloads — Saved Weekplans
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedWeekplanCreatePayload {
    #[serde(default)]
    pub name: String,
    pub body: Option<WeekPlanV1>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedWeekplanPatchPayload {
    pub name: Option<String>,
    pub body: Option<WeekPlanV1>,
}

// ---------------------------------------------------------------------------
// Request payloads — Month Plans
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthPlanCreatePayload {
    pub name: Option<String>,
    pub body: Option<MonthPlanV1>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthPlanPatchPayload {
    pub name: Option<String>,
    pub body: Option<MonthPlanV1>,
}
