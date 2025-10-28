-- Add check_type column to content_checks table
ALTER TABLE content_checks
ADD COLUMN IF NOT EXISTS check_type VARCHAR(50) DEFAULT 'regular';

-- Update existing records
UPDATE content_checks
SET check_type = 'regular'
WHERE check_type IS NULL;

-- Verify
SELECT COUNT(*) as total_checks, COUNT(check_type) as checks_with_type
FROM content_checks;
