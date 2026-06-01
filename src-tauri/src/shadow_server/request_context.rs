//! Per-request context: **Trace ID** and **Planning Principal**.
//!
//! Trace ID resolution follows **Trace Header Precedence**:
//! `x-trace-id` → `x-request-id` → generated UUID.
//!
//! The **Planning Principal** is the install-scoped user identity read (or created) from the
//! `local-user-id` file in the app data directory.

use std::path::Path;

use axum::http::Request;
use uuid::Uuid;

const TRACE_ID_HEADER: &str = "x-trace-id";
const REQUEST_ID_HEADER: &str = "x-request-id";
const LOCAL_USER_ID_FILE: &str = "local-user-id";

/// Request-scoped context injected by `request_context_layer` and consumed by route handlers.
#[derive(Clone)]
pub struct RequestContext {
    pub trace_id: String,
    pub planning_principal: PlanningPrincipal,
}

/// Install-scoped identity for Planning reads and mutations.
#[derive(Clone)]
pub struct PlanningPrincipal {
    pub kind: &'static str,
    pub user_id: String,
}

/// Resolves the **Trace ID** from request headers following **Trace Header Precedence**.
pub fn resolve_trace_id<B>(request: &Request<B>) -> String {
    let headers = request.headers();

    if let Some(val) = headers.get(TRACE_ID_HEADER) {
        let s = val.to_str().unwrap_or("").trim().to_string();
        if !s.is_empty() {
            return s;
        }
    }

    if let Some(val) = headers.get(REQUEST_ID_HEADER) {
        let s = val.to_str().unwrap_or("").trim().to_string();
        if !s.is_empty() {
            return s;
        }
    }

    Uuid::new_v4().to_string()
}

/// Reads the install-scoped **Planning Principal** user id from the `local-user-id` file,
/// creating it with a fresh UUID on first call.
pub fn resolve_planning_user_id(data_dir: &Path) -> String {
    let file_path = data_dir.join(LOCAL_USER_ID_FILE);

    if let Ok(existing) = std::fs::read_to_string(&file_path) {
        let trimmed = existing.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }

    let user_id = Uuid::new_v4().to_string();
    let _ = std::fs::write(&file_path, &user_id);
    user_id
}
