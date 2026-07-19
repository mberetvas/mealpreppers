/// Integration tests for the **Desktop Local API** shadow server.
///
/// Phase 1 covers platform plumbing (health, token gate, migrations, request context).
/// Phase 2 (this file) adds Recipe Catalog CRUD, options, bulk-delete, and image tests.
///
/// Each test starts a fresh server against an ephemeral temp directory so there is
/// no cross-test DB state and no interaction with the Nitro / Drizzle database.
use mealprepper_lib::shadow_server;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

struct TestServer {
    pub port: u16,
    pub data_dir: std::path::PathBuf,
    _state: shadow_server::ShadowServerState,
    _temp: tempfile::TempDir,
}

impl TestServer {
    fn start(token: Option<&str>) -> Self {
        let temp = tempfile::TempDir::new().expect("tempdir");
        let state = shadow_server::start(temp.path(), token).expect("shadow server start");
        let port = state.port;
        let data_dir = temp.path().to_path_buf();
        TestServer {
            port,
            data_dir,
            _state: state,
            _temp: temp,
        }
    }

    fn url(&self, path: &str) -> String {
        format!("http://127.0.0.1:{}{path}", self.port)
    }

    /// Overwrites the `local-user-id` file so subsequent requests use a different
    /// Planning Principal. The change takes effect immediately because each request
    /// reads the file fresh.
    fn set_user_id(&self, user_id: &str) {
        std::fs::write(self.data_dir.join("local-user-id"), user_id).expect("write local-user-id");
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

/// Performs a POST with a JSON body, returns `(status_code, body_string)`.
fn http_post_json(url: &str, body: &serde_json::Value) -> (u16, String) {
    let json_bytes = serde_json::to_vec(body).expect("JSON serialization");
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();

    let mut req = agent.post(url);
    req = req.header("content-type", "application/json");
    let mut resp = req
        .send(json_bytes.as_slice())
        .expect("no transport error expected");
    let status = resp.status().as_u16();
    let body_str = resp.body_mut().read_to_string().unwrap_or_default();
    (status, body_str)
}

/// Performs a PUT with a JSON body, returns `(status_code, body_string)`.
fn http_put_json(url: &str, body: &serde_json::Value) -> (u16, String) {
    let json_bytes = serde_json::to_vec(body).expect("JSON serialization");
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();

    let mut req = agent.put(url);
    req = req.header("content-type", "application/json");
    let mut resp = req
        .send(json_bytes.as_slice())
        .expect("no transport error expected");
    let status = resp.status().as_u16();
    let body_str = resp.body_mut().read_to_string().unwrap_or_default();
    (status, body_str)
}

/// Performs a PATCH with a JSON body, returns `(status_code, body_string)`.
fn http_patch_json(url: &str, body: &serde_json::Value) -> (u16, String) {
    let json_bytes = serde_json::to_vec(body).expect("JSON serialization");
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();

    let req = agent.patch(url).header("content-type", "application/json");
    let mut resp = req
        .send(json_bytes.as_slice())
        .expect("no transport error expected");
    let status = resp.status().as_u16();
    let body_str = resp.body_mut().read_to_string().unwrap_or_default();
    (status, body_str)
}

/// Performs a DELETE request, returns `(status_code, body_string)`.
fn http_delete(url: &str) -> (u16, String) {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();

    let mut resp = agent
        .delete(url)
        .call()
        .expect("no transport error expected");
    let status = resp.status().as_u16();
    let body_str = resp.body_mut().read_to_string().unwrap_or_default();
    (status, body_str)
}

/// Builds a multipart/form-data body with a single file field.
fn build_multipart_body(
    field_name: &str,
    filename: &str,
    content_type: &str,
    data: &[u8],
) -> (Vec<u8>, String) {
    let boundary = "UrqTestBoundaryXXXXXXXX1234";
    let mut body: Vec<u8> = Vec::new();

    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!(
            "Content-Disposition: form-data; name=\"{field_name}\"; filename=\"{filename}\"\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(format!("Content-Type: {content_type}\r\n").as_bytes());
    body.extend_from_slice(b"\r\n");
    body.extend_from_slice(data);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

    let multipart_ct = format!("multipart/form-data; boundary={boundary}");
    (body, multipart_ct)
}

/// Performs a multipart POST with a single file field, returns `(status_code, body_string)`.
fn http_post_multipart(url: &str, filename: &str, data: &[u8], mime: &str) -> (u16, String) {
    let (body, content_type) = build_multipart_body("file", filename, mime, data);
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();

    let mut req = agent.post(url);
    req = req.header("content-type", &content_type);
    let mut resp = req
        .send(body.as_slice())
        .expect("no transport error expected");
    let status = resp.status().as_u16();
    let body_str = resp.body_mut().read_to_string().unwrap_or_default();
    (status, body_str)
}

/// Returns a minimal valid create-recipe JSON payload.
fn minimal_recipe_payload() -> serde_json::Value {
    serde_json::json!({
        "title": "Test Pasta",
        "ingredients": [{ "rawText": "100g pasta", "name": "pasta" }]
    })
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
    let (status, _body) = http_get(
        &srv.url("/api/v1/stub"),
        &[("x-desktop-token", "wrong-token")],
    );
    assert_eq!(status, 401, "expected 401 for wrong token value");
}

#[test]
fn api_route_accepted_with_correct_token() {
    let srv = TestServer::start(Some("correct-token"));
    let (status, body) = http_get(
        &srv.url("/api/v1/stub"),
        &[("x-desktop-token", "correct-token")],
    );
    assert_eq!(status, 200, "expected 200 with correct token, body: {body}");
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
    assert_eq!(
        json["statusMessage"], "Invalid or missing desktop token",
        "H3 statusMessage should carry the user-facing message"
    );
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
    mealprepper_lib::shadow_server::db::open_and_migrate(&db_path).expect("first migration run");
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
        json["planningUserId"]
            .as_str()
            .is_some_and(|s| !s.is_empty()),
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

// ---------------------------------------------------------------------------
// Recipe Catalog — List
// ---------------------------------------------------------------------------

#[test]
fn list_recipes_returns_empty_array_on_fresh_db() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(&srv.url("/api/v1/recipes"), &[]);
    assert_eq!(status, 200, "expected 200 from list recipes, body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("list body is JSON");
    assert!(json.is_array(), "expected array body");
    assert_eq!(
        json.as_array().unwrap().len(),
        0,
        "fresh DB should have no recipes"
    );
}

// ---------------------------------------------------------------------------
// Recipe Catalog — Create
// ---------------------------------------------------------------------------

#[test]
fn create_recipe_returns_200_with_recipe_body() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(&srv.url("/api/v1/recipes"), &minimal_recipe_payload());
    assert_eq!(status, 200, "expected 200 from create recipe, body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("create body is JSON");
    assert_eq!(json["title"], "Test Pasta");
    assert!(
        json["id"].as_str().is_some_and(|s| !s.is_empty()),
        "id should be non-empty"
    );
    assert!(
        json["ingredients"].is_array(),
        "ingredients should be array"
    );
    assert_eq!(json["ingredients"].as_array().unwrap().len(), 1);
    assert!(
        json["createdAt"].as_str().is_some(),
        "createdAt should be present"
    );
    assert!(
        json["updatedAt"].as_str().is_some(),
        "updatedAt should be present"
    );
    assert!(json["categories"].is_array(), "categories should be array");
    assert!(json["tags"].is_array(), "tags should be array");
}

#[test]
fn create_recipe_with_full_payload_round_trips() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({
        "title": "Full Recipe",
        "description": "A complete recipe",
        "sourceUrl": "https://example.com/recipe",
        "sourceHost": "example.com",
        "servings": 4,
        "prepTimeMinutes": 15,
        "cookTimeMinutes": 30,
        "totalTimeMinutes": 45,
        "difficulty": "medium",
        "categories": ["Lunch", "Italian"],
        "tags": ["Vegan", "Quick"],
        "ingredients": [
            { "rawText": "200g pasta", "name": "pasta", "quantity": 200.0, "unit": "g" }
        ],
        "steps": [
            { "text": "Boil the pasta." },
            { "text": "Serve." }
        ]
    });

    let (status, body) = http_post_json(&srv.url("/api/v1/recipes"), &payload);
    assert_eq!(status, 200, "body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["title"], "Full Recipe");
    assert_eq!(json["description"], "A complete recipe");
    assert_eq!(json["servings"], 4);
    assert_eq!(json["prepTimeMinutes"], 15);
    assert_eq!(json["categories"], serde_json::json!(["Lunch", "Italian"]));
    assert_eq!(json["tags"], serde_json::json!(["Vegan", "Quick"]));
    assert_eq!(json["steps"].as_array().unwrap().len(), 2);
}

#[test]
fn create_recipe_missing_title_returns_400() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({
        "ingredients": [{ "rawText": "100g pasta", "name": "pasta" }]
    });
    let (status, body) = http_post_json(&srv.url("/api/v1/recipes"), &payload);
    assert_eq!(status, 400, "missing title should return 400, body: {body}");
}

#[test]
fn create_recipe_missing_ingredients_returns_400() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({ "title": "No ingredients" });
    let (status, body) = http_post_json(&srv.url("/api/v1/recipes"), &payload);
    assert_eq!(
        status, 400,
        "missing ingredients should return 400, body: {body}"
    );
}

// ---------------------------------------------------------------------------
// Recipe Catalog — Get by ID
// ---------------------------------------------------------------------------

#[test]
fn get_recipe_by_id_returns_200() {
    let srv = TestServer::start(None);

    // Create first
    let (_, create_body) = http_post_json(&srv.url("/api/v1/recipes"), &minimal_recipe_payload());
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id field");

    // Then get
    let (status, body) = http_get(&srv.url(&format!("/api/v1/recipes/{id}")), &[]);
    assert_eq!(status, 200, "expected 200 from get recipe, body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["id"].as_str(), Some(id));
    assert_eq!(json["title"], "Test Pasta");
}

#[test]
fn get_recipe_not_found_returns_404() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(
        &srv.url("/api/v1/recipes/00000000-0000-0000-0000-000000000000"),
        &[],
    );
    assert_eq!(status, 404, "expected 404, body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("error body is JSON");
    assert_eq!(json["statusCode"], 404, "H3 statusCode field");
}

// ---------------------------------------------------------------------------
// Recipe Catalog — Update
// ---------------------------------------------------------------------------

#[test]
fn update_recipe_returns_updated_body() {
    let srv = TestServer::start(None);

    let (_, create_body) = http_post_json(&srv.url("/api/v1/recipes"), &minimal_recipe_payload());
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id field");

    let updated_payload = serde_json::json!({
        "title": "Updated Pasta",
        "ingredients": [{ "rawText": "200g pasta", "name": "pasta" }]
    });
    let (status, body) =
        http_put_json(&srv.url(&format!("/api/v1/recipes/{id}")), &updated_payload);
    assert_eq!(status, 200, "expected 200 from update, body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["title"], "Updated Pasta");
    assert_eq!(json["id"].as_str(), Some(id));
}

#[test]
fn update_recipe_not_found_returns_404() {
    let srv = TestServer::start(None);
    let (status, body) = http_put_json(
        &srv.url("/api/v1/recipes/00000000-0000-0000-0000-000000000000"),
        &minimal_recipe_payload(),
    );
    assert_eq!(
        status, 404,
        "expected 404 for update on non-existent id, body: {body}"
    );
}

// ---------------------------------------------------------------------------
// Recipe Catalog — after create, list shows recipe
// ---------------------------------------------------------------------------

#[test]
fn list_recipes_shows_created_recipe() {
    let srv = TestServer::start(None);

    http_post_json(&srv.url("/api/v1/recipes"), &minimal_recipe_payload());

    let (status, body) = http_get(&srv.url("/api/v1/recipes"), &[]);
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(
        json.as_array().unwrap().len(),
        1,
        "list should contain the created recipe"
    );
    assert_eq!(json[0]["title"], "Test Pasta");
}

// ---------------------------------------------------------------------------
// Recipe Catalog — Options
// ---------------------------------------------------------------------------

#[test]
fn options_returns_categories_and_tags() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(&srv.url("/api/v1/recipes/options"), &[]);
    assert_eq!(status, 200, "expected 200 from options, body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert!(json["categories"].is_array(), "categories should be array");
    assert!(json["tags"].is_array(), "tags should be array");

    let categories: Vec<String> =
        serde_json::from_value(json["categories"].clone()).expect("categories array");
    let tags: Vec<String> = serde_json::from_value(json["tags"].clone()).expect("tags array");

    assert!(
        categories.contains(&"Lunch".to_string()),
        "should contain default category 'Lunch'"
    );
    assert!(
        categories.contains(&"Italian".to_string()),
        "should contain default category 'Italian'"
    );
    assert!(
        tags.contains(&"Vegan".to_string()),
        "should contain default tag 'Vegan'"
    );
    assert!(
        tags.contains(&"Quick".to_string()),
        "should contain default tag 'Quick'"
    );
}

#[test]
fn options_merges_stored_categories_and_tags() {
    let srv = TestServer::start(None);

    // Create recipe with a novel category and tag not in defaults
    let payload = serde_json::json!({
        "title": "Custom Recipe",
        "categories": ["MyCustomCategory"],
        "tags": ["MyCustomTag"],
        "ingredients": [{ "rawText": "1 item", "name": "item" }]
    });
    http_post_json(&srv.url("/api/v1/recipes"), &payload);

    let (_, body) = http_get(&srv.url("/api/v1/recipes/options"), &[]);
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");

    let categories: Vec<String> =
        serde_json::from_value(json["categories"].clone()).expect("categories");
    let tags: Vec<String> = serde_json::from_value(json["tags"].clone()).expect("tags");

    assert!(
        categories.contains(&"MyCustomCategory".to_string()),
        "stored custom category should appear in options"
    );
    assert!(
        tags.contains(&"MyCustomTag".to_string()),
        "stored custom tag should appear in options"
    );
}

// ---------------------------------------------------------------------------
// Recipe Catalog — Bulk delete
// ---------------------------------------------------------------------------

#[test]
fn bulk_delete_returns_deleted_count() {
    let srv = TestServer::start(None);

    let (_, body) = http_post_json(&srv.url("/api/v1/recipes"), &minimal_recipe_payload());
    let created: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    let id = created["id"].as_str().expect("id").to_string();

    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/bulk-delete"),
        &serde_json::json!({ "ids": [id] }),
    );
    assert_eq!(status, 200, "expected 200 from bulk-delete, body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["deleted"], 1, "should report 1 deleted");
}

#[test]
fn bulk_delete_empty_ids_returns_400() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/bulk-delete"),
        &serde_json::json!({ "ids": [] }),
    );
    assert_eq!(status, 400, "empty ids should return 400, body: {body}");
}

#[test]
fn bulk_delete_nonexistent_ids_returns_zero() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/bulk-delete"),
        &serde_json::json!({ "ids": ["00000000-0000-0000-0000-000000000000"] }),
    );
    assert_eq!(status, 200, "body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(
        json["deleted"], 0,
        "non-existent ids should report 0 deleted"
    );
}

