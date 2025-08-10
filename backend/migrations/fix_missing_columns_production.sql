-- Production migration to fix missing columns
-- Run this script in Render's PostgreSQL shell
-- Date: 2025-08-10

-- First, add missing columns to served_notices table
ALTER TABLE served_notices 
ADD COLUMN IF NOT EXISTS compiled_document_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS compiled_document_url TEXT,
ADD COLUMN IF NOT EXISTS compiled_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1;

-- Verify served_notices columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'served_notices' 
AND column_name IN ('compiled_document_id', 'compiled_document_url', 'compiled_thumbnail_url', 'page_count');

-- Create notice_components table if it doesn't exist
CREATE TABLE IF NOT EXISTS notice_components (
    id SERIAL PRIMARY KEY,
    notice_id INTEGER NOT NULL,
    case_number VARCHAR(255) NOT NULL,
    server_address VARCHAR(255) NOT NULL,
    recipient_address VARCHAR(255) NOT NULL,
    alert_id VARCHAR(255),
    alert_thumbnail_url TEXT,
    alert_nft_description TEXT,
    document_id VARCHAR(255),
    document_ipfs_hash VARCHAR(255),
    document_encryption_key TEXT,
    document_unencrypted_url TEXT,
    notice_type VARCHAR(255),
    issuing_agency VARCHAR(255),
    alert_acknowledged BOOLEAN DEFAULT FALSE,
    alert_acknowledged_at TIMESTAMP,
    document_accepted BOOLEAN DEFAULT FALSE,
    document_accepted_at TIMESTAMP,
    served_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    chain_type VARCHAR(50) DEFAULT 'mainnet',
    page_count INTEGER DEFAULT 1,
    is_compiled BOOLEAN DEFAULT FALSE,
    document_count INTEGER DEFAULT 1
);

-- Add any missing columns to notice_components if table already exists
ALTER TABLE notice_components 
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_compiled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS document_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS chain_type VARCHAR(50) DEFAULT 'mainnet';

-- Create indexes for notice_components
CREATE INDEX IF NOT EXISTS idx_nc_case_number ON notice_components(case_number);
CREATE INDEX IF NOT EXISTS idx_nc_server_address ON notice_components(server_address);
CREATE INDEX IF NOT EXISTS idx_nc_recipient_address ON notice_components(recipient_address);
CREATE INDEX IF NOT EXISTS idx_nc_notice_id ON notice_components(notice_id);
CREATE INDEX IF NOT EXISTS idx_nc_served_at ON notice_components(served_at);

-- Verify notice_components columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notice_components'
ORDER BY ordinal_position;

-- Create trigger to update the updated_at timestamp for notice_components
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_notice_components_updated_at ON notice_components;
CREATE TRIGGER update_notice_components_updated_at 
BEFORE UPDATE ON notice_components
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify all tables and columns
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name IN ('served_notices', 'notice_components')
GROUP BY table_name
ORDER BY table_name;

-- Check for any existing data that might need migration
SELECT COUNT(*) as served_notices_count FROM served_notices;
SELECT COUNT(*) as notice_components_count FROM notice_components;

-- Output success message
SELECT 'Migration completed successfully. All missing columns have been added.' as status;