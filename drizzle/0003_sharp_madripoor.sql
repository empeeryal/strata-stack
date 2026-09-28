CREATE TABLE `newsletter_subscriber` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`token` text NOT NULL,
	`source` text,
	`confirmation_sent_at` integer,
	`confirmed_at` integer,
	`unsubscribed_at` integer,
	`audience_synced_at` integer,
	`audience_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscriber_email_unique` ON `newsletter_subscriber` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscriber_token_unique` ON `newsletter_subscriber` (`token`);--> statement-breakpoint
CREATE INDEX `newsletter_subscriber_status_updated_at_idx` ON `newsletter_subscriber` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `newsletter_subscriber_created_at_idx` ON `newsletter_subscriber` (`created_at`);