#[test]
fn bulk_delete_removes_recipe_from_list() {
    let srv = TestServer::start(None);

    let (_, body) = http_post_json(&srv.url("/api/v1/recipes"), &minimal_recipe_payload());
    let created: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    let id = created["id"].as_str().expect("id").to_string();

    http_post_json(
        &srv.url("/api/v1/recipes/bulk-delete"),
        &serde_json::json!({ "ids": [id] }),
    );

    let (_, list_body) = http_get(&srv.url("/api/v1/recipes"), &[]);
    let list: serde_json::Value = serde_json::from_str(&list_body).expect("JSON");
    assert_eq!(
        list.as_array().unwrap().len(),
        0,
        "recipe should be gone after bulk delete"
    );
}

#[test]
fn bulk_delete_error_shape_matches_h3() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/bulk-delete"),
        &serde_json::json!({ "ids": [] }),
    );
    assert_eq!(status, 400);

    let json: serde_json::Value = serde_json::from_str(&body).expect("error body is JSON");
    assert_eq!(json["statusCode"], 400, "H3 statusCode field");
    assert!(
        json["statusMessage"].as_str().is_some(),
        "H3 statusMessage field should be a string"
    );
}

// ---------------------------------------------------------------------------
// Recipe images — upload and serve
// ---------------------------------------------------------------------------

