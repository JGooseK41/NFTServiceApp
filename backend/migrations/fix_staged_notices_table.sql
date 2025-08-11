-- Fix staged_notices table structure
-- This migration adds missing columns to the existing table

-- Add missing columns if they don't exist
ALTER TABLE staged_notices 
ADD COLUMN IF NOT EXISTS recipient_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS encrypted_ipfs TEXT,
ADD COLUMN IF NOT EXISTS encryption_key TEXT,
ADD COLUMN IF NOT EXISTS issuing_agency VARCHAR(255),
ADD COLUMN IF NOT EXISTS notice_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS case_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS case_details TEXT,
ADD COLUMN IF NOT EXISTS legal_rights TEXT,
ADD COLUMN IF NOT EXISTS sponsor_fees BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS metadata_uri TEXT,
ADD COLUMN IF NOT EXISTS server_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS alert_id TEXT,
ADD COLUMN IF NOT EXISTS document_id TEXT,
ADD COLUMN IF NOT EXISTS notice_id TEXT,
ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS block_number BIGINT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_staged_notices_status ON staged_notices(status);
CREATE INDEX IF NOT EXISTS idx_staged_notices_server ON staged_notices(server_address);
CREATE INDEX IF NOT EXISTS idx_staged_notices_recipient ON staged_notices(recipient_address);
CREATE INDEX IF NOT EXISTS idx_staged_notices_created ON staged_notices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staged_notices_tx_hash ON staged_notices(transaction_hash);

-- Add unique constraint on transaction hash if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_staged_notices_tx_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_staged_notices_tx_unique 
            ON staged_notices(transaction_hash) 
            WHERE transaction_hash IS NOT NULL;
    END IF;
END $$;

-- Check what columns exist now
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staged_notices'
ORDER BY ordinal_position;

-- Show table structure
\d staged_notices