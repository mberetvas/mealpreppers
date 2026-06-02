//! Composition root for shadow_server dependency wiring.
//!
//! # Phase legend
//!
//! **`WirePhase`** tracks the DDD hardening plan (`Docs/issues/0028`–`0039`). It is **not** the
//! same numbering as legacy milestone comments at the top of `routes.rs` (platform milestone →
//! Recipe Catalog → Planning route groups).

use crate::shadow_server::routes::AppState;

/// DDD hardening plan phase for incremental trait wiring onto [`AppState`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WirePhase {
    /// Phase 0 — platform foundation (`RepoError`, stub composition root).
    Phase0,
}

/// Wires slice dependencies onto application state before routes are registered.
///
/// Called from [`crate::shadow_server::routes::build_router`]. Phase 0 is a no-op stub;
/// later issues extend this for trait-based ports.
pub fn wire_dependencies(state: AppState, phase: WirePhase) -> AppState {
    match phase {
        WirePhase::Phase0 => {}
    }
    state
}