/// Minimal valid 1×1 PNG bytes (67 bytes, well-formed PNG header + IHDR + IDAT + IEND).
const MINIMAL_PNG: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1×1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT length + type
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, // compressed pixel
    0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, // IDAT CRC
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND length + type
    0x44, 0xAE, 0x42, 0x60, 0x82, // IEND CRC
];

#[test]
fn upload_image_returns_loopback_url() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_multipart(
        &srv.url("/api/v1/recipes/upload-image"),
        "test.png",
        MINIMAL_PNG,
        "image/png",
    );
    assert_eq!(status, 200, "expected 200 from upload-image, body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    let url = json["url"].as_str().expect("url field should be a string");
    assert!(
        url.starts_with("http://127.0.0.1:"),
        "url should start with loopback origin, got: {url}"
    );
    assert!(
        url.contains("/recipe-images/"),
        "url should contain /recipe-images/ path, got: {url}"
    );
    assert!(
        url.ends_with(".png"),
        "url should end with .png extension, got: {url}"
    );
}

#[test]
fn upload_image_no_file_returns_400() {
    let srv = TestServer::start(None);
    // POST with no multipart body
    let (status, _body) = http_post_json(
        &srv.url("/api/v1/recipes/upload-image"),
        &serde_json::json!({}),
    );
    assert_eq!(status, 400, "missing file field should return 400");
}

#[test]
fn serve_recipe_image_not_found_returns_404() {
    let srv = TestServer::start(None);
    let (status, _body) = http_get(
        &srv.url("/recipe-images/00000000-0000-0000-0000-000000000000.png"),
        &[],
    );
    assert_eq!(status, 404, "non-existent image should return 404");
}

#[test]
fn serve_recipe_image_invalid_filename_returns_400() {
    let srv = TestServer::start(None);
    let (status, _body) = http_get(&srv.url("/recipe-images/../../../etc/passwd"), &[]);
    // Path traversal attempts should be rejected
    assert!(
        status == 400 || status == 404,
        "path traversal should be rejected, got: {status}"
    );
}

#[test]
fn uploaded_image_can_be_served() {
    let srv = TestServer::start(None);

    // Upload
    let (upload_status, upload_body) = http_post_multipart(
        &srv.url("/api/v1/recipes/upload-image"),
        "photo.png",
        MINIMAL_PNG,
        "image/png",
    );
    assert_eq!(upload_status, 200, "upload failed: {upload_body}");

    let upload_json: serde_json::Value = serde_json::from_str(&upload_body).expect("JSON");
    let image_url = upload_json["url"].as_str().expect("url field");

    // Serve — the URL already contains the full loopback origin, use it directly
    let (serve_status, _serve_body) = http_get(image_url, &[]);
    assert_eq!(serve_status, 200, "uploaded image should be servable");
}

#[test]
fn serve_recipe_image_returns_correct_content_type() {
    let srv = TestServer::start(None);

    let (_, upload_body) = http_post_multipart(
        &srv.url("/api/v1/recipes/upload-image"),
        "photo.png",
        MINIMAL_PNG,
        "image/png",
    );
    let upload_json: serde_json::Value = serde_json::from_str(&upload_body).expect("JSON");
    let image_url = upload_json["url"].as_str().expect("url");

    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();
    let resp = agent.get(image_url).call().expect("serve request");
    assert_eq!(resp.status().as_u16(), 200);
    let ct = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(
        ct.starts_with("image/png"),
        "expected image/png content-type, got: {ct}"
    );
}

// ---------------------------------------------------------------------------
// Recipe images — unauthenticated when token is configured
// ---------------------------------------------------------------------------

#[test]
fn recipe_images_are_unauthenticated_when_token_configured() {
    let srv = TestServer::start(Some("my-secret-token"));

    // /recipe-images must be accessible without a token
    let (status, _body) = http_get(
        &srv.url("/recipe-images/00000000-0000-0000-0000-000000000000.png"),
        &[],
    );
    // 404 means we got through (image doesn't exist); 401 would mean token gate fired
    assert_ne!(status, 401, "/recipe-images should not require a token");
}

