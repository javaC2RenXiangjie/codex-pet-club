ALTER TABLE pet_submissions ADD COLUMN category TEXT NOT NULL DEFAULT 'other';
ALTER TABLE pet_submissions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

UPDATE pet_submissions
SET category = CASE
  WHEN lower(slug) LIKE '%cat%'
    OR lower(slug) LIKE '%kitty%'
    OR lower(name) LIKE '%cat%'
    OR lower(name) LIKE '%kitty%'
    OR name LIKE '%猫%'
  THEN 'animal'
  ELSE 'character'
END
WHERE category = 'other';

CREATE INDEX IF NOT EXISTS pet_published_category_updated_idx
ON pet_submissions(status, category, published_at DESC);
