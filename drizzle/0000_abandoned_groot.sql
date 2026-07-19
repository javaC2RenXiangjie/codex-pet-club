CREATE TABLE `pet_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`license` text DEFAULT 'unspecified' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`file_key` text NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`reviewed_at` text,
	`review_note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pet_published_slug_unique` ON `pet_submissions` (`slug`) WHERE "pet_submissions"."status" = 'published';
--> statement-breakpoint
CREATE INDEX `pet_status_updated_idx` ON `pet_submissions` (`status`,`updated_at` DESC);
