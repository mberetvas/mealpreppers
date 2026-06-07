//! Axum route handlers for the Planning slice endpoints.
//!
//! # Routes
//! ## Saved Weekplans
//! - `GET    /api/v1/saved-weekplans`          — list (principal-scoped)
//! - `POST   /api/v1/saved-weekplans`          — create
//! - `GET    /api/v1/saved-weekplans/:id`      — get single
//! - `PATCH  /api/v1/saved-weekplans/:id`      — patch
//! - `DELETE /api/v1/saved-weekplans/:id`      — delete
//!
//! ## Month Plans
//! - `GET    /api/v1/planning/month-plans`     — list
//! - `POST   /api/v1/planning/month-plans`     — create
//! - `GET    /api/v1/planning/month-plans/:id` — get single
//! - `PATCH  /api/v1/planning/month-plans/:id` — patch
//! - `DELETE /api/v1/planning/month-plans/:id` — delete

use axum::{
    extract::{Extension, Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
};

use crate::shadow_server::{
    error::AppError,
    planning::{
        models::{
            MonthPlanCreatePayload, MonthPlanPatchPayload, SavedWeekplanCreatePayload,
            SavedWeekplanPatchPayload,
        },
        repository::{
            self, assert_recipe_ids_exist, collect_recipe_ids_from_month_plan,
            collect_recipe_ids_from_week_plan, delete_month_plan, delete_saved_weekplan,
            get_month_plan_by_id, get_saved_weekplan_by_id, list_month_plans, list_saved_weekplans,
            open_conn, update_month_plan, update_saved_weekplan,
        },
    },
    request_context::RequestContext,
    routes::AppState,
};

// ---------------------------------------------------------------------------
// Saved Weekplans handlers
// ---------------------------------------------------------------------------

/// `GET /api/v1/saved-weekplans` — lists all weekplans owned by the Planning Principal.
pub async fn list_saved_weekplans_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
) -> Result<impl IntoResponse, AppError> {
    let db_path = state.db_path();
    let user_id = ctx.planning_principal.user_id;

    let items = tokio::task::spawn_blocking(move || {
        let conn = open_conn(&db_path)?;
        list_saved_weekplans(&conn, &user_id)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok(Json(items))
}

/// `POST /api/v1/saved-weekplans` — creates a weekplan owned by the Planning Principal.
pub async fn create_saved_weekplan_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Json(payload): Json<SavedWeekplanCreatePayload>,
) -> Result<impl IntoResponse, AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::bad_request("Saved weekplan name is required."));
    }
    let body = payload
        .body
        .ok_or_else(|| AppError::bad_request("Saved weekplan body is required."))?;

    let db_path = state.db_path();
    let user_id = ctx.planning_principal.user_id;
    let name = payload.name.trim().to_string();

    let item = tokio::task::spawn_blocking(move || {
        let mut conn = open_conn(&db_path)?;
        let recipe_ids = collect_recipe_ids_from_week_plan(&body);
        assert_recipe_ids_exist(&conn, &recipe_ids)?;
        repository::create_saved_weekplan(&mut conn, &user_id, &name, &body)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok((StatusCode::OK, Json(item)))
}

/// `GET /api/v1/saved-weekplans/:id` — returns a single weekplan, principal-scoped.
pub async fn get_saved_weekplan_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let id = id.trim().to_string();
    if id.is_empty() {
        return Err(AppError::bad_request("Saved weekplan id is required."));
    }

    let db_path = state.db_path();
    let user_id = ctx.planning_principal.user_id;

    let item = tokio::task::spawn_blocking(move || {
        let conn = open_conn(&db_path)?;
        get_saved_weekplan_by_id(&conn, &id, &user_id)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok(Json(item))
}

/// `PATCH /api/v1/saved-weekplans/:id` — updates name and/or body, principal-scoped.
pub async fn patch_saved_weekplan_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(id): Path<String>,
    Json(payload): Json<SavedWeekplanPatchPayload>,
) -> Result<impl IntoResponse, AppError> {
    let id = id.trim().to_string();
    if id.is_empty() {
        return Err(AppError::bad_request("Saved weekplan id is required."));
    }
    if payload.name.is_none() && payload.body.is_none() {
        return Err(AppError::bad_request(
            "Provide at least one of name or body.",
        ));
    }
    if let Some(ref n) = payload.name {
        if n.trim().is_empty() {
            return Err(AppError::bad_request(
                "Saved weekplan name cannot be empty.",
            ));
        }
    }

    let db_path = state.db_path();
    let user_id = ctx.planning_principal.user_id;

    let item = tokio::task::spawn_blocking(move || {
        let mut conn = open_conn(&db_path)?;
        if let Some(ref body) = payload.body {
            let recipe_ids = collect_recipe_ids_from_week_plan(body);
            assert_recipe_ids_exist(&conn, &recipe_ids)?;
        }
        let name_ref = payload.name.as_deref();
        let body_ref = payload.body.as_ref();
        update_saved_weekplan(&mut conn, &id, &user_id, name_ref, body_ref)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok(Json(item))
}

/// `DELETE /api/v1/saved-weekplans/:id` — deletes a weekplan, principal-scoped.
pub async fn delete_saved_weekplan_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let id = id.trim().to_string();
    if id.is_empty() {
        return Err(AppError::bad_request("Saved weekplan id is required."));
    }

    let db_path = state.db_path();
    let user_id = ctx.planning_principal.user_id;

    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&db_path)?;
        delete_saved_weekplan(&conn, &id, &user_id)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// ---------------------------------------------------------------------------
// Month Plans handlers
// ---------------------------------------------------------------------------

/// `GET /api/v1/planning/month-plans` — lists all month plans ordered by updated_at DESC.
pub async fn list_month_plans_handler(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    let db_path = state.db_path();

    let items = tokio::task::spawn_blocking(move || {
        let conn = open_conn(&db_path)?;
        list_month_plans(&conn)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok(Json(items))
}

/// `POST /api/v1/planning/month-plans` — creates a month plan.
pub async fn create_month_plan_handler(
    State(state): State<AppState>,
    Json(payload): Json<MonthPlanCreatePayload>,
) -> Result<impl IntoResponse, AppError> {
    let body = payload
        .body
        .ok_or_else(|| AppError::bad_request("Month plan body is required."))?;

    let db_path = state.db_path();
    let name = payload.name;

    let item = tokio::task::spawn_blocking(move || {
        let mut conn = open_conn(&db_path)?;
        let recipe_ids = collect_recipe_ids_from_month_plan(&body);
        assert_recipe_ids_exist(&conn, &recipe_ids)?;
        repository::create_month_plan(&mut conn, name.as_deref(), &body)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok((StatusCode::OK, Json(item)))
}

/// `GET /api/v1/planning/month-plans/:id` — returns a single month plan.
pub async fn get_month_plan_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let id = id.trim().to_string();
    if id.is_empty() {
        return Err(AppError::bad_request("Month plan id is required."));
    }

    let db_path = state.db_path();

    let item = tokio::task::spawn_blocking(move || {
        let conn = open_conn(&db_path)?;
        get_month_plan_by_id(&conn, &id)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok(Json(item))
}

/// `PATCH /api/v1/planning/month-plans/:id` — updates name and/or body.
pub async fn patch_month_plan_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<MonthPlanPatchPayload>,
) -> Result<impl IntoResponse, AppError> {
    let id = id.trim().to_string();
    if id.is_empty() {
        return Err(AppError::bad_request("Month plan id is required."));
    }
    if payload.name.is_none() && payload.body.is_none() {
        return Err(AppError::bad_request(
            "Provide at least one of name or body.",
        ));
    }

    let db_path = state.db_path();

    let item = tokio::task::spawn_blocking(move || {
        let mut conn = open_conn(&db_path)?;
        if let Some(ref body) = payload.body {
            let recipe_ids = collect_recipe_ids_from_month_plan(body);
            assert_recipe_ids_exist(&conn, &recipe_ids)?;
        }
        // name field: Some(Some(s)) = set to s, Some(None) = set to null, None = don't touch
        let name_arg: Option<Option<&str>> = payload.name.as_deref().map(Some);
        let body_ref = payload.body.as_ref();
        update_month_plan(&mut conn, &id, name_arg, body_ref)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok(Json(item))
}

/// `DELETE /api/v1/planning/month-plans/:id` — deletes a month plan.
pub async fn delete_month_plan_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let id = id.trim().to_string();
    if id.is_empty() {
        return Err(AppError::bad_request("Month plan id is required."));
    }

    let db_path = state.db_path();

    tokio::task::spawn_blocking(move || {
        let conn = open_conn(&db_path)?;
        delete_month_plan(&conn, &id)
    })
    .await
    .map_err(|e| AppError::planning_unexpected(format!("task panicked: {e}")))?
    .map_err(AppError::from_planning_repo)?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
