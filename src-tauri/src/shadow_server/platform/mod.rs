//! Cross-slice platform types for the Desktop Local API.

pub mod redaction;
pub mod repo_error;

pub use redaction::{is_sensitive_key, redact_log_fields, redact_map, redact_sensitive_text};
pub use repo_error::RepoError;
