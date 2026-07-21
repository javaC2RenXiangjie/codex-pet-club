ALTER TABLE pet_submissions ADD COLUMN is_official INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pet_submissions ADD COLUMN homepage_featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pet_submissions ADD COLUMN homepage_priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS pet_homepage_featured_idx
ON pet_submissions(status, homepage_featured, homepage_priority DESC, published_at DESC);
