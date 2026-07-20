CREATE TABLE `maintenance_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`backup_key` text,
	`deleted_records` integer DEFAULT 0 NOT NULL,
	`error` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `maintenance_runs_started_idx` ON `maintenance_runs` (`started_at`);
