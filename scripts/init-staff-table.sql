-- Create staff_list table for caching Airtable staff data
CREATE TABLE IF NOT EXISTS staff_list (
  staff_id VARCHAR(50) PRIMARY KEY,
  staff_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on staff_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_name ON staff_list(staff_name);

-- Add comment explaining the table
COMMENT ON TABLE staff_list IS 'Cache of staff members from Airtable Staff table. Synced daily via POST /api/staff-list/sync';
