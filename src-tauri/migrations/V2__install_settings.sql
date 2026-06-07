CREATE TABLE IF NOT EXISTS install_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  openrouter_shopping_list_model TEXT NOT NULL DEFAULT 'deepseek/deepseek-v4-flash'
);
INSERT OR IGNORE INTO install_settings (id) VALUES (1);
