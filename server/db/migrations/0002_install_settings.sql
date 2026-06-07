CREATE TABLE `install_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`openrouter_shopping_list_model` text DEFAULT 'deepseek/deepseek-v4-flash' NOT NULL,
	CONSTRAINT "install_settings_id_check" CHECK("id" = 1)
);
--> statement-breakpoint
INSERT OR IGNORE INTO `install_settings` ("id") VALUES (1);