// ---------------------------------------------------------------------------
// Planning helpers
// ---------------------------------------------------------------------------

/// Returns a minimal valid create-weekplan JSON payload (no recipe references).
fn minimal_weekplan_payload(name: &str) -> serde_json::Value {
    serde_json::json!({
        "name": name,
        "body": {
            "version": "1",
            "days": {
                "1": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "2": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "3": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "4": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "5": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "6": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "7": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } }
            }
        }
    })
}

/// Server-computed fingerprint for [`minimal_weekplan_payload`] bodies (TS parity).
fn minimal_weekplan_source_fingerprint() -> String {
    use mealprepper_lib::shadow_server::planning::{
        models::{DayMeals, RecipeIdSlot, WeekPlanV1},
        repository::compute_source_fingerprint,
    };
    use std::collections::HashMap;

    let empty_slot = || RecipeIdSlot { recipe_id: None };
    let empty_day = || DayMeals {
        breakfast: empty_slot(),
        lunch: empty_slot(),
        dinner: empty_slot(),
    };
    let mut days = HashMap::new();
    for day in ["1", "2", "3", "4", "5", "6", "7"] {
        days.insert(day.to_string(), empty_day());
    }
    compute_source_fingerprint(&WeekPlanV1 {
        version: "1".to_string(),
        days,
    })
}

/// Returns a minimal valid create-month-plan JSON payload (no name, no recipe references).
fn minimal_month_plan_payload() -> serde_json::Value {
    serde_json::json!({
        "body": {
            "version": "1",
            "weeks": [null, null, null, null]
        }
    })
}

// ---------------------------------------------------------------------------
// Planning — Saved Weekplans: list
// ---------------------------------------------------------------------------

#[test]
fn list_saved_weekplans_returns_empty_array_on_fresh_db() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(&srv.url("/api/v1/saved-weekplans"), &[]);
    assert_eq!(status, 200, "expected 200, body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert!(json.is_array(), "expected array");
    assert_eq!(json.as_array().unwrap().len(), 0);
}

// ---------------------------------------------------------------------------
// Planning — Saved Weekplans: create
// ---------------------------------------------------------------------------

#[test]
fn create_saved_weekplan_returns_200_with_row() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Week A"),
    );
    assert_eq!(status, 200, "expected 200, body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["name"], "Week A");
    assert!(
        json["id"].as_str().is_some_and(|s| !s.is_empty()),
        "id present"
    );
    assert!(json["body"].is_object(), "body present");
    assert!(json["createdAt"].as_str().is_some(), "createdAt present");
    assert!(json["updatedAt"].as_str().is_some(), "updatedAt present");
    assert_eq!(json["hasSavedShoppingList"], false);
    assert_eq!(json["shoppingListDeprecated"], false);
}

#[test]
fn create_saved_weekplan_missing_name_returns_400() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({
        "body": { "version": "1", "days": {} }
    });
    let (status, body) = http_post_json(&srv.url("/api/v1/saved-weekplans"), &payload);
    assert_eq!(status, 400, "body: {body}");
}

#[test]
fn create_saved_weekplan_missing_body_returns_400() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({ "name": "No body" });
    let (status, body) = http_post_json(&srv.url("/api/v1/saved-weekplans"), &payload);
    assert_eq!(status, 400, "body: {body}");
}

#[test]
fn create_saved_weekplan_with_unknown_recipe_returns_400_with_missing_ids() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({
        "name": "Bad refs",
        "body": {
            "version": "1",
            "days": {
                "1": {
                    "breakfast": { "recipeId": "nonexistent-recipe-id" },
                    "lunch": { "recipeId": null },
                    "dinner": { "recipeId": null }
                }
            }
        }
    });
    let (status, body) = http_post_json(&srv.url("/api/v1/saved-weekplans"), &payload);
    assert_eq!(status, 400, "expected 400 for unknown recipe, body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    let missing = json["data"]["missingRecipeIds"]
        .as_array()
        .expect("missingRecipeIds array");
    assert!(
        missing
            .iter()
            .any(|v| v.as_str() == Some("nonexistent-recipe-id")),
        "expected unknown id in missingRecipeIds, got: {missing:?}"
    );
}

// ---------------------------------------------------------------------------
// Planning — Saved Weekplans: get by ID
// ---------------------------------------------------------------------------

#[test]
fn get_saved_weekplan_returns_200() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Week B"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_get(&srv.url(&format!("/api/v1/saved-weekplans/{id}")), &[]);
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["id"].as_str(), Some(id));
    assert_eq!(json["name"], "Week B");
}

#[test]
fn get_saved_weekplan_not_found_returns_404() {
    let srv = TestServer::start(None);
    let (status, _) = http_get(&srv.url("/api/v1/saved-weekplans/nonexistent-id"), &[]);
    assert_eq!(status, 404);
}

// ---------------------------------------------------------------------------
// Planning — Saved Weekplans: patch
// ---------------------------------------------------------------------------

#[test]
fn patch_saved_weekplan_name_returns_updated_row() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Original Name"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_patch_json(
        &srv.url(&format!("/api/v1/saved-weekplans/{id}")),
        &serde_json::json!({ "name": "Updated Name" }),
    );
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["name"], "Updated Name");
}

#[test]
fn patch_saved_weekplan_no_fields_returns_400() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("W"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_patch_json(
        &srv.url(&format!("/api/v1/saved-weekplans/{id}")),
        &serde_json::json!({}),
    );
    assert_eq!(status, 400, "body: {body}");
}

#[test]
fn patch_saved_weekplan_with_unknown_recipe_returns_400() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Patch Test"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let bad_body = serde_json::json!({
        "body": {
            "version": "1",
            "days": {
                "3": {
                    "breakfast": { "recipeId": "ghost-recipe" },
                    "lunch": { "recipeId": null },
                    "dinner": { "recipeId": null }
                }
            }
        }
    });
    let (status, body) = http_patch_json(
        &srv.url(&format!("/api/v1/saved-weekplans/{id}")),
        &bad_body,
    );
    assert_eq!(status, 400, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert!(json["data"]["missingRecipeIds"].is_array());
}

// ---------------------------------------------------------------------------
// Planning — Saved Weekplans: delete
// ---------------------------------------------------------------------------

#[test]
fn delete_saved_weekplan_returns_ok_and_removes_row() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Delete me"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_delete(&srv.url(&format!("/api/v1/saved-weekplans/{id}")));
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["ok"], true);

    let (get_status, _) = http_get(&srv.url(&format!("/api/v1/saved-weekplans/{id}")), &[]);
    assert_eq!(get_status, 404, "should be gone after delete");
}

#[test]
fn delete_saved_weekplan_not_found_returns_404() {
    let srv = TestServer::start(None);
    let (status, _) = http_delete(&srv.url("/api/v1/saved-weekplans/no-such-id"));
    assert_eq!(status, 404);
}

