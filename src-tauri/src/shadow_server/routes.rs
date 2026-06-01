//! Axum routes for the Desktop Local API shadow server.
//!
//! Phase 1 (platform milestone) exposes:
//! - `GET /health` — unauthenticated liveness probe (same contract as Nitro's `/health`).
//! - `GET /api/v1/stub` — authenticated test-only route that logs **Trace ID** and
//!   **Planning Principal** using `domain.action` **Log Event Names** and returns them in the
//!   response body for integration-test assertions.

use std::path::PathBuf;

use axum::{
    extract::Extension,
    middleware,
    response::Json,
    routing::get,
    Router,
};
use serde_json::{json, Value};

use crate::shadow_server::{
    error::AppError,
    middleware::{request_context_layer, token_gate},
    request_context::RequestContext,
};

/// Shared application state threaded through the Axum router.
#[derive(Clone)]
pub struct AppState {
    /// App data directory — used to resolve the `local-user-id` **Planning Principal** file.
    pub data_dir: PathBuf,
    /// Optional desktop token value; when `Some`, `/api/**` routes require `X-Desktop-Token`.
    pub token: Option<String>,
}

/// Assembles the full Axum router with all middleware layers.
pub fn build_router(state: AppState) -> Router {
    // `/api/**` routes — token-gated via route_layer so /health is unaffected
    let api_routes = Router::new()
        .route("/v1/stub", get(stub_handler))
        .route_layer(middleware::from_fn_with_state(state.clone(), token_gate));

    Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_routes)
        // request_context_layer runs on every route (including /health) so Trace ID is always set
        .layer(middleware::from_fn_with_state(state.clone(), request_context_layer))
        .with_state(state)
}

/// Liveness probe — mirrors the Nitro `/health` contract (`{"ok": true}`, 200).
async fn health_handler() -> Json<Value> {
    Json(json!({ "ok": true }))
}

/// Test-only stub route that proves **Trace ID** + **Planning Principal** resolution and
/// emits a structured log line with a `domain.action` **Log Event Name**.
async fn stub_handler(
    Extension(ctx): Extension<RequestContext>,
) -> Result<Json<Value>, AppError> {
    log::info!(
        "desktop.request_context.resolved traceId={} planningUserId={}",
        ctx.trace_id,
        ctx.planning_principal.user_id
    );

    Ok(Json(json!({
        "traceId": ctx.trace_id,
        "planningUserId": ctx.planning_principal.user_id,
    })))
}
