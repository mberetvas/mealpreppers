//! Production [`ShoppingListPolishPort`] using OpenRouter and the OS keychain.

use std::path::PathBuf;

use crate::{
    keychain,
    shadow_server::{
        planning::repository::open_conn,
        shopping_list::{
            models::ConsolidationContext,
            openrouter::{call_openrouter_polish, default_timeout_ms, resolve_model_from_db},
            ports::{PolishPortError, PolishPortResult, ShoppingListPolishPort},
        },
    },
};

/// OpenRouter-backed polish port; reads the API key from the desktop keychain.
pub struct OpenRouterShoppingListPolishPort {
    db_path: PathBuf,
}

impl OpenRouterShoppingListPolishPort {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    fn read_api_key() -> Option<String> {
        keychain::read_openrouter_key()
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty())
    }

    fn line_count(context: &ConsolidationContext) -> usize {
        context
            .sections
            .iter()
            .map(|section| section.ingredients.len())
            .sum()
    }
}

impl ShoppingListPolishPort for OpenRouterShoppingListPolishPort {
    fn is_configured(&self) -> bool {
        Self::read_api_key().is_some()
    }

    fn polish(&self, context: &ConsolidationContext) -> Result<PolishPortResult, PolishPortError> {
        let api_key = Self::read_api_key().ok_or_else(|| {
            PolishPortError::OpenRouter(
                crate::shadow_server::shopping_list::openrouter::OpenRouterError::Network(
                    "OpenRouter API key is not configured".into(),
                ),
            )
        })?;

        let conn = open_conn(&self.db_path).map_err(|e| {
            PolishPortError::OpenRouter(
                crate::shadow_server::shopping_list::openrouter::OpenRouterError::Network(format!(
                    "open db for model resolution: {e:?}"
                )),
            )
        })?;
        let model = resolve_model_from_db(&conn);
        let timeout_ms = default_timeout_ms();
        let line_count = Self::line_count(context);

        log::info!(
            "shopping_list.polish_start model={model} line_count={line_count} timeout_ms={timeout_ms}"
        );

        let start = std::time::Instant::now();
        let response = call_openrouter_polish(&api_key, &model, context)?;
        let latency_ms = start.elapsed().as_millis();

        log::info!(
            "shopping_list.polish_complete latency_ms={latency_ms} model={model} line_count={}",
            response.lines.len()
        );

        Ok(PolishPortResult { response })
    }
}
