//! OpenRouter API integration for AI polish of consolidated shopping lists.
//!
//! Mirrors `polishChainFactory.ts` — calls `openrouter.ai/api/v1/chat/completions`
//! with the Belgian supermarket shopping-list system prompt.
//!
//! Intended to run inside `tokio::task::spawn_blocking`.

use std::time::Duration;

use serde_json::{json, Value};
use ureq::Error as UreqError;

use crate::shadow_server::platform::redact_sensitive_text;

use super::models::{ConsolidationContext, PolishResponse};

// ---------------------------------------------------------------------------
// System prompt (mirrors polishChainFactory.ts SYSTEM_PROMPT constant)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT: &str = r#"
Je bent een intelligente boodschappenlijst-assistent voor Belgische supermarkten (Colruyt, Delhaize, Albert Heijn, Lidl, Aldi).

Jij ontvangt een JSON-object met secties (per recept) die ingrediënten bevatten.
Jij combineert, normaliseert en sorteert de ingrediënten tot een overzichtelijke boodschappenlijst.

Regels:
1. COMBINEER ingrediënten die logisch bij elkaar horen (bv. 100g boter + 50g boter = 150g boter).
2. NORMALISEER eenheden naar de meest gangbare Belgische supermarktnotatie (bv. g, kg, ml, l, el, kl, stuk).
3. SORTEER per winkelgang (aisleCategory):
   - produce: groenten, fruit, kruiden (vers)
   - bakery: brood, gebak
   - meat: vlees, vleeswaren
   - fish: vis, zeevruchten
   - dairy: zuivel, eieren, kaas, boter
   - frozen: diepvries
   - dry_goods: pasta, rijst, bloem, suiker, granen
   - spices: specerijen, kruiden (droog)
   - canned_sauces: ingeblikte tomaten, conserven, pastasaus
   - oils: olie, azijn
   - beverages: dranken
   - other: overige
4. Geef ELKE regel een aisleCategory (kies uit de lijst hierboven).
5. Bewaar de originele ID's (L1, L2, …) wanneer een regel NIET wordt gecombineerd.
6. Wanneer je regels combineert, kies dan het ID van de eerste regel en voeg absorbed_ids toe aan de changes array.
7. Retourneer ALLEEN geldig JSON in het formaat hieronder — geen uitleg, geen markdown.

Output formaat:
{
  "lines": [
    { "id": "L1", "name": "...", "quantity": 1.5, "unit": "g", "aisleCategory": "dairy" }
  ],
  "changes": [
    { "id": "L1", "reason": "...", "absorbedIds": ["L2"] }
  ]
}
"#;

const OPENROUTER_ENDPOINT: &str = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_REFERER: &str = "https://mealpreppers.app";
const OPENROUTER_TITLE: &str = "Mealpreppers";

pub const DEFAULT_SHOPPING_LIST_MODEL: &str = "deepseek/deepseek-v4-flash";

pub fn default_model() -> String {
    crate::shadow_server::settings::repository::resolve_shopping_list_model_from_env()
}

/// Resolves the shopping-list polish model from the install settings row.
pub fn resolve_model_from_db(conn: &rusqlite::Connection) -> String {
    crate::shadow_server::settings::repository::resolve_shopping_list_model(conn)
}

pub fn default_timeout_ms() -> u64 {
    std::env::var("OPENROUTER_SHOPPING_LIST_TIMEOUT_MS")
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .filter(|&ms| ms > 0)
        .unwrap_or(60_000)
}

// ---------------------------------------------------------------------------
// Main API call
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub enum OpenRouterError {
    Network(String),
    BadStatus(u16, String),
    Parse(String),
}

impl std::fmt::Display for OpenRouterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpenRouterError::Network(e) => {
                write!(f, "network: {}", redact_sensitive_text(e))
            }
            OpenRouterError::BadStatus(code, msg) => {
                write!(f, "HTTP {code}: {}", redact_sensitive_text(msg))
            }
            OpenRouterError::Parse(e) => write!(f, "parse: {e}"),
        }
    }
}

/// True when the OpenRouter call was aborted by a configured timeout.
/// Mirrors `isPolishAbortTimeout` in `polishChainFactory.ts`.
pub fn is_polish_abort_timeout(err: &OpenRouterError) -> bool {
    match err {
        OpenRouterError::Network(msg) => {
            let lower = msg.to_ascii_lowercase();
            lower.contains("timeout") || lower.contains("aborted")
        }
        _ => false,
    }
}

fn map_ureq_error(err: UreqError) -> OpenRouterError {
    if matches!(err, UreqError::Timeout(_)) {
        return OpenRouterError::Network("request timeout".into());
    }
    OpenRouterError::Network(redact_sensitive_text(&err.to_string()))
}

/// Calls OpenRouter chat completions API and returns parsed polish response.
/// Intended to run inside `tokio::task::spawn_blocking`.
pub fn call_openrouter_polish(
    key: &str,
    model: &str,
    context: &ConsolidationContext,
) -> Result<PolishResponse, OpenRouterError> {
    let user_content = serde_json::to_string(context)
        .map_err(|e| OpenRouterError::Parse(format!("serialize context: {e}")))?;

    let request_body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT.trim() },
            { "role": "user", "content": user_content }
        ],
        "response_format": { "type": "json_object" }
    });

    let body_bytes = serde_json::to_vec(&request_body)
        .map_err(|e| OpenRouterError::Parse(format!("serialize body: {e}")))?;

    let timeout = Duration::from_millis(default_timeout_ms());

    let resp = ureq::post(OPENROUTER_ENDPOINT)
        .config()
        .timeout_global(Some(timeout))
        .build()
        .header("content-type", "application/json")
        .header("authorization", &format!("Bearer {key}"))
        .header("http-referer", OPENROUTER_REFERER)
        .header("x-title", OPENROUTER_TITLE)
        .send(&body_bytes[..])
        .map_err(map_ureq_error)?;

    let status = resp.status().as_u16();
    if status != 200 {
        let mut resp = resp;
        let body = resp.body_mut().read_to_string().unwrap_or_default();
        return Err(OpenRouterError::BadStatus(status, body));
    }

    let mut resp = resp;
    let response_body = resp.body_mut().read_to_string().map_err(map_ureq_error)?;

    let root: Value = serde_json::from_str(&response_body)
        .map_err(|e| OpenRouterError::Parse(format!("parse root: {e}")))?;

    let content = root["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| OpenRouterError::Parse("missing choices[0].message.content".into()))?;

    let polish: PolishResponse = serde_json::from_str(content)
        .map_err(|e| OpenRouterError::Parse(format!("parse polish response: {e}")))?;

    Ok(polish)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_polish_abort_timeout_detects_timeout_and_aborted_messages() {
        assert!(is_polish_abort_timeout(&OpenRouterError::Network(
            "request timeout".into()
        )));
        assert!(is_polish_abort_timeout(&OpenRouterError::Network(
            "The operation was aborted due to timeout".into()
        )));
        assert!(!is_polish_abort_timeout(&OpenRouterError::Network(
            "rate limit".into()
        )));
        assert!(!is_polish_abort_timeout(&OpenRouterError::BadStatus(
            429,
            "too many requests".into()
        )));
    }

    #[test]
    fn display_redacts_bearer_tokens_in_network_errors() {
        let err = OpenRouterError::Network("auth failed Bearer sk-or-v1-secret-key".into());
        let formatted = err.to_string();
        assert!(formatted.contains("Bearer [REDACTED]"));
        assert!(!formatted.contains("sk-or-v1-secret-key"));
    }
}
