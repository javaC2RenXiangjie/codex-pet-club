CREATE TABLE `moderation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`pet_key` text NOT NULL,
	`display_name` text NOT NULL,
	`action` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `moderation_events_created_idx` ON `moderation_events` (`created_at` DESC);
--> statement-breakpoint
CREATE TABLE `submission_rate_limits` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
