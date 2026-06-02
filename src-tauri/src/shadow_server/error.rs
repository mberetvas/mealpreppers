//! H3-compatible error response shape for the Desktop Local API.
//!
//! All handler errors return a JSON body matching the H3 / ofetch error envelope
//! (`statusCode`, `statusMessage`, optional `message`, optional `data`) so the
//! existing Nuxt `$fetch` error handling works without changes.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::shadow_server::platform::RepoError;

/// JSON body shape that mirrors H3 / ofetch error responses.
#[derive(Serialize)]
pub struct H3ErrorBody {
    #[serde(rename = "statusCode")]
    pub status_code: u16,
    #[serde(rename = "statusMessage")]
    pub status_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// Typed error that converts into an H3-shaped JSON response.
pub struct AppError {
    status: StatusCode,
    status_message: &'static str,
    message: Option<String>,
    data: Option<Value>,
}

impl AppError {
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            status_message: "Unauthorized",
            message: Some(message.into()),
            data: None,
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            status_message: "Not Found",
            message: Some(message.into()),
            data: None,
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            status_message: "Bad Request",
            message: Some(message.into()),
            data: None,
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            status_message: "Internal Server Error",
            message: Some(message.into()),
            data: None,
        }
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            status_message: "Forbidden",
            message: Some(message.into()),
            data: None,
        }
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            status_message: "Conflict",
            message: Some(message.into()),
            data: None,
        }
    }

    /// `400` with `data.missingRecipeIds` — used when a weekplan/month-plan references unknown recipes.
    pub fn missing_recipe_ids(missing: Vec<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            status_message: "Bad Request",
            message: Some("One or more recipe ids are not in the catalog.".to_string()),
            data: Some(serde_json::json!({ "missingRecipeIds": missing })),
        }
    }

    /// `500` with `data.errorId` — used for unexpected planner failures to allow support correlation.
    pub fn planning_unexpected(error_id: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            status_message: "Internal Server Error",
            message: Some("The planner could not complete this request.".to_string()),
            data: Some(serde_json::json!({ "errorId": error_id.into() })),
        }
    }

    /// `422` — publisher returned a login/SSO wall instead of recipe content.
    pub fn unprocessable(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNPROCESSABLE_ENTITY,
            status_message: "Unprocessable Entity",
            message: Some(message.into()),
            data: None,
        }
    }

    /// `502` — upstream HTTP fetch failed (network or remote server error).
    pub fn bad_gateway(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            status_message: "Bad Gateway",
            message: Some(message.into()),
            data: None,
        }
    }

    /// `501` with `data.code = "desktop.api.not_implemented"` per the cutover feature gate contract.
    #[allow(dead_code)]
    pub fn not_implemented() -> Self {
        Self {
            status: StatusCode::NOT_IMPLEMENTED,
            status_message: "Not Implemented",
            message: Some(
                "This endpoint is not yet implemented in the Desktop Local API".to_string(),
            ),
            data: Some(serde_json::json!({ "code": "desktop.api.not_implemented" })),
        }
    }

    /// Maps [`RepoError`] from the Recipe Catalog slice to an H3-shaped response.
    pub fn from_recipe_catalog_repo(e: RepoError) -> Self {
        match e {
            RepoError::NotFound(msg) => AppError::not_found(msg),
            RepoError::Forbidden(msg) => AppError::forbidden(msg),
            RepoError::InvalidRecipeIds { missing } => AppError::missing_recipe_ids(missing),
            RepoError::DeprecatedList(msg) => AppError::conflict(msg),
            RepoError::Storage(msg) => AppError::internal(msg),
        }
    }

    /// Maps [`RepoError`] from the Planning slice to an H3-shaped response.
    pub fn from_planning_repo(e: RepoError) -> Self {
        match e {
            RepoError::NotFound(msg) => AppError::not_found(msg),
            RepoError::Forbidden(msg) => AppError::forbidden(msg),
            RepoError::InvalidRecipeIds { missing } => AppError::missing_recipe_ids(missing),
            RepoError::DeprecatedList(msg) => AppError::conflict(msg),
            RepoError::Storage(_) => {
                let error_id = Uuid::new_v4().to_string();
                AppError::planning_unexpected(error_id)
            }
        }
    }

    /// Maps [`RepoError`] from the Shopping List slice to an H3-shaped response.
    pub fn from_shopping_list_repo(e: RepoError) -> Self {
        match e {
            RepoError::NotFound(m) => AppError::not_found(m),
            RepoError::Forbidden(m) => AppError::forbidden(m),
            RepoError::InvalidRecipeIds { missing } => AppError::missing_recipe_ids(missing),
            RepoError::DeprecatedList(m) => AppError::conflict(m),
            RepoError::Storage(_) => AppError::internal("Unexpected database error."),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let body = H3ErrorBody {
            status_code: self.status.as_u16(),
            status_message: self.status_message.to_string(),
            message: self.message,
            data: self.data,
        };
        (self.status, Json(body)).into_response()
    }
}
