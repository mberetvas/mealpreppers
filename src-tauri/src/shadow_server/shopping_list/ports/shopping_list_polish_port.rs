//! Injectable port for AI polish of consolidated shopping lists.

use crate::shadow_server::shopping_list::{
    models::{ConsolidationContext, PolishResponse},
    openrouter::OpenRouterError,
};

/// Result returned by a shopping list polish port implementation.
#[derive(Debug, Clone)]
pub struct PolishPortResult {
    pub response: PolishResponse,
}

/// Errors surfaced when AI polish fails.
#[derive(Debug)]
pub enum PolishPortError {
    OpenRouter(OpenRouterError),
}

impl std::fmt::Display for PolishPortError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PolishPortError::OpenRouter(e) => write!(f, "{e}"),
        }
    }
}

impl From<OpenRouterError> for PolishPortError {
    fn from(value: OpenRouterError) -> Self {
        PolishPortError::OpenRouter(value)
    }
}

/// Port for consolidating recipe-grouped ingredients via AI.
pub trait ShoppingListPolishPort: Send + Sync {
    /// Returns true when an OpenRouter API key is available for polish calls.
    fn is_configured(&self) -> bool;

    /// Invokes AI polish on the consolidation context.
    ///
    /// Call only when [`Self::is_configured`] is true.
    fn polish(&self, context: &ConsolidationContext) -> Result<PolishPortResult, PolishPortError>;
}
