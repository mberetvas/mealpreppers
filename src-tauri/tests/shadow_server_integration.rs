/// Integration tests for the **Desktop Local API** shadow server (phase 1 platform milestone).
///
/// Each test starts a fresh server against an ephemeral temp directory so there is
/// no cross-test DB state and no interaction with the Nitro / Drizzle database.
use mealprepper_lib::shadow_server;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

struct TestServer {
    pub port: u16,
    _state: shadow_server::ShadowServerState,
    _temp: tempfile::TempDir,
}

impl TestServer {
    fn start(token: Option<&str>) -> Self {
        let temp = tempfile::TempDir::new().expect("tempdir");
        let state = shadow_server::start(temp.path(), token).expect("shadow server start");
        let port = state.port;
        TestServer {
            port,
            _state: state,
            _temp: temp,
        }
    }

    fn url(&self, path: &str) -> String {
        format!("http://127.0.0.1:{}{path}", self.port)
    }
}

/// Performs a GET with optional headers, returns `(status_code, body_string)`.
///
/// Uses `http_status_as_error(false)` so 4xx/5xx come back as `Ok(Response)`,
/// enabling tests to inspect both the status code and the error JSON body.
fn http_get(url: &str, headers: &[(&str, &str)]) -> (u16, String) {
    // Build a per-call agent with http_status_as_error disabled so 4xx/5xx
    // don't short-circuit before we can read the response body.
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();

    let mut req = agent.get(url);
    for (name, value) in headers {
        req = req.header(*name, *value);
    }

    let mut resp = req.call().expect("no transport error expected");
    let status = resp.status().as_u16();
    let body = resp.body_mut().read_to_string().unwrap_or_default();
    (status, body)
}

// ---------------------------------------------------------------------------
// /health endpoint
// ---------------------------------------------------------------------------

#[test]
fn health_returns_200_with_ok_body() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(&srv.url("/health"), &[]);
    assert_eq!(status, 200, "expected 200 from /health, body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("health body is JSON");
    assert_eq!(json["ok"], true, "expected ok=true, got: {json}");
}

#[test]
fn health_is_unauthenticated_when_token_configured() {
    let srv = TestServer::start(Some("some-secret-token"));
    // /health must succeed with no token header
    let (status, body) = http_get(&srv.url("/health"), &[]);
    assert_eq!(
        status, 200,
        "/health should be unauthenticated even when DESKTOP_TOKEN is set, body: {body}"
    );
}

// ---------------------------------------------------------------------------
// Desktop token gate
// ---------------------------------------------------------------------------

#[test]
fn api_route_rejected_without_token_when_enforced() {
    let srv = TestServer::start(Some("correct-token"));
    let (status, _body) = http_get(&srv.url("/api/v1/stub"), &[]);
    assert_eq!(status, 401, "expected 401 when no token header is sent");
}

#[test]
fn api_route_rejected_with_wrong_token() {
    let srv = TestServer::start(Some("correct-token"));
    let (status, _body) =
        http_get(&srv.url("/api/v1/stub"), &[("x-desktop-token", "wrong-token")]);
    assert_eq!(status, 401, "expected 401 for wrong token value");
}

#[test]
fn api_route_accepted_with_correct_token() {
    let srv = TestServer::start(Some("correct-token"));
    let (status, body) =
        http_get(&srv.url("/api/v1/stub"), &[("x-desktop-token", "correct-token")]);
    assert_eq!(
        status, 200,
        "expected 200 with correct token, body: {body}"
    );
}

#[test]
fn api_route_accessible_without_token_when_not_enforced() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(&srv.url("/api/v1/stub"), &[]);
    assert_eq!(
        status, 200,
        "when no token is configured, /api routes should be open, body: {body}"
    );
}

// ---------------------------------------------------------------------------
// Golden H3 error JSON
// ---------------------------------------------------------------------------

#[test]
fn token_rejection_returns_h3_error_shape() {
    let srv = TestServer::start(Some("secret"));
    let (status, body) = http_get(&srv.url("/api/v1/stub"), &[]);
    assert_eq!(status, 401);

    let json: serde_json::Value = serde_json::from_str(&body).expect("error body is JSON");
    assert_eq!(json["statusCode"], 401, "H3 statusCode field");
    assert_eq!(json["statusMessage"], "Unauthorized", "H3 statusMessage field");
    assert!(
        json["message"].as_str().is_some(),
        "H3 message field should be a string"
    );
}

// ---------------------------------------------------------------------------
// Migrations (SQLite schema smoke test)
// ---------------------------------------------------------------------------

#[test]
fn migrations_apply_on_fresh_database() {
    let temp = tempfile::TempDir::new().expect("tempdir");
    let db_path = temp.path().join("test.db");

    mealprepper_lib::shadow_server::db::open_and_migrate(&db_path)
        .expect("migrations should succeed on empty DB");

    // Verify schema was applied by opening and querying a migrated table
    let conn = rusqlite::Connection::open(&db_path).expect("open after migrate");
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM recipes", [], |row| row.get(0))
        .expect("recipes table should exist after migration");
    assert_eq!(count, 0, "fresh DB should have 0 recipes");
}

#[test]
fn migrations_are_idempotent() {
    let temp = tempfile::TempDir::new().expect("tempdir");
    let db_path = temp.path().join("idempotent.db");

    // Apply twice — should not error
    mealprepper_lib::shadow_server::db::open_and_migrate(&db_path)
        .expect("first migration run");
    mealprepper_lib::shadow_server::db::open_and_migrate(&db_path)
        .expect("second migration run should be idempotent");
}

// ---------------------------------------------------------------------------
// Request context (Trace ID + Planning Principal on stub route)
// ---------------------------------------------------------------------------

#[test]
fn stub_route_returns_trace_id_and_planning_principal() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(&srv.url("/api/v1/stub"), &[]);
    assert_eq!(status, 200);

    let json: serde_json::Value = serde_json::from_str(&body).expect("stub body is JSON");
    assert!(
        json["traceId"].as_str().is_some_and(|s| !s.is_empty()),
        "traceId should be a non-empty string"
    );
    assert!(
        json["planningUserId"].as_str().is_some_and(|s| !s.is_empty()),
        "planningUserId should be a non-empty string"
    );
}

#[test]
fn stub_route_echoes_provided_trace_id_header() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(
        &srv.url("/api/v1/stub"),
        &[("x-trace-id", "my-custom-trace-id")],
    );
    assert_eq!(status, 200);

    let json: serde_json::Value = serde_json::from_str(&body).expect("stub body is JSON");
    assert_eq!(
        json["traceId"].as_str(),
        Some("my-custom-trace-id"),
        "should echo the x-trace-id header"
    );
}
