-- Create notice_views table if it doesn't exist
CREATE TABLE IF NOT EXISTS notice_views (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(255) NOT NULL,
    viewer_address VARCHAR(255),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_notice_views_notice_id ON notice_views(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_views_viewed_at ON notice_views(viewed_at);

-- Add accepted_at column if missing
ALTER TABLE served_notices 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'served_notices'
ORDER BY ordinal_position;