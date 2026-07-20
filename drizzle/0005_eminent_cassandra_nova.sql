CREATE TABLE `submission_metadata_events` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submission_metadata_events_submission_idx` ON `submission_metadata_events` (`submission_id`,`created_at`);