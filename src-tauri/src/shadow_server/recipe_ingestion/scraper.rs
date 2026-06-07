//! HTML parsing for recipe pages using the `scraper` crate.
//!
//! Provides JSON-LD extraction, generic JSON-LD recipe parsing, and per-site dispatch.
//! Mirrors the TypeScript `scraperUtils.ts` and `recipeScraper.ts` logic.

use scraper::{Html, Selector};
use serde_json::Value;

use super::models::{
    RecipeDraft, RecipeIngredientDraft, RecipeSource, RecipeStepDraft, SUPPORTED_RECIPE_HOSTS,
};
use super::normalizers::{
    clean_text, parse_ingredient_line, parse_recipe_duration, parse_servings,
};

// ---------------------------------------------------------------------------
// Public helper: quick check for any Recipe JSON-LD (used by auth-wall detection)
// ---------------------------------------------------------------------------

/// Returns true if the HTML contains at least one JSON-LD script with `@type: Recipe`.
pub fn has_recipe_json_ld(html: &str) -> bool {
    find_recipe_json_ld_in_html(html).is_some()
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/// Returns the canonical recipe host if `url` is a supported https URL.
pub fn canonical_recipe_host(url: &str) -> Option<&'static str> {
    let parsed = url::Url::parse(url).ok()?;
    if parsed.scheme() != "https" {
        return None;
    }
    let host = parsed.host_str()?.to_lowercase();
    let host_stripped = host.strip_prefix("www.").unwrap_or(&host);
    SUPPORTED_RECIPE_HOSTS
        .iter()
        .copied()
        .find(|&supported| supported == host_stripped)
}

// ---------------------------------------------------------------------------
// Main parse dispatch
// ---------------------------------------------------------------------------

pub struct RecipeScrapeResult {
    pub draft: RecipeDraft,
    pub warnings: Vec<String>,
}

/// Parses recipe HTML for a given source URL using the appropriate site parser.
/// Mirrors `parseRecipeHtml` in TypeScript.
pub fn parse_recipe_html(html: &str, source_url: &str) -> Result<RecipeScrapeResult, String> {
    let host = canonical_recipe_host(source_url)
        .ok_or_else(|| format!("Unsupported recipe source: {source_url}"))?;

    let source = RecipeSource {
        url: source_url.to_string(),
        host: host.to_string(),
    };

    let document = Html::parse_document(html);
    let draft = dispatch_parser(&document, source, host);

    let warnings = if draft.steps.is_empty() {
        vec!["No preparation steps found for this recipe.".to_string()]
    } else {
        vec![]
    };

    Ok(RecipeScrapeResult { draft, warnings })
}

fn dispatch_parser(document: &Html, source: RecipeSource, host: &str) -> RecipeDraft {
    match host {
        "15gram.be" => super::sites::parse_fifteen_gram_recipe(document, source),
        "colruyt.be" => parse_json_ld_recipe_from_doc(document, source),
        "dagelijksekost.vrt.be" => super::sites::parse_dagelijksekost_recipe(document, source),
        "delhaize.be" => super::sites::parse_delhaize_recipe(document, source),
        "libelle-lekker.be" => super::sites::parse_libelle_lekker_recipe(document, source),
        _ => parse_json_ld_recipe_from_doc(document, source),
    }
}

// ---------------------------------------------------------------------------
// JSON-LD extraction
// ---------------------------------------------------------------------------

