//! Axum middleware for the Desktop Local API shadow server.
//!
//! - **`token_gate`** — enforces `X-Desktop-Token` on `/api/**` when `DESKTOP_TOKEN` is configured;
//!   `/health` and other paths remain unauthenticated per the current policy.
//! - **`request_context_layer`** — resolves **Trace ID** and **Planning Principal**, inserts them
//!   as a `RequestContext` extension, and echoes the trace id in the `x-trace-id` response header.

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use subtle::ConstantTimeEq;

use crate::shadow_server::{
    error::AppError,
    request_context::{resolve_planning_user_id, resolve_trace_id, PlanningPrincipal, RequestContext},
    routes::AppState,
};

/// Rejects requests to `/api/**` with `401` when a desktop token is configured and the
/// `X-Desktop-Token` header is missing or does not match (timing-safe comparison).
pub async fn token_gate(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    if let Some(ref expected_token) = state.token {
        let path = request.uri().path();
        if path.starts_with("/api/") {
            let provided = request
                .headers()
                .get("x-desktop-token")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .trim()
                .to_string();

            if !tokens_match(&provided, expected_token) {
                return Err(AppError::unauthorized("Invalid or missing desktop token"));
            }
        }
    }
    Ok(next.run(request).await)
}

/// Injects `RequestContext` (**Trace ID** + **Planning Principal**) into request extensions and
/// echoes the trace id in the `x-trace-id` response header.
pub async fn request_context_layer(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    let trace_id = resolve_trace_id(&request);
    let user_id = resolve_planning_user_id(&state.data_dir);

    let ctx = RequestContext {
        trace_id: trace_id.clone(),
        planning_principal: PlanningPrincipal {
            kind: "user",
            user_id,
        },
    };
    request.extensions_mut().insert(ctx);

    let mut response = next.run(request).await;

    if let Ok(header_val) = trace_id.parse() {
        response.headers_mut().insert("x-trace-id", header_val);
    }

    response
}

/// Constant-time token comparison (length mismatch short-circuits but that is acceptable
/// since token lengths are public / fixed).
fn tokens_match(provided: &str, expected: &str) -> bool {
    let a = provided.as_bytes();
    let b = expected.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    a.ct_eq(b).into()
}
