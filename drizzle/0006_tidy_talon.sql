ALTER TABLE `pet_submissions` ADD `is_official` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pet_submissions` ADD `homepage_featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pet_submissions` ADD `homepage_priority` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `pet_homepage_featured_idx` ON `pet_submissions` (`status`,`homepage_featured`,`homepage_priority`,`published_at`);