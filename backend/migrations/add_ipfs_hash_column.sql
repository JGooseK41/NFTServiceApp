-- Migration to add ipfs_hash column to served_notices table
-- This column was referenced in the code but missing from the database

-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='served_notices' 
        AND column_name='ipfs_hash'
    ) THEN
        ALTER TABLE served_notices ADD COLUMN ipfs_hash TEXT;
        RAISE NOTICE 'Added ipfs_hash column to served_notices table';
    ELSE
        RAISE NOTICE 'ipfs_hash column already exists in served_notices table';
    END IF;
END $$;

-- Also ensure document_ipfs_hash column exists in notice_views table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='notice_views' 
        AND column_name='document_ipfs_hash'
    ) THEN
        ALTER TABLE notice_views ADD COLUMN document_ipfs_hash TEXT;
        RAISE NOTICE 'Added document_ipfs_hash column to notice_views table';
    ELSE
        RAISE NOTICE 'document_ipfs_hash column already exists in notice_views table';
    END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_served_notices_ipfs_hash 
ON served_notices(ipfs_hash) 
WHERE ipfs_hash IS NOT NULL;