// ---------------------------------------------------------------------------
// Planning — Saved Weekplans: principal isolation
// ---------------------------------------------------------------------------

#[test]
fn saved_weekplan_principal_isolation_other_user_gets_403() {
    let srv = TestServer::start(None);

    // Create as user-A
    srv.set_user_id("user-A");
    let (status, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Private"),
    );
    assert_eq!(status, 200, "create failed: {create_body}");
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    // Switch to user-B; get should 403
    srv.set_user_id("user-B");
    let (get_status, _) = http_get(&srv.url(&format!("/api/v1/saved-weekplans/{id}")), &[]);
    assert_eq!(get_status, 403, "different principal should get 403");
}

#[test]
fn saved_weekplan_list_is_scoped_to_principal() {
    let srv = TestServer::start(None);

    // Create two plans as user-X
    srv.set_user_id("user-X");
    http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Plan X1"),
    );
    http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Plan X2"),
    );

    // Switch to user-Y; list should be empty
    srv.set_user_id("user-Y");
    let (status, body) = http_get(&srv.url("/api/v1/saved-weekplans"), &[]);
    assert_eq!(status, 200);
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(
        json.as_array().unwrap().len(),
        0,
        "user-Y should see no plans created by user-X"
    );
}

// ---------------------------------------------------------------------------
// Planning — Month Plans: list
// ---------------------------------------------------------------------------

#[test]
fn list_month_plans_returns_empty_array_on_fresh_db() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(&srv.url("/api/v1/planning/month-plans"), &[]);
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert!(json.is_array());
    assert_eq!(json.as_array().unwrap().len(), 0);
}

// ---------------------------------------------------------------------------
// Planning — Month Plans: create
// ---------------------------------------------------------------------------

#[test]
fn create_month_plan_returns_200_with_row() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/planning/month-plans"),
        &minimal_month_plan_payload(),
    );
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert!(json["id"].as_str().is_some_and(|s| !s.is_empty()));
    assert!(json["body"].is_object());
    assert!(json["createdAt"].as_str().is_some());
    assert!(json["updatedAt"].as_str().is_some());
}

#[test]
fn create_month_plan_with_name() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({
        "name": "January",
        "body": { "version": "1", "weeks": [null, null, null, null] }
    });
    let (status, body) = http_post_json(&srv.url("/api/v1/planning/month-plans"), &payload);
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["name"], "January");
}

#[test]
fn create_month_plan_missing_body_returns_400() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({ "name": "No body" });
    let (status, body) = http_post_json(&srv.url("/api/v1/planning/month-plans"), &payload);
    assert_eq!(status, 400, "body: {body}");
}

#[test]
fn create_month_plan_with_unknown_recipe_returns_400_with_missing_ids() {
    let srv = TestServer::start(None);
    let payload = serde_json::json!({
        "body": {
            "version": "1",
            "weeks": [
                {
                    "version": "1",
                    "days": {
                        "1": {
                            "breakfast": { "recipeId": "ghost-month-recipe" },
                            "lunch": { "recipeId": null },
                            "dinner": { "recipeId": null }
                        }
                    }
                },
                null, null, null
            ]
        }
    });
    let (status, body) = http_post_json(&srv.url("/api/v1/planning/month-plans"), &payload);
    assert_eq!(status, 400, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    let missing = json["data"]["missingRecipeIds"]
        .as_array()
        .expect("missingRecipeIds");
    assert!(
        missing
            .iter()
            .any(|v| v.as_str() == Some("ghost-month-recipe")),
        "expected ghost-month-recipe in missing, got: {missing:?}"
    );
}

// ---------------------------------------------------------------------------
// Planning — Month Plans: get by ID
// ---------------------------------------------------------------------------

#[test]
fn get_month_plan_returns_200() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/planning/month-plans"),
        &minimal_month_plan_payload(),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_get(&srv.url(&format!("/api/v1/planning/month-plans/{id}")), &[]);
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["id"].as_str(), Some(id));
}

#[test]
fn get_month_plan_not_found_returns_404() {
    let srv = TestServer::start(None);
    let (status, _) = http_get(&srv.url("/api/v1/planning/month-plans/no-such-id"), &[]);
    assert_eq!(status, 404);
}

// ---------------------------------------------------------------------------
// Planning — Month Plans: patch
// ---------------------------------------------------------------------------

#[test]
fn patch_month_plan_name_returns_updated_row() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/planning/month-plans"),
        &minimal_month_plan_payload(),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_patch_json(
        &srv.url(&format!("/api/v1/planning/month-plans/{id}")),
        &serde_json::json!({ "name": "February" }),
    );
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["name"], "February");
}

#[test]
fn patch_month_plan_no_fields_returns_400() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/planning/month-plans"),
        &minimal_month_plan_payload(),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_patch_json(
        &srv.url(&format!("/api/v1/planning/month-plans/{id}")),
        &serde_json::json!({}),
    );
    assert_eq!(status, 400, "body: {body}");
}

// ---------------------------------------------------------------------------
// Planning — Month Plans: delete
// ---------------------------------------------------------------------------

