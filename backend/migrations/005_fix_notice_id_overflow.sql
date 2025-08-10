-- Migration to fix notice_id integer overflow issue
-- Changes notice_id and related fields to support larger values

-- 1. Change notice_id columns to TEXT (most flexible for any ID format)
ALTER TABLE notices 
    ALTER COLUMN notice_id TYPE TEXT,
    ALTER COLUMN alert_id TYPE TEXT,
    ALTER COLUMN document_id TYPE TEXT;

-- 2. Update notice_documents table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notice_documents') THEN
        ALTER TABLE notice_documents 
            ALTER COLUMN notice_id TYPE TEXT;
    END IF;
END $$;

-- 3. Update notice_images table if it exists  
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notice_images') THEN
        ALTER TABLE notice_images 
            ALTER COLUMN notice_id TYPE TEXT;
    END IF;
END $$;

-- 4. Add index for performance on text columns
CREATE INDEX IF NOT EXISTS idx_notices_notice_id_text ON notices(notice_id);
CREATE INDEX IF NOT EXISTS idx_notices_alert_id_text ON notices(alert_id);
CREATE INDEX IF NOT EXISTS idx_notices_document_id_text ON notices(document_id);

-- 5. Add a proper ID generation function for future use
CREATE OR REPLACE FUNCTION generate_notice_id()
RETURNS TEXT AS $$
BEGIN
    -- Generate a unique ID: timestamp_random
    -- Example: 1754857_789 (shorter and always unique)
    RETURN FLOOR(EXTRACT(EPOCH FROM NOW()))::TEXT || '_' || FLOOR(RANDOM() * 1000)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. Create batch upload tracking table for future batch operations
CREATE TABLE IF NOT EXISTS batch_uploads (
    id SERIAL PRIMARY KEY,
    batch_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    server_address TEXT NOT NULL,
    recipient_count INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    metadata JSONB
);

-- 7. Create notice_batch_items for tracking individual items in a batch
CREATE TABLE IF NOT EXISTS notice_batch_items (
    id SERIAL PRIMARY KEY,
    batch_id TEXT REFERENCES batch_uploads(batch_id),
    notice_id TEXT,
    recipient_address TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE batch_uploads IS 'Tracks batch notice operations for multiple recipients';
COMMENT ON TABLE notice_batch_items IS 'Individual notices within a batch operation';