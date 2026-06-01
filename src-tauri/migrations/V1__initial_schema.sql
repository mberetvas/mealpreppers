-- V1: Initial schema
--
-- Ported from the Drizzle catalog and planning migrations.
-- Applied by the Rust Desktop Local API migration runner;
-- tracked in `_rust_schema_migrations` (not Drizzle's __drizzle_migrations).

CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source_url TEXT,
    source_host TEXT,
    image_url TEXT,
    servings INTEGER,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    total_time_minutes INTEGER,
    difficulty TEXT,
    categories TEXT NOT NULL,
    tags TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS recipes_created_at_idx ON recipes (created_at);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY NOT NULL,
    recipe_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    raw_text TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_position_idx
    ON recipe_ingredients (recipe_id, position);

CREATE TABLE IF NOT EXISTS recipe_steps (
    id TEXT PRIMARY KEY NOT NULL,
    recipe_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS recipe_steps_recipe_id_position_idx
    ON recipe_steps (recipe_id, position);

CREATE TABLE IF NOT EXISTS meal_month_plans (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS meal_month_plans_updated_at_idx ON meal_month_plans (updated_at);

CREATE TABLE IF NOT EXISTS meal_week_templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    owner_user_id TEXT,
    anon_session_id TEXT,
    consolidated_shopping_list TEXT
);

CREATE INDEX IF NOT EXISTS meal_week_templates_updated_at_idx
    ON meal_week_templates (updated_at);
CREATE INDEX IF NOT EXISTS meal_week_templates_owner_user_id_idx
    ON meal_week_templates (owner_user_id);
CREATE INDEX IF NOT EXISTS meal_week_templates_anon_session_id_idx
    ON meal_week_templates (anon_session_id, updated_at);