#[test]
fn delete_month_plan_returns_ok_and_removes_row() {
    let srv = TestServer::start(None);
    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/planning/month-plans"),
        &minimal_month_plan_payload(),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_delete(&srv.url(&format!("/api/v1/planning/month-plans/{id}")));
    assert_eq!(status, 200, "body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["ok"], true);

    let (get_status, _) = http_get(&srv.url(&format!("/api/v1/planning/month-plans/{id}")), &[]);
    assert_eq!(get_status, 404, "should be gone after delete");
}

#[test]
fn delete_month_plan_not_found_returns_404() {
    let srv = TestServer::start(None);
    let (status, _) = http_delete(&srv.url("/api/v1/planning/month-plans/ghost-id"));
    assert_eq!(status, 404);
}

// ---------------------------------------------------------------------------
// Planning — end-to-end: create recipe then reference it in a weekplan
// ---------------------------------------------------------------------------

#[test]
fn weekplan_with_known_recipe_id_succeeds() {
    let srv = TestServer::start(None);

    // Create a recipe so the ID is known
    let (recipe_status, recipe_body) =
        http_post_json(&srv.url("/api/v1/recipes"), &minimal_recipe_payload());
    assert_eq!(recipe_status, 200, "recipe create failed: {recipe_body}");
    let recipe: serde_json::Value = serde_json::from_str(&recipe_body).expect("JSON");
    let recipe_id = recipe["id"].as_str().expect("recipe id");

    // Reference the real recipe in the weekplan
    let payload = serde_json::json!({
        "name": "Plan with Recipe",
        "body": {
            "version": "1",
            "days": {
                "1": {
                    "breakfast": { "recipeId": recipe_id },
                    "lunch": { "recipeId": null },
                    "dinner": { "recipeId": null }
                }
            }
        }
    });
    let (status, body) = http_post_json(&srv.url("/api/v1/saved-weekplans"), &payload);
    assert_eq!(
        status, 200,
        "weekplan with known recipe should succeed, body: {body}"
    );
}

// ---------------------------------------------------------------------------
// Planner-safe cutover — Rust primary API topology (issue 0024)
// ---------------------------------------------------------------------------

/// `ShadowServerState` must expose an `api_base()` method returning the loopback
/// origin so callers (startup, bootstrap) can build URLs without knowing internals.
#[test]
fn primary_server_state_api_base_matches_port() {
    let temp = tempfile::TempDir::new().expect("tempdir");
    let state = shadow_server::start(temp.path(), None).expect("start primary server");
    let expected = format!("http://127.0.0.1:{}", state.port);
    assert_eq!(
        state.api_base(),
        expected,
        "api_base() should return loopback URL matching port"
    );
}

/// When no token is configured, `ShadowServerState.token` should be `None`.
#[test]
fn primary_server_state_no_token_when_none_configured() {
    let temp = tempfile::TempDir::new().expect("tempdir");
    let state = shadow_server::start(temp.path(), None).expect("start primary server");
    assert!(
        state.token.is_none(),
        "token should be None when not configured"
    );
}

/// When a token is passed to `start()`, `ShadowServerState.token` should echo it back
/// so the Tauri startup can inject the same token into the WebView bootstrap script.
#[test]
fn primary_server_state_token_matches_input() {
    let temp = tempfile::TempDir::new().expect("tempdir");
    let state =
        shadow_server::start(temp.path(), Some("launch-token-abc")).expect("start primary server");
    assert_eq!(
        state.token.as_deref(),
        Some("launch-token-abc"),
        "token should be stored on state for bootstrap script generation"
    );
}

/// The Rust primary API health endpoint is reachable via `api_base()`.
#[test]
fn primary_server_health_reachable_via_api_base() {
    let temp = tempfile::TempDir::new().expect("tempdir");
    let state = shadow_server::start(temp.path(), None).expect("start primary server");
    let health_url = format!("{}/health", state.api_base());
    let (status, body) = http_get(&health_url, &[]);
    assert_eq!(
        status, 200,
        "health at api_base() URL should return 200, body: {body}"
    );
    let json: serde_json::Value = serde_json::from_str(&body).expect("health body is JSON");
    assert_eq!(json["ok"], true);
}

// ---------------------------------------------------------------------------
// Desktop backend phase 2 — recipe preview and shopping-list consolidation
// (issue 0027)
// ---------------------------------------------------------------------------

// --- Recipe URL preview ---

/// Tauri WebView origins must receive CORS headers on API responses (cross-origin loopback fetch).
#[test]
fn recipe_preview_post_includes_cors_for_tauri_webview_origin() {
    let srv = TestServer::start(Some("cors-token"));
    let json_bytes = serde_json::to_vec(&serde_json::json!({ "url": "https://example.com" }))
        .expect("JSON serialization");
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .build()
        .into();
    let resp = agent
        .post(&srv.url("/api/v1/recipes/preview"))
        .header("content-type", "application/json")
        .header("x-desktop-token", "cors-token")
        .header("Origin", "https://tauri.localhost")
        .send(json_bytes.as_slice())
        .expect("no transport error");
    let allow_origin = resp
        .headers()
        .get("access-control-allow-origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    assert_eq!(
        allow_origin, "https://tauri.localhost",
        "must echo Origin for WebView fetch"
    );
}

#[test]
fn recipe_preview_unsupported_url_returns_400() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/preview"),
        &serde_json::json!({ "url": "https://example.com/recipe" }),
    );
    assert_eq!(
        status, 400,
        "unsupported host should return 400, body: {body}"
    );
    let json: serde_json::Value = serde_json::from_str(&body).expect("body is JSON");
    assert_eq!(json["statusCode"], 400);
    assert!(
        json["message"]
            .as_str()
            .unwrap_or("")
            .to_lowercase()
            .contains("not supported"),
        "message should mention 'not supported', got: {}",
        json["message"]
    );
}

#[test]
fn recipe_preview_missing_url_returns_400() {
    let srv = TestServer::start(None);
    let (status, body) =
        http_post_json(&srv.url("/api/v1/recipes/preview"), &serde_json::json!({}));
    assert_eq!(status, 400, "missing url should return 400, body: {body}");
}

#[test]
fn recipe_preview_non_https_url_returns_400() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/preview"),
        &serde_json::json!({ "url": "http://colruyt.be/recipe/test" }),
    );
    assert_eq!(
        status, 400,
        "http (non-https) URL should return 400, body: {body}"
    );
}

/// Fetches a real recipe page — requires internet access.
/// Tagged #[ignore] so it only runs when explicitly requested with `-- --ignored`.
#[test]
#[ignore]
fn recipe_preview_supported_url_returns_200_with_draft() {
    let srv = TestServer::start(None);
    // Use a stable colruyt URL — if this changes, update the URL.
    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/preview"),
        &serde_json::json!({ "url": "https://www.colruyt.be/nl/recepten/pasta-carbonara" }),
    );
    assert_eq!(
        status, 200,
        "real colruyt URL should return 200, body: {body}"
    );
    let json: serde_json::Value = serde_json::from_str(&body).expect("body is JSON");
    assert!(
        json["draft"].is_object(),
        "response should have 'draft' object"
    );
    assert!(
        json["draft"]["title"]
            .as_str()
            .map(|s| !s.is_empty())
            .unwrap_or(false),
        "draft.title must be non-empty"
    );
    assert!(
        json["warnings"].is_array(),
        "response should have 'warnings' array"
    );
}

/// Regression for the reported gelakte-kip 15gram import URL.
#[test]
#[ignore]
fn recipe_preview_15gram_gelakte_kip_url_returns_200_with_draft() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/preview"),
        &serde_json::json!({
            "url": "https://15gram.be/recepten/gelakte-kip-met-rode-curry-noedels-en-oesterzwammen"
        }),
    );
    assert_eq!(
        status, 200,
        "gelakte-kip URL should return 200, body: {body}"
    );
    let json: serde_json::Value = serde_json::from_str(&body).expect("body is JSON");
    assert_eq!(
        json["draft"]["title"].as_str(),
        Some("Gelakte kip met rode curry, noedels en oesterzwammen"),
        "draft.title should match page heading, body: {body}"
    );
}

/// 15gram uses HTML microdata (not JSON-LD Recipe) — regression for import failures on their pages.
#[test]
#[ignore]
fn recipe_preview_15gram_microdata_url_returns_200_with_draft() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/recipes/preview"),
        &serde_json::json!({ "url": "https://15gram.be/recepten/marokkaanse-tomatensalade" }),
    );
    assert_eq!(
        status, 200,
        "15gram microdata URL should return 200, body: {body}"
    );
    let json: serde_json::Value = serde_json::from_str(&body).expect("body is JSON");
    assert_eq!(
        json["draft"]["title"].as_str(),
        Some("Marokkaanse tomatensalade"),
        "draft.title should match page heading, body: {body}"
    );
    assert!(
        json["draft"]["ingredients"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0)
            >= 1,
        "draft should include ingredients, body: {body}"
    );
    assert!(
        json["draft"]["steps"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0)
            >= 1,
        "draft should include steps, body: {body}"
    );
}