/// Finds the first `<script type="application/ld+json">` element that contains
/// a Recipe node. Mirrors `findRecipeJsonLd` in TypeScript.
pub fn find_recipe_json_ld(document: &Html) -> Option<Value> {
    let selector = Selector::parse(r#"script[type="application/ld+json"]"#).ok()?;
    for element in document.select(&selector) {
        let raw_text: String = element.text().collect();
        let parsed = safe_json_parse(&raw_text)?;
        if let Some(recipe) = find_recipe_node(&parsed) {
            return Some(recipe);
        }
    }
    None
}

fn find_recipe_json_ld_in_html(html: &str) -> Option<Value> {
    let document = Html::parse_document(html);
    find_recipe_json_ld(&document)
}

/// Recursively finds a JSON object with `@type` == "Recipe".
fn find_recipe_node(value: &Value) -> Option<Value> {
    match value {
        Value::Array(arr) => arr.iter().find_map(find_recipe_node),
        Value::Object(map) => {
            if type_includes(&map.get("@type"), "Recipe") {
                return Some(value.clone());
            }
            // Check @graph
            if let Some(graph) = map.get("@graph") {
                if let Some(r) = find_recipe_node(graph) {
                    return Some(r);
                }
            }
            None
        }
        _ => None,
    }
}

fn type_includes(value: &Option<&Value>, expected: &str) -> bool {
    match value {
        Some(Value::String(s)) => s == expected,
        Some(Value::Array(arr)) => arr.iter().any(|v| v.as_str() == Some(expected)),
        _ => false,
    }
}

/// Parses a JSON string with a bare-newline repair fallback. Mirrors `safeJsonParse`.
pub fn safe_json_parse(text: &str) -> Option<Value> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(v) = serde_json::from_str(trimmed) {
        return Some(v);
    }
    // Repair: escape bare newlines inside strings
    let repaired = escape_bare_newlines_in_json_strings(trimmed);
    serde_json::from_str(&repaired).ok()
}

fn escape_bare_newlines_in_json_strings(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    let mut inside_string = false;
    let mut escaped = false;

    for c in value.chars() {
        if c == '"' && !escaped {
            inside_string = !inside_string;
        }
        if inside_string && (c == '\n' || c == '\r') {
            if c == '\n' {
                result.push_str("\\n");
            } else {
                result.push_str("\\r");
            }
        } else {
            result.push(c);
        }
        escaped = c == '\\' && !escaped;
    }
    result
}

// ---------------------------------------------------------------------------
// Generic JSON-LD recipe parser
// ---------------------------------------------------------------------------

/// Builds a `RecipeDraft` from a generic JSON-LD Recipe node.
/// Mirrors `parseJsonLdRecipe` in TypeScript.
pub fn parse_json_ld_recipe(
    document: &Html,
    source: RecipeSource,
    recipe: Option<&Value>,
) -> RecipeDraft {
    let title = {
        let ld_name = recipe.and_then(|r| r["name"].as_str());
        let doc_title = doc_title(document);
        clean_text(ld_name.unwrap_or(&doc_title))
    };
    let description = optional_text(recipe.and_then(|r| r["description"].as_str()));
    let image_url = optional_text(read_image_url(recipe.and_then(|r| r.get("image"))).as_deref());
    let servings = recipe
        .and_then(|r| r["recipeYield"].as_str().or_else(|| r["yield"].as_str()))
        .and_then(parse_servings);
    let total_time_minutes = recipe
        .and_then(|r| r["totalTime"].as_str())
        .and_then(parse_recipe_duration);
    let prep_time_minutes = recipe
        .and_then(|r| r["prepTime"].as_str())
        .and_then(parse_recipe_duration);
    let cook_time_minutes = recipe
        .and_then(|r| r["cookTime"].as_str())
        .and_then(parse_recipe_duration);

    let ingredient_strings = read_string_array(
        recipe.and_then(|r| r.get("recipeIngredient").or_else(|| r.get("ingredients"))),
    );
    let ingredients: Vec<RecipeIngredientDraft> = ingredient_strings
        .iter()
        .map(|s| parse_ingredient_line(s))
        .collect();

    let instruction_texts =
        extract_instruction_texts(recipe.and_then(|r| r.get("recipeInstructions")));
    let steps: Vec<RecipeStepDraft> = instruction_texts
        .into_iter()
        .map(|t| clean_text(&t))
        .filter(|t| !t.is_empty())
        .enumerate()
        .map(|(i, text)| RecipeStepDraft {
            position: i + 1,
            text,
        })
        .collect();

    let categories = unique_strings(
        split_list(recipe.and_then(|r| r.get("recipeCategory")))
            .into_iter()
            .chain(split_list(recipe.and_then(|r| r.get("recipeCuisine"))))
            .collect(),
    );
    let tags = unique_strings(split_list(recipe.and_then(|r| r.get("keywords"))));

    RecipeDraft {
        source,
        title,
        description,
        image_url,
        servings,
        total_time_minutes,
        prep_time_minutes,
        cook_time_minutes,
        difficulty: None,
        categories,
        tags,
        ingredients,
        steps,
    }
}

