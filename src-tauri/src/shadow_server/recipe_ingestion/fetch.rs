//! HTTP fetching for recipe pages using browser-like headers.
//!
//! Mirrors `fetchRecipePageHtml.ts` — fetches with Chrome-style headers
//! to reduce bot-detection blocking.

// Hostnames used by Roularta / Libelle SSO login redirects.
const ROULARTA_AUTH_HOSTS: &[&str] = &[
    "token.roularta.be",
    "sso.roularta.be",
    "ciam.roularta.be",
];

pub struct FetchRecipePageResult {
    pub html: String,
    pub final_url: String,
    pub status: u16,
}

/// Fetches a recipe detail page using headers similar to a desktop Chromium
/// navigation. Mirrors `fetchRecipePageHtml` in TypeScript.
///
/// Intended to be called inside `tokio::task::spawn_blocking`.
pub fn fetch_recipe_page_html(url: &str) -> Result<FetchRecipePageResult, String> {
    let mut resp = ureq::get(url)
        .header("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
        .header("accept-language", "nl-BE,nl;q=0.9,en;q=0.8")
        .header("sec-fetch-dest", "document")
        .header("sec-fetch-mode", "navigate")
        .header("sec-fetch-site", "none")
        .header("sec-fetch-user", "?1")
        .header("upgrade-insecure-requests", "1")
        .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .call()
        .map_err(|e| format!("fetch error: {e}"))?;

    let status = resp.status().as_u16();
    // After redirects the final URL is in the Location header of the last response,
    // but ureq follows redirects automatically and doesn't expose final URL directly.
    // Use the original URL as the final URL (good enough for auth-wall detection).
    let final_url = url.to_string();

    let html = resp
        .body_mut()
        .read_to_string()
        .map_err(|e| format!("read body error: {e}"))?;

    Ok(FetchRecipePageResult { html, final_url, status })
}

/// Returns true when the response looks like a publisher login/SSO wall.
/// Mirrors `detectPublisherAuthWall` in TypeScript.
pub fn detect_publisher_auth_wall(html: &str, final_url: &str) -> bool {
    // Check if the final URL is a known Roularta auth host.
    if let Ok(parsed) = url::Url::parse(final_url) {
        let hostname = parsed.host_str().unwrap_or("").to_lowercase();
        if ROULARTA_AUTH_HOSTS.iter().any(|h| *h == hostname.as_str()) {
            return true;
        }
    }

    // If we can find a Recipe JSON-LD node, it's not a login wall.
    if crate::shadow_server::recipe_ingestion::scraper::has_recipe_json_ld(html) {
        return false;
    }

    // 15gram.be uses microdata inside #recipe-detail, not JSON-LD Recipe nodes.
    if html.contains("id=\"recipe-detail\"")
        && html.contains("itemprop=\"recipeIngredient\"")
    {
        return false;
    }

    // Check for "inloggen" in the page title.
    let title = extract_title_from_html(html);
    title.to_lowercase().contains("inloggen")
}

fn extract_title_from_html(html: &str) -> String {
    let lower = html.to_lowercase();
    let start = lower.find("<title");
    let end = lower.find("</title>");
    if let (Some(s), Some(e)) = (start, end) {
        // Find the '>' after '<title'
        if let Some(gt) = html[s..].find('>') {
            let content_start = s + gt + 1;
            if content_start < e {
                return html[content_start..e].to_string();
            }
        }
    }
    String::new()
}