// --- Consolidated shopping list: token gate ---

#[test]
fn phase2_routes_require_desktop_token_when_enforced() {
    let srv = TestServer::start(Some("gate-token"));

    // Without token — 401 (token gate fires first, before route logic).
    let (status, _body) = http_post_json(
        &srv.url("/api/v1/recipes/preview"),
        &serde_json::json!({ "url": "https://example.com" }),
    );
    assert_eq!(
        status, 401,
        "phase-2 routes must enforce desktop token; expected 401"
    );

    // With correct token — now the route runs, unsupported URL → 400 (not 501).
    let (status, body) = {
        let json_bytes = serde_json::to_vec(&serde_json::json!({ "url": "https://example.com" }))
            .expect("JSON serialization");
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .http_status_as_error(false)
            .build()
            .into();
        let mut resp = agent
            .post(&srv.url("/api/v1/recipes/preview"))
            .header("content-type", "application/json")
            .header("x-desktop-token", "gate-token")
            .send(json_bytes.as_slice())
            .expect("no transport error");
        let s = resp.status().as_u16();
        let b = resp.body_mut().read_to_string().unwrap_or_default();
        (s, b)
    };
    assert_eq!(
        status, 400,
        "with correct token and unsupported URL, expected 400, body: {body}"
    );
    let json: serde_json::Value = serde_json::from_str(&body).expect("body is JSON");
    assert_eq!(
        json["statusCode"], 400,
        "H3 statusCode should be 400, body: {body}"
    );
}

// --- Consolidated shopping list: CRUD ---

#[test]
fn get_consolidated_shopping_list_not_found_returns_404() {
    let srv = TestServer::start(None);

    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("CSL Test"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_get(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{id}/consolidated-shopping-list"
        )),
        &[],
    );
    assert_eq!(status, 404, "no saved list → 404, body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["statusCode"], 404);
}

#[test]
fn put_consolidated_shopping_list_saves_and_returns_200() {
    let srv = TestServer::start(None);

    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("CSL Save"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let payload = serde_json::json!({
        "lines": [
            {
                "id": "L1",
                "name": "melk",
                "quantity": 1.0,
                "unit": "l",
                "aisleCategory": "dairy"
            }
        ],
        "sourceFingerprint": "abc123"
    });

    let (status, body) = http_put_json(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{id}/consolidated-shopping-list"
        )),
        &payload,
    );
    assert_eq!(status, 200, "PUT should return 200, body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert!(json["lines"].is_array(), "response should have lines array");
    assert_eq!(json["lines"].as_array().unwrap().len(), 1);
    assert_eq!(json["lines"][0]["id"].as_str().unwrap_or(""), "L1");
    assert_eq!(json["lines"][0]["name"].as_str().unwrap_or(""), "melk");
    let expected_fp = minimal_weekplan_source_fingerprint();
    assert_eq!(
        json["sourceFingerprint"].as_str().unwrap_or(""),
        expected_fp,
        "PUT must server-compute sourceFingerprint from plan body (TS parity)"
    );
    assert_ne!(
        json["sourceFingerprint"].as_str().unwrap_or(""),
        "abc123",
        "client-supplied fingerprint must be ignored"
    );
    assert!(
        json["confirmedAt"]
            .as_str()
            .map(|s| !s.is_empty())
            .unwrap_or(false),
        "confirmedAt should be set"
    );
}

#[test]
fn put_consolidated_shopping_list_accepts_lines_only_body() {
    let srv = TestServer::start(None);

    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("CSL Lines Only"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let payload = serde_json::json!({
        "lines": [
            {
                "id": "L1",
                "name": "basilicum",
                "quantity": 1.0,
                "unit": "tak",
                "aisleCategory": "produce"
            }
        ]
    });

    let (status, body) = http_put_json(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{id}/consolidated-shopping-list"
        )),
        &payload,
    );
    assert_eq!(
        status, 200,
        "PUT with lines-only body must succeed (TS client parity), body: {body}"
    );
}

#[test]
fn put_then_get_consolidated_shopping_list_round_trip() {
    let srv = TestServer::start(None);

    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("CSL Round Trip"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let payload = serde_json::json!({
        "lines": [
            { "id": "L1", "name": "eieren", "quantity": 6.0, "unit": null, "aisleCategory": "dairy" },
            { "id": "L2", "name": "bloem", "quantity": 200.0, "unit": "g", "aisleCategory": "dry_goods" }
        ],
        "sourceFingerprint": "fp-test-abc"
    });

    let (put_status, _) = http_put_json(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{id}/consolidated-shopping-list"
        )),
        &payload,
    );
    assert_eq!(put_status, 200, "PUT should succeed");

    let (get_status, get_body) = http_get(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{id}/consolidated-shopping-list"
        )),
        &[],
    );
    assert_eq!(
        get_status, 200,
        "GET after PUT should return 200, body: {get_body}"
    );
    let json: serde_json::Value = serde_json::from_str(&get_body).expect("JSON");
    assert_eq!(json["lines"].as_array().unwrap().len(), 2);
    let expected_fp = minimal_weekplan_source_fingerprint();
    assert_eq!(
        json["sourceFingerprint"].as_str().unwrap_or(""),
        expected_fp,
        "round-trip must return server-computed fingerprint"
    );
    assert_eq!(json["lines"][0]["name"].as_str().unwrap_or(""), "eieren");
    assert_eq!(json["lines"][1]["name"].as_str().unwrap_or(""), "bloem");
}

#[test]
fn consolidated_shopping_list_respects_principal_scoping() {
    let srv = TestServer::start(None);
    srv.set_user_id("user-A");

    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("User A Plan"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    // User A saves a consolidated list.
    let payload = serde_json::json!({
        "lines": [{ "id": "L1", "name": "kaas", "quantity": 150.0, "unit": "g", "aisleCategory": "dairy" }],
        "sourceFingerprint": "fp-user-a"
    });
    let (put_status, _) = http_put_json(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{id}/consolidated-shopping-list"
        )),
        &payload,
    );
    assert_eq!(put_status, 200);

    // User B cannot read User A's weekplan (403 from weekplan scoping).
    srv.set_user_id("user-B");
    let (get_status, _) = http_get(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{id}/consolidated-shopping-list"
        )),
        &[],
    );
    assert!(
        get_status == 403 || get_status == 404,
        "User B should not see User A's consolidated list, got {get_status}"
    );
}

// --- Shopping list consolidation: POST ---