/// Convenience: parse JSON-LD from a document and call `parse_json_ld_recipe`.
pub fn parse_json_ld_recipe_from_doc(document: &Html, source: RecipeSource) -> RecipeDraft {
    let json_ld = find_recipe_json_ld(document);
    parse_json_ld_recipe(document, source, json_ld.as_ref())
}

// ---------------------------------------------------------------------------
// Selector helpers
// ---------------------------------------------------------------------------

pub fn doc_title(document: &Html) -> String {
    let sel = Selector::parse("title").unwrap();
    document
        .select(&sel)
        .next()
        .map(|e| e.text().collect::<String>())
        .unwrap_or_default()
}

pub fn meta_content(document: &Html, selector_str: &str) -> Option<String> {
    let sel = Selector::parse(selector_str).ok()?;
    document
        .select(&sel)
        .next()
        .and_then(|e| e.value().attr("content"))
        .map(|s| s.to_string())
}

pub fn first_text(document: &Html, selector_str: &str) -> String {
    let sel = match Selector::parse(selector_str) {
        Ok(s) => s,
        Err(_) => return String::new(),
    };
    document
        .select(&sel)
        .next()
        .map(|e| e.text().collect::<String>())
        .unwrap_or_default()
}

pub fn first_attr(document: &Html, selector_str: &str, attr: &str) -> Option<String> {
    let sel = Selector::parse(selector_str).ok()?;
    document
        .select(&sel)
        .next()
        .and_then(|e| e.value().attr(attr))
        .map(|s| s.to_string())
}

// ---------------------------------------------------------------------------
// Value helper utilities (mirrors scraperUtils.ts)
// ---------------------------------------------------------------------------

pub fn read_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

pub fn read_string_array(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::String(s)) => vec![s.clone()],
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        _ => vec![],
    }
}

pub fn read_image_url(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Array(arr)) => read_image_url(arr.first()),
        Some(obj @ Value::Object(_)) => obj["url"].as_str().map(|s| s.to_string()),
        _ => None,
    }
}

pub fn split_list(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(arr)) => arr.iter().flat_map(|v| split_list(Some(v))).collect(),
        Some(Value::String(s)) => s
            .split([',', '|'])
            .map(clean_text)
            .filter(|s| !s.is_empty())
            .collect(),
        _ => vec![],
    }
}

pub fn unique_strings(values: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    values
        .into_iter()
        .map(|s| clean_text(&s))
        .filter(|s| !s.is_empty() && seen.insert(s.clone()))
        .collect()
}

pub fn optional_text(value: Option<&str>) -> Option<String> {
    value.map(clean_text).filter(|s| !s.is_empty())
}

/// Recursively extracts instruction texts from various JSON shapes.
/// Mirrors `extractInstructionTexts` in TypeScript.
pub fn extract_instruction_texts(value: Option<&Value>) -> Vec<String> {
    match value {
        None => vec![],
        Some(Value::String(s)) => vec![s.clone()],
        Some(Value::Array(arr)) => arr
            .iter()
            .flat_map(|v| extract_instruction_texts(Some(v)))
            .collect(),
        Some(obj @ Value::Object(map)) => {
            // Prioritise nested steps — recurse into itemListElement / steps / step
            if map.contains_key("itemListElement")
                || map.contains_key("steps")
                || map.contains_key("step")
            {
                let nested = map
                    .get("itemListElement")
                    .or_else(|| map.get("steps"))
                    .or_else(|| map.get("step"));
                return extract_instruction_texts(nested);
            }
            if let Some(text) = obj["text"].as_str() {
                return vec![text.to_string()];
            }
            vec![]
        }
        _ => vec![],
    }
}
