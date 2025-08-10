-- Production migration to fix schema issues
-- Run this script in Render's PostgreSQL shell
-- Date: 2025-08-10

-- IMPORTANT: This migration removes redundant compiled_document columns
-- and ensures notice_components table has all required columns

-- First, ensure notice_components table exists with all required columns
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

-- Add missing columns to notice_components if table already exists
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

-- Remove redundant columns from served_notices if they exist
-- These columns are not needed since data is stored in notice_components
ALTER TABLE served_notices 
DROP COLUMN IF EXISTS compiled_document_id,
DROP COLUMN IF EXISTS compiled_document_url,
DROP COLUMN IF EXISTS compiled_thumbnail_url,
DROP COLUMN IF EXISTS page_count;

-- Ensure served_notices has all necessary columns
ALTER TABLE served_notices
ADD COLUMN IF NOT EXISTS alert_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS document_id VARCHAR(20);

-- Create or replace trigger for notice_components updated_at
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

-- Verify the schema is correct
SELECT 
    'served_notices' as table_name,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'served_notices'
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
    'notice_components' as table_name,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'notice_components'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check for any existing data
SELECT 
    'served_notices' as table_name,
    COUNT(*) as row_count 
FROM served_notices
UNION ALL
SELECT 
    'notice_components' as table_name,
    COUNT(*) as row_count 
FROM notice_components;

-- Output success message
SELECT 'Migration completed successfully. Redundant columns removed, notice_components table ready.' as status;