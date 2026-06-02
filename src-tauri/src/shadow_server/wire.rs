//! Composition root for shadow_server dependency wiring.
//!
//! # Phase legend
//!
//! **`WirePhase`** tracks the DDD hardening plan (`Docs/issues/0028`–`0039`). It is **not** the
//! same numbering as legacy milestone comments at the top of `routes.rs` (platform milestone →
//! Recipe Catalog → Planning route groups).

use std::sync::Arc;

use crate::shadow_server::{
    recipe_catalog::{
        infrastructure::SqliteRecipeRepository,
        ports::RecipeRepository,
    },
    routes::AppState,
};

/// DDD hardening plan phase for incremental trait wiring onto [`AppState`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WirePhase {
    /// Phase 0 — platform foundation (`RepoError`, stub composition root).
    Phase0,
    /// Phase 1a — Recipe Catalog read path (`RecipeRepository` on [`AppState`]).
    Phase1a,
    /// Phase 1b — Recipe Catalog write path (create/update/bulk-delete on [`RecipeRepository`]).
    Phase1b,
}

/// Wires slice dependencies onto application state before routes are registered.
///
/// Called from [`crate::shadow_server::routes::build_router`].
pub fn wire_dependencies(state: AppState, phase: WirePhase) -> AppState {
    let recipes: Arc<dyn RecipeRepository> =
        Arc::new(SqliteRecipeRepository::new(state.db_path()));

    match phase {
        WirePhase::Phase0 => {}
        WirePhase::Phase1a | WirePhase::Phase1b => {}
    }

    AppState { recipes, ..state }
}
