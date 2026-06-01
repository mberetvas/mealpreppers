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