#[test]
fn consolidate_shopping_list_empty_plan_returns_ai_skipped() {
    let srv = TestServer::start(None);

    let (_, create_body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans"),
        &minimal_weekplan_payload("Empty Plan"),
    );
    let created: serde_json::Value = serde_json::from_str(&create_body).expect("JSON");
    let id = created["id"].as_str().expect("id");

    let (status, body) = http_post_json(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{id}/consolidate-shopping-list"
        )),
        &serde_json::json!({}),
    );
    assert_eq!(
        status, 200,
        "empty plan consolidation should return 200, body: {body}"
    );
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(
        json["polishStatus"].as_str().unwrap_or(""),
        "ai_skipped",
        "empty plan → polishStatus=ai_skipped"
    );
    assert!(json["consolidatedLines"].is_array());
    assert!(json["baselineLines"].is_array());
    assert!(json["warnings"].is_array());
    // No desktop.api.not_implemented code in the response.
    assert!(
        json["data"]["code"].is_null() || json["data"].is_null(),
        "must not return not_implemented code, got: {json}"
    );
}

#[test]
fn consolidate_shopping_list_unknown_plan_returns_404() {
    let srv = TestServer::start(None);
    let (status, body) = http_post_json(
        &srv.url("/api/v1/saved-weekplans/nonexistent-id/consolidate-shopping-list"),
        &serde_json::json!({}),
    );
    assert_eq!(
        status, 404,
        "unknown weekplan should return 404, body: {body}"
    );
}

#[test]
fn consolidate_shopping_list_with_recipe_returns_baseline_lines() {
    let srv = TestServer::start(None);

    // Create a recipe with known ingredients.
    let (recipe_status, recipe_body) = http_post_json(
        &srv.url("/api/v1/recipes"),
        &serde_json::json!({
            "title": "Test Soep",
            "ingredients": [
                { "rawText": "200 g wortelen", "name": "wortelen", "quantity": 200.0, "unit": "g" },
                { "rawText": "1 ui", "name": "ui" }
            ]
        }),
    );
    assert_eq!(
        recipe_status, 200,
        "recipe create should return 200, body: {recipe_body}"
    );
    let recipe: serde_json::Value = serde_json::from_str(&recipe_body).expect("JSON");
    let recipe_id = recipe["id"].as_str().expect("recipe id");

    // Create a weekplan with the recipe in day 1 dinner.
    let weekplan_payload = serde_json::json!({
        "name": "Plan with recipe",
        "body": {
            "version": "1",
            "days": {
                "1": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": recipe_id } },
                "2": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "3": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "4": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "5": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "6": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } },
                "7": { "breakfast": { "recipeId": null }, "lunch": { "recipeId": null }, "dinner": { "recipeId": null } }
            }
        }
    });
    let (plan_status, plan_body) =
        http_post_json(&srv.url("/api/v1/saved-weekplans"), &weekplan_payload);
    assert_eq!(
        plan_status, 200,
        "weekplan create should return 200, body: {plan_body}"
    );
    let plan: serde_json::Value = serde_json::from_str(&plan_body).expect("JSON");
    let plan_id = plan["id"].as_str().expect("plan id");

    let (status, body) = http_post_json(
        &srv.url(&format!(
            "/api/v1/saved-weekplans/{plan_id}/consolidate-shopping-list"
        )),
        &serde_json::json!({}),
    );
    assert_eq!(
        status, 200,
        "consolidate with recipe should return 200, body: {body}"
    );
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(
        json["polishStatus"].as_str().unwrap_or(""),
        "ai_skipped",
        "no OpenRouter key in test → ai_skipped"
    );
    let baseline = json["baselineLines"]
        .as_array()
        .expect("baselineLines array");
    assert_eq!(
        baseline.len(),
        2,
        "expected 2 baseline lines (wortelen + ui), got: {baseline:?}"
    );
    let names: Vec<&str> = baseline.iter().filter_map(|l| l["name"].as_str()).collect();
    assert!(
        names.contains(&"wortelen"),
        "baselineLines should contain 'wortelen', got: {names:?}"
    );
    assert!(
        names.contains(&"ui"),
        "baselineLines should contain 'ui', got: {names:?}"
    );
    assert_ne!(
        json["sourceFingerprint"].as_str().unwrap_or(""),
        "",
        "sourceFingerprint should be set"
    );
}

// ---------------------------------------------------------------------------
// Install settings
// ---------------------------------------------------------------------------

#[test]
fn settings_get_returns_default_model_on_fresh_database() {
    let srv = TestServer::start(None);
    let (status, body) = http_get(&srv.url("/api/v1/settings"), &[]);
    assert_eq!(status, 200, "GET settings should return 200, body: {body}");

    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(
        json["openrouterShoppingListModel"].as_str(),
        Some("deepseek/deepseek-v4-flash"),
        "fresh install should expose canonical default model"
    );
}

#[test]
fn settings_patch_persists_model_and_get_reflects_it() {
    let srv = TestServer::start(None);

    let (patch_status, patch_body) = http_patch_json(
        &srv.url("/api/v1/settings"),
        &serde_json::json!({ "openrouterShoppingListModel": "anthropic/claude-3.5-sonnet" }),
    );
    assert_eq!(
        patch_status, 200,
        "PATCH settings should return 200, body: {patch_body}"
    );
    let patched: serde_json::Value = serde_json::from_str(&patch_body).expect("JSON");
    assert_eq!(
        patched["openrouterShoppingListModel"].as_str(),
        Some("anthropic/claude-3.5-sonnet")
    );

    let (get_status, get_body) = http_get(&srv.url("/api/v1/settings"), &[]);
    assert_eq!(
        get_status, 200,
        "GET settings should return 200 after patch, body: {get_body}"
    );
    let json: serde_json::Value = serde_json::from_str(&get_body).expect("JSON");
    assert_eq!(
        json["openrouterShoppingListModel"].as_str(),
        Some("anthropic/claude-3.5-sonnet")
    );
}

#[test]
fn settings_patch_rejects_invalid_model_slug() {
    let srv = TestServer::start(None);
    let (status, body) = http_patch_json(
        &srv.url("/api/v1/settings"),
        &serde_json::json!({ "openrouterShoppingListModel": "not-a-valid-slug" }),
    );
    assert_eq!(status, 400, "invalid model should return 400, body: {body}");
    let json: serde_json::Value = serde_json::from_str(&body).expect("JSON");
    assert_eq!(json["statusCode"], 400);
}

#[test]
fn migrations_create_install_settings_table() {
    let temp = tempfile::TempDir::new().expect("tempdir");
    let db_path = temp.path().join("install-settings.db");

    mealprepper_lib::shadow_server::db::open_and_migrate(&db_path)
        .expect("migrations should succeed");

    let conn = rusqlite::Connection::open(&db_path).expect("open after migrate");
    let model: String = conn
        .query_row(
            "SELECT openrouter_shopping_list_model FROM install_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .expect("install_settings singleton row should exist");
    assert_eq!(model, "deepseek/deepseek-v4-flash");
}
