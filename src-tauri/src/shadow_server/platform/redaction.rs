//! Shared **Log Redaction** policy for consolidation and platform logging.
//!
//! Mirrors `server/utils/redaction.ts` — sensitive keys are masked before
//! structured payloads are logged.

use std::collections::HashMap;

/// Lowercase header/field names replaced with `[REDACTED]` in log output.
const SENSITIVE_KEYS: &[&str] = &[
    "password",
    "token",
    "secret",
    "authorization",
    "auth",
    "apikey",
    "api_key",
    "credential",
    "credentials",
    "ssn",
    "credit_card",
    "cvv",
    "pin",
    "cookie",
    "openrouter_api_key",
    "openrouterapikey",
];

/// Returns true when `key` matches a sensitive field name (case-insensitive).
pub fn is_sensitive_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    SENSITIVE_KEYS.iter().any(|&s| s == lower)
}

/// Copies `data`, redacting values whose keys match [`is_sensitive_key`].
pub fn redact_map(data: &HashMap<String, String>) -> HashMap<String, String> {
    data.iter()
        .map(|(key, value)| {
            if is_sensitive_key(key) {
                (key.clone(), "[REDACTED]".to_string())
            } else {
                (key.clone(), value.clone())
            }
        })
        .collect()
}

/// Masks bearer tokens and common API-key patterns in free-form log text.
pub fn redact_sensitive_text(text: &str) -> String {
    let mut out = text.to_string();
    if let Some(start) = out.find("Bearer ") {
        let rest = &out[start + 7..];
        let end = rest
            .find(|c: char| c.is_whitespace() || c == '"' || c == '\'')
            .unwrap_or(rest.len());
        let end = start + 7 + end;
        out.replace_range(start..end, "Bearer [REDACTED]");
    }
    for prefix in ["sk-or-", "sk-"] {
        while let Some(start) = out.find(prefix) {
            let rest = &out[start..];
            let end = rest
                .find(|c: char| !c.is_ascii_alphanumeric() && c != '-' && c != '_')
                .unwrap_or(rest.len());
            out.replace_range(start..start + end, "[REDACTED]");
        }
    }
    out
}

/// Formats key/value pairs for log lines, redacting sensitive keys.
pub fn redact_log_fields(fields: &[(&str, &str)]) -> String {
    fields
        .iter()
        .map(|(key, value)| {
            if is_sensitive_key(key) {
                format!("{key}=[REDACTED]")
            } else {
                format!("{key}={value}")
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_openrouter_api_key_field_names() {
        let mut data = HashMap::new();
        data.insert("openrouter_api_key".to_string(), "sk-secret".to_string());
        data.insert("plan_id".to_string(), "plan-1".to_string());

        let redacted = redact_map(&data);
        assert_eq!(
            redacted.get("openrouter_api_key"),
            Some(&"[REDACTED]".to_string())
        );
        assert_eq!(redacted.get("plan_id"), Some(&"plan-1".to_string()));
    }

    #[test]
    fn redact_sensitive_text_masks_bearer_and_sk_prefix() {
        let text = "auth failed Bearer sk-or-v1-secret-key and sk-abc123 done";
        let redacted = redact_sensitive_text(text);
        assert!(redacted.contains("Bearer [REDACTED]"));
        assert!(!redacted.contains("sk-or-v1-secret-key"));
        assert!(!redacted.contains("sk-abc123"));
    }

    #[test]
    fn redact_log_fields_masks_authorization() {
        let line =
            redact_log_fields(&[("authorization", "Bearer sk-live-key"), ("plan_id", "abc")]);
        assert!(line.contains("authorization=[REDACTED]"));
        assert!(line.contains("plan_id=abc"));
        assert!(!line.contains("sk-live-key"));
    }
}
