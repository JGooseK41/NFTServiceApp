-- Migration to add image URL columns for notice viewing
-- These columns store URLs to notice images for process server viewing

-- Add columns to served_notices table
DO $$ 
BEGIN
    -- Add alert_thumbnail_url column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='served_notices' 
        AND column_name='alert_thumbnail_url'
    ) THEN
        ALTER TABLE served_notices ADD COLUMN alert_thumbnail_url TEXT;
        RAISE NOTICE 'Added alert_thumbnail_url column to served_notices table';
    END IF;

    -- Add document_unencrypted_url column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='served_notices' 
        AND column_name='document_unencrypted_url'
    ) THEN
        ALTER TABLE served_notices ADD COLUMN document_unencrypted_url TEXT;
        RAISE NOTICE 'Added document_unencrypted_url column to served_notices table';
    END IF;

    -- Add recipient_name column if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='served_notices' 
        AND column_name='recipient_name'
    ) THEN
        ALTER TABLE served_notices ADD COLUMN recipient_name VARCHAR(255);
        RAISE NOTICE 'Added recipient_name column to served_notices table';
    END IF;

    -- Add page_count column if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='served_notices' 
        AND column_name='page_count'
    ) THEN
        ALTER TABLE served_notices ADD COLUMN page_count INTEGER DEFAULT 1;
        RAISE NOTICE 'Added page_count column to served_notices table';
    END IF;

    -- Add transaction_hash column if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='served_notices' 
        AND column_name='transaction_hash'
    ) THEN
        ALTER TABLE served_notices ADD COLUMN transaction_hash VARCHAR(100);
        RAISE NOTICE 'Added transaction_hash column to served_notices table';
    END IF;

    -- Add block_number column if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='served_notices' 
        AND column_name='block_number'
    ) THEN
        ALTER TABLE served_notices ADD COLUMN block_number BIGINT;
        RAISE NOTICE 'Added block_number column to served_notices table';
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_served_notices_alert_id ON served_notices(alert_id);
CREATE INDEX IF NOT EXISTS idx_served_notices_document_id ON served_notices(document_id);
CREATE INDEX IF NOT EXISTS idx_served_notices_case_number ON served_notices(case_number);
CREATE INDEX IF NOT EXISTS idx_served_notices_server_address ON served_notices(server_address);

-- Add comment explaining the columns
COMMENT ON COLUMN served_notices.alert_thumbnail_url IS 'URL to the alert notice thumbnail image';
COMMENT ON COLUMN served_notices.document_unencrypted_url IS 'URL to the unencrypted document for process server viewing';