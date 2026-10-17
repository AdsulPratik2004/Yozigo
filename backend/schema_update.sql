-- Add language column to movies table if it doesn't exist
ALTER TABLE movies ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'English';

-- Fix rating column to allow numeric values instead of just 'U', 'UA', 'A'
ALTER TABLE movies DROP CONSTRAINT IF EXISTS movies_rating_check;
ALTER TABLE movies ALTER COLUMN rating TYPE NUMERIC(8,2) USING CASE 
    WHEN rating = 'U' THEN 0.0
    WHEN rating = 'UA' THEN 7.5
    WHEN rating = 'A' THEN 18.0
    ELSE NULLIF(regexp_replace(rating::text, '[^0-9.]', '', 'g'), '')::NUMERIC
END;

-- Update existing rating values if needed
UPDATE movies SET rating = NULL WHERE rating = '';
