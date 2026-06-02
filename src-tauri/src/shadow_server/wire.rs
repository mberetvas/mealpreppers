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
        infrastructure::{FsRecipeImageStore, SqliteRecipeRepository},
        ports::{RecipeImageStore, RecipeRepository},
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
    /// Phase 1c — Recipe Catalog image store (`RecipeImageStore` on [`AppState`]).
    Phase1c,
}

/// Wires slice dependencies onto application state before routes are registered.
///
/// Called from [`crate::shadow_server::routes::build_router`].
pub fn wire_dependencies(state: AppState, phase: WirePhase) -> AppState {
    let recipes: Arc<dyn RecipeRepository> =
        Arc::new(SqliteRecipeRepository::new(state.db_path()));

    let recipe_images: Arc<dyn RecipeImageStore> = Arc::new(FsRecipeImageStore::new(
        state.recipe_images_dir(),
    ));

    match phase {
        WirePhase::Phase0 => {}
        WirePhase::Phase1a | WirePhase::Phase1b | WirePhase::Phase1c => {}
    }

    AppState {
        recipes,
        recipe_images,
        ..state
    }
}
