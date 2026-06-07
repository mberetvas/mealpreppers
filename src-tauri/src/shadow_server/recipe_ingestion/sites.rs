//! Site-specific recipe parsers.
//!
//! Each parser handles a supported Belgian recipe website.
//! Most sites use JSON-LD (delegating to `scraper::parse_json_ld_recipe`);
//! 15gram.be uses HTML microdata attributes.

use scraper::{Html, Selector};
use serde_json::Value;

use super::models::{RecipeDraft, RecipeIngredientDraft, RecipeSource, RecipeStepDraft};
use super::normalizers::{clean_text, parse_ingredient_line, parse_localized_number, parse_recipe_duration, parse_servings};
use super::scraper::{
    find_recipe_json_ld, first_text, meta_content,
    optional_text, parse_json_ld_recipe, parse_json_ld_recipe_from_doc, safe_json_parse,
    split_list, unique_strings,
};

// ---------------------------------------------------------------------------
// 15gram.be — microdata parser
// ---------------------------------------------------------------------------

fn read_fifteen_gram_taxonomy(document: &Html) -> (Vec<String>, Vec<String>) {
    // Try sidebar tags container: #recipe-detail #tags, then #recipe-detail .tags-elements
    let scoped_sel = Selector::parse("#recipe-detail #tags, #recipe-detail .tags-elements").ok();

    let category_sel = Selector::parse(
        r#"[itemprop="recipeCategory"], [itemprop="recipeCuisine"]"#,
    )
    .unwrap();
    let keyword_sel = Selector::parse(r#"[itemprop="keywords"]"#).unwrap();

    // Helper to collect text from selector within a scope
    let collect_from_doc = |sel: &Selector| -> Vec<String> {
        document
            .select(sel)
            .map(|e| clean_text(&e.text().collect::<String>()))
            .filter(|s| !s.is_empty())
            .collect()
    };

    // If we have a scoped container, restrict to it; otherwise fall back to whole doc.
    let _ = scoped_sel; // Can't easily scope with scraper; use whole-doc for now.

    let categories = unique_strings(collect_from_doc(&category_sel));
    let tags = unique_strings(collect_from_doc(&keyword_sel));
    (categories, tags)
}

/// Parses a 15gram.be recipe page using HTML microdata (itemprop).
/// 15gram does not use JSON-LD — all recipe data is in microdata attributes.
pub fn parse_fifteen_gram_recipe(document: &Html, source: RecipeSource) -> RecipeDraft {
    let name_sel = Selector::parse(r#"#recipe-detail [itemprop="name"], [itemprop="name"]"#).unwrap();
    let desc_sel =
        Selector::parse(r#"#recipe-detail [itemprop="description"], [itemprop="description"]"#).unwrap();
    let image_sel = Selector::parse(r#"#recipe-detail [itemprop="image"], [itemprop="image"]"#).unwrap();
    let yield_sel =
        Selector::parse(r#"#recipe-detail [itemprop="recipeYield"], [itemprop="recipeYield"]"#).unwrap();
    let cook_time_sel = Selector::parse(
        r#"#recipe-detail meta[itemprop="cookTime"], meta[itemprop="cookTime"]"#,
    )
    .unwrap();
    let ingredient_sel = Selector::parse(
        r#"#recipe-detail li[itemprop="recipeIngredient"], li[itemprop="recipeIngredient"]"#,
    )
    .unwrap();
    let step_sel = Selector::parse(
        r#"#recipe-detail li[itemprop="recipeInstructions"], li[itemprop="recipeInstructions"]"#,
    )
    .unwrap();

    let title = clean_text(
        &document
            .select(&name_sel)
            .next()
            .map(|e| e.text().collect::<String>())
            .unwrap_or_default(),
    );
    let description = optional_text(
        document
            .select(&desc_sel)
            .next()
            .map(|e| e.text().collect::<String>())
            .as_deref(),
    );
    let image_url = optional_text(
        document
            .select(&image_sel)
            .next()
            .and_then(|e| e.value().attr("src"))
            .or_else(|| {
                document
                    .select(&image_sel)
                    .next()
                    .and_then(|e| e.value().attr("content"))
            }),
    );
    let servings = document
        .select(&yield_sel)
        .next()
        .map(|e| e.text().collect::<String>())
        .as_deref()
        .and_then(parse_servings);
    let cook_time_minutes = document
        .select(&cook_time_sel)
        .next()
        .and_then(|e| e.value().attr("content"))
        .and_then(parse_recipe_duration);

    let ingredients: Vec<RecipeIngredientDraft> = document
        .select(&ingredient_sel)
        .map(|e| parse_ingredient_line(&e.text().collect::<String>()))
        .collect();

    let steps: Vec<RecipeStepDraft> = document
        .select(&step_sel)
        .enumerate()
        .map(|(i, e)| RecipeStepDraft {
            position: i + 1,
            text: clean_text(&e.text().collect::<String>()),
        })
        .filter(|s| !s.text.is_empty())
        .collect();

    let (categories, tags) = read_fifteen_gram_taxonomy(document);

    RecipeDraft {
        source,
        title,
        description,
        image_url,
        servings,
        total_time_minutes: None,
        prep_time_minutes: None,
        cook_time_minutes,
        difficulty: None,
        categories,
        tags,
        ingredients,
        steps,
    }
}

// ---------------------------------------------------------------------------
// dagelijksekost.vrt.be — JSON-LD + og:title override
// ---------------------------------------------------------------------------

fn pick_dagelijksekost_title(document: &Html, json_ld_name: Option<&str>) -> String {
    // og:title is more accurate than the JSON-LD SEO blurb.
    if let Some(og) = meta_content(document, r#"meta[property="og:title"]"#) {
        let cleaned = clean_text(&og);
        if !cleaned.is_empty() {
            return cleaned;
        }
    }
    if let Some(twitter) = meta_content(document, r#"meta[name="twitter:title"]"#) {
        let cleaned = clean_text(&twitter);
        if !cleaned.is_empty() {
            return cleaned;
        }
    }
    // Page title, stripped of "| Dagelijkse kost" suffix.
    let page_title = first_text(document, "title");
    let stripped = page_title
        .split('|')
        .next()
        .unwrap_or(&page_title)
        .trim()
        .to_string();
    if !stripped.is_empty() {
        return clean_text(&stripped);
    }
    clean_text(json_ld_name.unwrap_or(&page_title))
}

/// Parses a dagelijksekost.vrt.be recipe page.
/// Uses JSON-LD for data; title from og:title (more accurate than the JSON-LD SEO blurb).
pub fn parse_dagelijksekost_recipe(document: &Html, source: RecipeSource) -> RecipeDraft {
    let json_ld = find_recipe_json_ld(document);
    let json_ld_name = json_ld
        .as_ref()
        .and_then(|r| r["name"].as_str())
        .map(|s| s.to_string());
    let mut draft = parse_json_ld_recipe(document, source, json_ld.as_ref());
    draft.title = pick_dagelijksekost_title(document, json_ld_name.as_deref());
    draft
}

// ---------------------------------------------------------------------------
// delhaize.be — JSON-LD + __NEXT_DATA__ enrichment
// ---------------------------------------------------------------------------

fn find_record_by_typename<'a>(value: &'a Value, typename: &str) -> Option<&'a Value> {
    match value {
        Value::Array(arr) => arr.iter().find_map(|v| find_record_by_typename(v, typename)),
        Value::Object(map) => {
            if map.get("__typename").and_then(|v| v.as_str()) == Some(typename)
                && map.contains_key("title")
            {
                return Some(value);
            }
            map.values()
                .find_map(|v| find_record_by_typename(v, typename))
        }
        _ => None,
    }
}

fn parse_delhaize_ingredients(recipe_data: &Value) -> Vec<RecipeIngredientDraft> {
    let ingredients = match recipe_data.get("fractionalRecipeIngredients") {
        Some(Value::Array(arr)) => arr.as_slice(),
        _ => return vec![],
    };

    ingredients
        .iter()
        .filter_map(|ing| {
            let name = clean_text(ing["ingredientName"].as_str()?);
            let quantity_text = ing["quantity"].as_str().map(|s| s.to_string());
            let unit = optional_text(ing["measureUnit"].as_str());
            let quantity = quantity_text.as_deref().and_then(parse_localized_number);

            let raw_text = clean_text(
                &[quantity_text.as_deref(), unit.as_deref(), Some(&name)]
                    .iter()
                    .filter_map(|p| *p)
                    .collect::<Vec<_>>()
                    .join(" "),
            );

            Some(RecipeIngredientDraft {
                raw_text: if raw_text.is_empty() {
                    name.clone()
                } else {
                    raw_text
                },
                name,
                quantity,
                unit,
            })
        })
        .collect()
}

fn merge_delhaize_embedded_data(document: &Html, draft: RecipeDraft) -> RecipeDraft {
    let next_data_sel = Selector::parse("script#__NEXT_DATA__").ok();
    let next_data_text = next_data_sel.as_ref().and_then(|sel| {
        document
            .select(sel)
            .next()
            .map(|e| e.text().collect::<String>())
    });

    let next_data = next_data_text
        .as_deref()
        .and_then(|t| safe_json_parse(t));
    let recipe_data = next_data
        .as_ref()
        .and_then(|d| find_record_by_typename(d, "RecipeEssentialData"));

    let Some(rd) = recipe_data else {
        return draft;
    };

    let title = rd["title"]
        .as_str()
        .map(|s| clean_text(s))
        .unwrap_or(draft.title);
    let servings = rd["servings"]
        .as_str()
        .and_then(parse_localized_number)
        .map(|f| f as u32)
        .or(draft.servings);
    let difficulty = rd["difficultyName"]
        .as_str()
        .and_then(|s| optional_text(Some(s)))
        .or(draft.difficulty);
    let prep_time_minutes = draft
        .prep_time_minutes
        .or_else(|| rd["preparationTimeName"].as_str().and_then(parse_recipe_duration));
    let extra_categories = unique_strings(
        split_list(rd.get("courseName"))
            .into_iter()
            .chain(split_list(rd.get("cuisine")))
            .collect(),
    );
    let categories = unique_strings(draft.categories.into_iter().chain(extra_categories).collect());
    let ingredients_from_data = parse_delhaize_ingredients(rd);
    let ingredients = if ingredients_from_data.is_empty() {
        draft.ingredients
    } else {
        ingredients_from_data
    };

    RecipeDraft {
        source: draft.source,
        title,
        description: draft.description,
        image_url: draft.image_url,
        servings,
        total_time_minutes: draft.total_time_minutes,
        prep_time_minutes,
        cook_time_minutes: draft.cook_time_minutes,
        difficulty,
        categories,
        tags: draft.tags,
        ingredients,
        steps: draft.steps,
    }
}

/// Parses a delhaize.be recipe page.
/// Uses JSON-LD as base; enriches with `__NEXT_DATA__` script when available.
pub fn parse_delhaize_recipe(document: &Html, source: RecipeSource) -> RecipeDraft {
    let draft = parse_json_ld_recipe_from_doc(document, source);
    merge_delhaize_embedded_data(document, draft)
}

// ---------------------------------------------------------------------------
// libelle-lekker.be — JSON-LD + data-ingredient-groups enrichment
// ---------------------------------------------------------------------------

fn parse_libelle_structured_ingredients(document: &Html) -> Vec<RecipeIngredientDraft> {
    // [data-ingredient-groups] attribute contains HTML-encoded JSON
    let sel = Selector::parse("[data-ingredient-groups]").ok();
    let encoded = sel.as_ref().and_then(|sel| {
        document
            .select(sel)
            .next()
            .and_then(|e| e.value().attr("data-ingredient-groups"))
    });

    let Some(encoded) = encoded else {
        return vec![];
    };

    let decoded = super::normalizers::decode_html_entities(encoded);
    let parsed = safe_json_parse(&decoded);

    let Some(Value::Array(groups)) = parsed else {
        return vec![];
    };

    groups
        .iter()
        .filter_map(|group| group.get("ingredients"))
        .filter_map(|v| v.as_array())
        .flatten()
        .filter_map(|ingredient| {
            let name = clean_text(ingredient["ingredientName"].as_str()?);
            let quantity = ingredient["quantity"]
                .as_str()
                .and_then(parse_localized_number);
            let unit = optional_text(ingredient["unitName"].as_str());

            let raw_parts: Vec<String> = [
                if quantity.map(|q| q > 0.0).unwrap_or(false) {
                    Some(super::normalizers::format_quantity(quantity.unwrap()))
                } else {
                    None
                },
                unit.clone(),
                Some(name.clone()),
            ]
            .iter()
            .filter_map(|p| p.clone())
            .collect();

            let raw_text = clean_text(&raw_parts.join(" "));

            Some(RecipeIngredientDraft {
                raw_text: if raw_text.is_empty() { name.clone() } else { raw_text },
                name,
                quantity: quantity.filter(|&q| q > 0.0),
                unit,
            })
        })
        .collect()
}

/// Parses a libelle-lekker.be recipe page.
/// Uses JSON-LD as base; overrides ingredients with structured `data-ingredient-groups` when available.
/// Note: The Node.js version uses Playwright for some pages, but plain HTTP with
/// browser-like headers works for publicly accessible recipes.
pub fn parse_libelle_lekker_recipe(document: &Html, source: RecipeSource) -> RecipeDraft {
    let mut draft = parse_json_ld_recipe_from_doc(document, source);
    let structured = parse_libelle_structured_ingredients(document);
    if !structured.is_empty() {
        draft.ingredients = structured;
    }
    draft
}
