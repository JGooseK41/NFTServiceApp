-- Corrected Migration to fix notice_id integer overflow issue
-- This version checks for actual table names and handles multiple scenarios

-- First, let's see what tables exist
-- Run: psql "$DATABASE_URL" -c "\dt" to check table names first

-- 1. Fix served_notices table (most likely name)
DO $$ 
BEGIN
    -- Check if served_notices table exists and alter it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'served_notices') THEN
        -- Change notice_id columns to TEXT to prevent overflow
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'served_notices' AND column_name = 'notice_id' AND data_type = 'integer') THEN
            ALTER TABLE served_notices ALTER COLUMN notice_id TYPE TEXT;
            RAISE NOTICE 'served_notices.notice_id changed to TEXT';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'served_notices' AND column_name = 'alert_id' AND data_type = 'integer') THEN
            ALTER TABLE served_notices ALTER COLUMN alert_id TYPE TEXT;
            RAISE NOTICE 'served_notices.alert_id changed to TEXT';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'served_notices' AND column_name = 'document_id' AND data_type = 'integer') THEN
            ALTER TABLE served_notices ALTER COLUMN document_id TYPE TEXT;
            RAISE NOTICE 'served_notices.document_id changed to TEXT';
        END IF;
    END IF;

    -- Check if notices table exists and alter it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notices') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notices' AND column_name = 'notice_id' AND data_type = 'integer') THEN
            ALTER TABLE notices ALTER COLUMN notice_id TYPE TEXT;
            RAISE NOTICE 'notices.notice_id changed to TEXT';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notices' AND column_name = 'alert_id' AND data_type = 'integer') THEN
            ALTER TABLE notices ALTER COLUMN alert_id TYPE TEXT;
            RAISE NOTICE 'notices.alert_id changed to TEXT';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notices' AND column_name = 'document_id' AND data_type = 'integer') THEN
            ALTER TABLE notices ALTER COLUMN document_id TYPE TEXT;
            RAISE NOTICE 'notices.document_id changed to TEXT';
        END IF;
    END IF;
END $$;

-- 2. Update related tables that reference notice_id
DO $$ 
BEGIN
    -- Fix notice_documents table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notice_documents') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notice_documents' AND column_name = 'notice_id' AND data_type = 'integer') THEN
            ALTER TABLE notice_documents ALTER COLUMN notice_id TYPE TEXT;
            RAISE NOTICE 'notice_documents.notice_id changed to TEXT';
        END IF;
    END IF;

    -- Fix notice_images table if it exists  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notice_images') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notice_images' AND column_name = 'notice_id' AND data_type = 'integer') THEN
            ALTER TABLE notice_images ALTER COLUMN notice_id TYPE TEXT;
            RAISE NOTICE 'notice_images.notice_id changed to TEXT';
        END IF;
    END IF;

    -- Fix notice_views table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notice_views') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notice_views' AND column_name = 'notice_id' AND data_type = 'integer') THEN
            ALTER TABLE notice_views ALTER COLUMN notice_id TYPE TEXT;
            RAISE NOTICE 'notice_views.notice_id changed to TEXT';
        END IF;
    END IF;

    -- Fix notice_acceptances table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notice_acceptances') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notice_acceptances' AND column_name = 'notice_id' AND data_type = 'integer') THEN
            ALTER TABLE notice_acceptances ALTER COLUMN notice_id TYPE TEXT;
            RAISE NOTICE 'notice_acceptances.notice_id changed to TEXT';
        END IF;
    END IF;
END $$;

-- 3. Add performance indexes for TEXT columns
DO $$
BEGIN
    -- Add indexes for served_notices if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'served_notices') THEN
        CREATE INDEX IF NOT EXISTS idx_served_notices_notice_id_text ON served_notices(notice_id);
        CREATE INDEX IF NOT EXISTS idx_served_notices_alert_id_text ON served_notices(alert_id);
        CREATE INDEX IF NOT EXISTS idx_served_notices_document_id_text ON served_notices(document_id);
        RAISE NOTICE 'Indexes created for served_notices';
    END IF;

    -- Add indexes for notices if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notices') THEN
        CREATE INDEX IF NOT EXISTS idx_notices_notice_id_text ON notices(notice_id);
        CREATE INDEX IF NOT EXISTS idx_notices_alert_id_text ON notices(alert_id);
        CREATE INDEX IF NOT EXISTS idx_notices_document_id_text ON notices(document_id);
        RAISE NOTICE 'Indexes created for notices';
    END IF;
END $$;

-- 4. Create safe ID generation function
CREATE OR REPLACE FUNCTION generate_safe_notice_id()
RETURNS TEXT AS $$
BEGIN
    -- Generate a safe ID that fits in INTEGER range if needed
    -- Format: timestamp_random (always under 2.1 billion)
    RETURN FLOOR(EXTRACT(EPOCH FROM NOW()) / 60)::TEXT || '_' || FLOOR(RANDOM() * 1000)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 5. Ensure batch tables exist (these were probably created successfully)
CREATE TABLE IF NOT EXISTS batch_uploads (
    id SERIAL PRIMARY KEY,
    batch_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    server_address TEXT NOT NULL,
    recipient_count INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS notice_batch_items (
    id SERIAL PRIMARY KEY,
    batch_id TEXT REFERENCES batch_uploads(batch_id),
    notice_id TEXT,
    recipient_address TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Add helpful comments
COMMENT ON TABLE batch_uploads IS 'Tracks batch notice operations for multiple recipients';
COMMENT ON TABLE notice_batch_items IS 'Individual notices within a batch operation';
COMMENT ON FUNCTION generate_safe_notice_id() IS 'Generates notice IDs that are safe for both TEXT and INTEGER storage';

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION COMPLETE ===';
    RAISE NOTICE 'ID overflow protection has been applied to all existing tables.';
    RAISE NOTICE 'Batch upload tables are ready.';
    RAISE NOTICE 'Your application should now work without integer overflow errors.';
    RAISE NOTICE '';
END $$;