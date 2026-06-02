//! Distinct categories and tags merged with catalog defaults.

use std::collections::BTreeSet;

use serde_json::{json, Value};

use crate::shadow_server::{
    platform::RepoError,
    recipe_catalog::{
        defaults::{DEFAULT_CATEGORIES, DEFAULT_TAGS},
        ports::RecipeRepository,
    },
};

pub fn execute(repo: &dyn RecipeRepository) -> Result<Value, RepoError> {
    let (stored_cats, stored_tags) = repo.list_stored_options()?;

    let mut categories: BTreeSet<String> =
        DEFAULT_CATEGORIES.iter().map(|s| s.to_string()).collect();
    let mut tags: BTreeSet<String> = DEFAULT_TAGS.iter().map(|s| s.to_string()).collect();

    for c in stored_cats {
        categories.insert(c);
    }
    for t in stored_tags {
        tags.insert(t);
    }

    Ok(json!({
        "categories": categories.into_iter().collect::<Vec<_>>(),
        "tags": tags.into_iter().collect::<Vec<_>>(),
    }))
}
