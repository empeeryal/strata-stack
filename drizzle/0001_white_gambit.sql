CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_email` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `contact_message` ADD `status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `contact_message` ADD `delivery_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `contact_message` ADD `delivery_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contact_message` ADD `delivery_error` text;--> statement-breakpoint
ALTER TABLE `contact_message` ADD `delivered_at` integer;--> statement-breakpoint
ALTER TABLE `contact_message` ADD `read_at` integer;--> statement-breakpoint
ALTER TABLE `contact_message` ADD `archived_at` integer;--> statement-breakpoint
CREATE INDEX `contact_message_status_idx` ON `contact_message` (`status`);--> statement-breakpoint
CREATE INDEX `contact_message_email_idx` ON `contact_message` (`email`);--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;