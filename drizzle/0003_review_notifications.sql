CREATE TABLE `review_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`request_id` text,
	`next_attempt_at` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE INDEX `review_notifications_retry_idx` ON `review_notifications` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `review_notifications_submission_idx` ON `review_notifications` (`submission_id`,`created_at`);
