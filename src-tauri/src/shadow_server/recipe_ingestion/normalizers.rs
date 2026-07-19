//! Text normalization and ingredient parsing utilities.
//!
//! Ports the TypeScript `normalizers.ts` functions to Rust.

use super::models::RecipeIngredientDraft;

// ---------------------------------------------------------------------------
// Unit alias table (mirrors UNIT_ALIASES in TypeScript normalizers.ts)
// ---------------------------------------------------------------------------

fn unit_alias(unit: &str) -> Option<&'static str> {
    match unit {
        "g" | "gr" | "gr." | "gram" => Some("g"),
        "kg" => Some("kg"),
        "l" | "liter" => Some("l"),
        "dl" | "deciliter" => Some("dl"),
        "ml" => Some("ml"),
        "el" | "eetlepel" | "eetlepels" => Some("el"),
        "kl" | "koffielepel" | "koffielepels" => Some("kl"),
        "tl" | "theelepel" | "theelepels" => Some("tl"),
        "bussel" => Some("bussel"),
        "bussels" => Some("bussels"),
        "bosje" => Some("bosje"),
        "bosjes" => Some("bosjes"),
        "bakje" => Some("bakje"),
        "bakjes" => Some("bakjes"),
        "teentje" => Some("teentje"),
        "teentjes" => Some("teentje"),
        "scheutje" => Some("scheutje"),
        "snuifje" => Some("snuifje"),
        "blik" => Some("blik"),
        "handvol" => Some("handvol"),
        "handje" => Some("handje"),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Unicode fraction values
// ---------------------------------------------------------------------------

fn unicode_fraction_value(c: char) -> Option<f64> {
    match c {
        '¼' => Some(0.25),
        '½' => Some(0.5),
        '¾' => Some(0.75),
        '⅓' => Some(1.0 / 3.0),
        '⅔' => Some(2.0 / 3.0),
        '⅛' => Some(0.125),
        '⅜' => Some(0.375),
        '⅝' => Some(0.625),
        '⅞' => Some(0.875),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Decodes common HTML entities — mirrors `decodeHtmlEntities` in TypeScript.
pub fn decode_html_entities(value: &str) -> String {
    value
        .replace("&nbsp;", " ")
        .replace("&#039;", "'")
        .replace("&apos;", "'")
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&euml;", "ë")
        .replace("&eacute;", "é")
        .replace("&egrave;", "è")
        .replace("&iuml;", "ï")
        .replace("&icirc;", "î")
        .replace("&agrave;", "à")
}

/// Cleans text: decodes HTML entities, replaces NBSP, collapses whitespace.
/// Mirrors `cleanText` in TypeScript.
pub fn clean_text(value: &str) -> String {
    let decoded = decode_html_entities(value);
    let nbsp_replaced = decoded.replace('\u{00a0}', " ");
    // collapse runs of whitespace to a single space, then trim
    let collapsed: String = nbsp_replaced
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    collapsed
}

/// Parses a localized number (comma or dot decimal) — mirrors `parseLocalizedNumber`.
pub fn parse_localized_number(value: &str) -> Option<f64> {
    let cleaned = clean_text(value).replace(',', ".");
    cleaned.parse::<f64>().ok().filter(|v| v.is_finite())
}

/// Parses an ISO 8601 / Dutch duration string to minutes — mirrors `parseRecipeDuration`.
pub fn parse_recipe_duration(value: &str) -> Option<u32> {
    let normalized = clean_text(value).to_lowercase();

    // ISO 8601 duration: PT1H30M, P0DT45M, etc.
    let iso_re_str = r"^p(?:\d+d)?t(?:(\d+)h)?(?:(\d+)m)?$";
    if let Some(caps) = simple_regex_match_iso_duration(&normalized) {
        return Some(caps);
    }
    let _ = iso_re_str;

    // Range: "30 - 45 min" → take upper bound
    if let Some(mins) = parse_range_minutes(&normalized) {
        return Some(mins);
    }

    // "2 uur 30 min" or "1u 15"
    if let Some(mins) = parse_hour_minute(&normalized) {
        return Some(mins);
    }

    // plain "45 min"
    if let Some(mins) = parse_plain_minutes(&normalized) {
        return Some(mins);
    }

    None
}

fn simple_regex_match_iso_duration(normalized: &str) -> Option<u32> {
    // Manual parse: p[n d]t[n h][n m]
    if !normalized.starts_with('p') {
        return None;
    }
    let after_p = &normalized[1..];
    // Skip optional days part
    let t_pos = after_p.find('t')?;
    let after_d = &after_p[t_pos + 1..];

    let hours = if let Some(h_pos) = after_d.find('h') {
        let h_str: String = after_d[..h_pos]
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect();
        h_str.parse::<u32>().unwrap_or(0)
    } else {
        0
    };

    let after_h = if let Some(h_pos) = after_d.find('h') {
        &after_d[h_pos + 1..]
    } else {
        after_d
    };
    let minutes = if let Some(m_pos) = after_h.find('m') {
        let m_str: String = after_h[..m_pos]
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect();
        m_str.parse::<u32>().unwrap_or(0)
    } else {
        0
    };

    if hours == 0 && minutes == 0 {
        None
    } else {
        Some(hours * 60 + minutes)
    }
}

fn parse_range_minutes(normalized: &str) -> Option<u32> {
    // e.g. "30 - 45 min" or "30–45 minuten"
    let has_min_word = normalized.contains("min");
    if !has_min_word {
        return None;
    }
    // Find pattern: digits (sep) digits
    let parts: Vec<&str> = normalized.split(['-', '–']).collect();
    if parts.len() < 2 {
        return None;
    }
    let upper: String = parts[1].chars().filter(|c| c.is_ascii_digit()).collect();
    upper.parse::<u32>().ok()
}

fn parse_hour_minute(normalized: &str) -> Option<u32> {
    // e.g. "1 uur 30 min" or "2u 15"
    let has_hour = normalized.contains("uur") || normalized.contains('u');
    if !has_hour {
        return None;
    }
    let hour_sep = if normalized.contains("uur") {
        "uur"
    } else {
        "u"
    };
    let parts: Vec<&str> = normalized.splitn(2, hour_sep).collect();
    if parts.len() < 2 {
        return None;
    }
    let h_str: String = parts[0].chars().filter(|c| c.is_ascii_digit()).collect();
    let hours = h_str.parse::<u32>().ok()?;
    // After "uur", find digits for minutes
    let min_str: String = parts[1]
        .split(|c: char| !c.is_ascii_digit())
        .find(|s| !s.is_empty())
        .unwrap_or("")
        .to_string();
    let mins = min_str.parse::<u32>().unwrap_or(0);
    Some(hours * 60 + mins)
}

fn parse_plain_minutes(normalized: &str) -> Option<u32> {
    let has_min = normalized.contains("min");
    if !has_min {
        return None;
    }
    // Extract leading digits
    let digits: String = normalized
        .split_whitespace()
        .next()
        .unwrap_or("")
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect();
    digits.parse::<u32>().ok()
}

/// Parses a servings string (e.g. "4 personen") to a number.
pub fn parse_servings(value: &str) -> Option<u32> {
    let cleaned = clean_text(value);
    let digits: String = cleaned.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    // Take first run of digits
    let first: String = cleaned
        .split_whitespace()
        .find_map(|word| {
            let d: String = word.chars().filter(|c| c.is_ascii_digit()).collect();
            if d.is_empty() {
                None
            } else {
                Some(d)
            }
        })
        .unwrap_or_default();
    first.parse::<u32>().ok()
}

/// Parses an ingredient line string into a `RecipeIngredientDraft`.
/// Mirrors `parseIngredientLine` in TypeScript normalizers.ts.
pub fn parse_ingredient_line(value: &str) -> RecipeIngredientDraft {
    let raw_text = clean_text(value);

    // Try to match: optional unicode fraction OR decimal number at the start
    if let Some((quantity, remainder)) = extract_leading_quantity(&raw_text) {
        if !remainder.is_empty() {
            let tokens: Vec<&str> = remainder.splitn(2, ' ').collect();
            let first_token = tokens[0].to_lowercase();
            if let Some(normalized_unit) = unit_alias(&first_token) {
                let name_part = tokens.get(1).unwrap_or(&"");
                let name = clean_text(name_part);
                let final_name = if name.is_empty() {
                    remainder.to_string()
                } else {
                    name
                };
                return RecipeIngredientDraft {
                    raw_text,
                    name: final_name,
                    quantity: Some(quantity),
                    unit: Some(normalized_unit.to_string()),
                };
            }
        }
        // quantity found but no unit: name = remainder
        if !remainder.is_empty() {
            return RecipeIngredientDraft {
                raw_text,
                name: remainder.to_string(),
                quantity: Some(quantity),
                unit: None,
            };
        }
    }

    RecipeIngredientDraft {
        raw_text: raw_text.clone(),
        name: raw_text,
        quantity: None,
        unit: None,
    }
}

/// Extracts leading quantity (unicode fraction, fraction like "1/2", or decimal).
/// Returns `(quantity, remainder_after_number_and_space)`.
fn extract_leading_quantity(text: &str) -> Option<(f64, String)> {
    let mut chars = text.chars().peekable();
    let first_char = chars.peek().copied()?;

    // Unicode fraction character
    if let Some(frac) = unicode_fraction_value(first_char) {
        chars.next();
        let remainder = chars.collect::<String>();
        let remainder = remainder.trim_start().to_string();
        return Some((frac, remainder));
    }

    // Must start with a digit
    if !first_char.is_ascii_digit() {
        return None;
    }

    // Collect digit, optional decimal/comma
    let mut num_str = String::new();
    let mut saw_dot = false;
    let mut slash_mode = false;
    let mut slash_denom = String::new();

    for c in text.chars() {
        if c.is_ascii_digit() {
            if slash_mode {
                slash_denom.push(c);
            } else {
                num_str.push(c);
            }
        } else if (c == '.' || c == ',') && !saw_dot && !slash_mode {
            saw_dot = true;
            num_str.push('.');
        } else if c == '/' && !saw_dot && !slash_mode && !num_str.is_empty() {
            slash_mode = true;
        } else {
            break;
        }
    }

    let quantity = if slash_mode {
        let num = num_str.parse::<f64>().ok()?;
        let den = slash_denom.parse::<f64>().ok()?;
        if den == 0.0 {
            return None;
        }
        num / den
    } else {
        num_str.parse::<f64>().ok()?
    };

    // Calculate remainder: skip past the matched prefix + space
    let prefix_len = num_str.len() + if slash_mode { 1 + slash_denom.len() } else { 0 };
    let remainder = text
        .chars()
        .skip(prefix_len)
        .collect::<String>()
        .trim_start()
        .to_string();

    Some((quantity, remainder))
}

/// Formats a number for ingredient display (integer if no fractional part, comma decimal otherwise).
/// Mirrors `formatQuantity` in TypeScript.
pub fn format_quantity(value: f64) -> String {
    if value.fract() == 0.0 {
        (value as i64).to_string()
    } else {
        format!("{}", value).replace('.', ",")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ingredient_with_unit() {
        let result = parse_ingredient_line("200 g bloem");
        assert_eq!(result.quantity, Some(200.0));
        assert_eq!(result.unit.as_deref(), Some("g"));
        assert_eq!(result.name, "bloem");
        assert_eq!(result.raw_text, "200 g bloem");
    }

    #[test]
    fn parse_ingredient_without_unit() {
        let result = parse_ingredient_line("2 eieren");
        assert_eq!(result.quantity, Some(2.0));
        assert_eq!(result.unit, None);
        assert_eq!(result.name, "eieren");
    }

    #[test]
    fn parse_ingredient_no_quantity() {
        let result = parse_ingredient_line("zout naar smaak");
        assert_eq!(result.quantity, None);
        assert_eq!(result.name, "zout naar smaak");
    }

    #[test]
    fn parse_ingredient_fraction_unit() {
        let result = parse_ingredient_line("½ l melk");
        assert!((result.quantity.unwrap() - 0.5).abs() < 1e-9);
        assert_eq!(result.unit.as_deref(), Some("l"));
        assert_eq!(result.name, "melk");
    }

    #[test]
    fn clean_text_removes_nbsp() {
        assert_eq!(clean_text("hello\u{00a0}world"), "hello world");
    }

    #[test]
    fn parse_recipe_duration_iso() {
        assert_eq!(parse_recipe_duration("PT1H30M"), Some(90));
        assert_eq!(parse_recipe_duration("PT45M"), Some(45));
        assert_eq!(parse_recipe_duration("PT2H"), Some(120));
    }
}
