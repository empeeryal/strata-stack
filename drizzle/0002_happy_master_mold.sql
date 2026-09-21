DROP INDEX `contact_message_status_idx`;--> statement-breakpoint
ALTER TABLE `contact_message` ADD `delivery_claimed_at` integer;--> statement-breakpoint
CREATE INDEX `contact_message_status_created_at_idx` ON `contact_message` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `contact_message_delivery_created_at_idx` ON `contact_message` (`delivery_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `contact_message_created_at_idx` ON `contact_message` (`created_at`);