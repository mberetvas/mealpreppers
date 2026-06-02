//! Composition root for shadow_server dependency wiring.
//!
//! # Phase legend
//!
//! **`WirePhase`** tracks the DDD hardening plan (`Docs/issues/0028`–`0039`). It is **not** the
//! same numbering as legacy milestone comments at the top of `routes.rs` (platform milestone →
//! Recipe Catalog → Planning route groups).

use std::sync::Arc;

use crate::shadow_server::{
    planning::{
        infrastructure::SqliteSavedWeekplanReader,
        ports::SavedWeekplanReader,
    },
    recipe_catalog::{
        infrastructure::{FsRecipeImageStore, SqliteRecipeRepository},
        ports::{RecipeImageStore, RecipeRepository},
    },
    routes::AppState,
    shopping_list::{
        infrastructure::SqliteConsolidatedShoppingListRepository,
        ports::ConsolidatedShoppingListRepository,
    },
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
    /// Phase 3a — consolidated shopping list GET/PUT ports.
    Phase3a,
}

/// Wires slice dependencies onto application state before routes are registered.
///
/// Called from [`crate::shadow_server::routes::build_router`].
pub fn wire_dependencies(state: AppState, phase: WirePhase) -> AppState {
    let db_path = state.db_path();

    let recipes: Arc<dyn RecipeRepository> = Arc::new(SqliteRecipeRepository::new(db_path.clone()));

    let recipe_images: Arc<dyn RecipeImageStore> = Arc::new(FsRecipeImageStore::new(
        state.recipe_images_dir(),
    ));

    let consolidated_shopping_lists: Arc<dyn ConsolidatedShoppingListRepository> =
        Arc::new(SqliteConsolidatedShoppingListRepository::new(db_path.clone()));

    let saved_weekplan_reader: Arc<dyn SavedWeekplanReader> =
        Arc::new(SqliteSavedWeekplanReader::new(db_path));

    match phase {
        WirePhase::Phase0 => {}
        WirePhase::Phase1a | WirePhase::Phase1b | WirePhase::Phase1c => {}
        WirePhase::Phase3a => {}
    }

    AppState {
        recipes,
        recipe_images,
        consolidated_shopping_lists,
        saved_weekplan_reader,
        ..state
    }
}
