CREATE TABLE `meal_month_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_month_plans_updated_at_idx` ON `meal_month_plans` (`updated_at`);--> statement-breakpoint
CREATE TABLE `meal_week_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`owner_user_id` text,
	`anon_session_id` text,
	`consolidated_shopping_list` text
);
--> statement-breakpoint
CREATE INDEX `meal_week_templates_updated_at_idx` ON `meal_week_templates` (`updated_at`);--> statement-breakpoint
CREATE INDEX `meal_week_templates_owner_user_id_idx` ON `meal_week_templates` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `meal_week_templates_anon_session_id_idx` ON `meal_week_templates` (`anon_session_id`,`updated_at`);