ALTER TABLE `pet_submissions` ADD `category` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `pet_submissions` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `pet_published_category_updated_idx` ON `pet_submissions` (`status`,`category`,`published_at`);