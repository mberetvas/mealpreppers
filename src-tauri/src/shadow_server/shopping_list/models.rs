//! Domain types for the Shopping List consolidation slice.
//!
//! All struct fields use `snake_case`; serde maps to `camelCase` for the wire format
//! to match the existing Nitro API contract.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Aisle categories (mirrors aisleSort.ts)
// ---------------------------------------------------------------------------

pub const AISLE_CATEGORY_ORDER: &[&str] = &[
    "produce",
    "bakery",
    "meat",
    "fish",
    "dairy",
    "frozen",
    "dry_goods",
    "spices",
    "canned_sauces",
    "oils",
    "beverages",
    "other",
];

/// Coerces an unknown string to a valid aisle category, defaulting to "other".
pub fn coerce_aisle_category(value: &str) -> &'static str {
    AISLE_CATEGORY_ORDER
        .iter()
        .copied()
        .find(|&cat| cat == value)
        .unwrap_or("other")
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeProvenance {
    pub recipe_id: String,
    pub recipe_title: String,
}

// ---------------------------------------------------------------------------
// Merged / baseline lines
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergedLine {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    pub provenance: Vec<RecipeProvenance>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aisle_category: Option<String>,
}

// ---------------------------------------------------------------------------
// Consolidation context (sent to AI polish)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidationContextIngredient {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidationContextSection {
    pub recipe_id: String,
    pub recipe_title: String,
    pub ingredients: Vec<ConsolidationContextIngredient>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidationContext {
    pub sections: Vec<ConsolidationContextSection>,
}

// ---------------------------------------------------------------------------
// AI polish response
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolishResponseLine {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    pub aisle_category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolishResponseChange {
    pub id: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub absorbed_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolishResponse {
    pub lines: Vec<PolishResponseLine>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changes: Option<Vec<PolishResponseChange>>,
}

// ---------------------------------------------------------------------------
// Consolidation result (POST response body)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PolishStatus {
    AiSkipped,
    Polished,
    PendingReview,
    BaselineFallback,
}

impl PolishStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            PolishStatus::AiSkipped => "ai_skipped",
            PolishStatus::Polished => "polished",
            PolishStatus::PendingReview => "pending_review",
            PolishStatus::BaselineFallback => "baseline_fallback",
        }
    }
}

impl Serialize for PolishStatus {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for PolishStatus {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        match s.as_str() {
            "ai_skipped" => Ok(PolishStatus::AiSkipped),
            "polished" => Ok(PolishStatus::Polished),
            "pending_review" => Ok(PolishStatus::PendingReview),
            "baseline_fallback" => Ok(PolishStatus::BaselineFallback),
            _ => Ok(PolishStatus::AiSkipped),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidationResult {
    pub consolidated_lines: Vec<MergedLine>,
    pub baseline_lines: Vec<MergedLine>,
    pub changes: Vec<PolishResponseChange>,
    pub polish_status: PolishStatus,
    pub warnings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_fingerprint: Option<String>,
}

// ---------------------------------------------------------------------------
// Saved Consolidated Shopping List record (stored as JSON in SQLite column)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedShoppingListLine {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aisle_category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedConsolidatedShoppingListRecord {
    pub lines: Vec<SavedShoppingListLine>,
    pub source_fingerprint: String,
    pub confirmed_at: String,
}

// ---------------------------------------------------------------------------
// PUT request payload
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidatedShoppingListPutPayload {
    pub lines: Vec<SavedShoppingListLine>,
    /// Optional client hint; server recomputes fingerprint from the plan body (TS parity).
    #[serde(default)]
    pub source_fingerprint: String,
}

#[cfg(test)]
mod put_payload_tests {
    use super::ConsolidatedShoppingListPutPayload;

    #[test]
    fn deserializes_lines_only_body_from_client() {
        let json = r#"{"lines":[{"id":"L1","name":"basilicum","quantity":1.0,"unit":"tak","aisleCategory":"produce"}]}"#;
        let payload: ConsolidatedShoppingListPutPayload =
            serde_json::from_str(json).expect("client sends lines only");
        assert_eq!(payload.lines.len(), 1);
        assert_eq!(payload.source_fingerprint, "");
    }
}
