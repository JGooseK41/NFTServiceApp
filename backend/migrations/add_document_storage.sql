-- Add columns to store thumbnail and unencrypted document for process server receipts
ALTER TABLE served_notices 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS unencrypted_document_url TEXT,
ADD COLUMN IF NOT EXISTS nft_description TEXT,
ADD COLUMN IF NOT EXISTS alert_id INTEGER,
ADD COLUMN IF NOT EXISTS document_id INTEGER;

-- Create a new table to better track the dual-NFT structure
CREATE TABLE IF NOT EXISTS notice_components (
    id SERIAL PRIMARY KEY,
    notice_id INTEGER NOT NULL,
    case_number VARCHAR(255) NOT NULL,
    server_address VARCHAR(255) NOT NULL,
    recipient_address VARCHAR(255) NOT NULL,
    
    -- Alert NFT data
    alert_id INTEGER NOT NULL,
    alert_thumbnail_url TEXT,
    alert_nft_description TEXT,
    alert_token_uri TEXT,
    alert_acknowledged BOOLEAN DEFAULT FALSE,
    alert_acknowledged_at TIMESTAMP,
    
    -- Document NFT data  
    document_id INTEGER NOT NULL,
    document_ipfs_hash VARCHAR(255),
    document_encryption_key TEXT,
    document_unencrypted_url TEXT,  -- Backend storage for server's unencrypted copy
    document_accepted BOOLEAN DEFAULT FALSE,
    document_accepted_at TIMESTAMP,
    
    -- Common data
    notice_type VARCHAR(100),
    issuing_agency VARCHAR(255),
    served_at TIMESTAMP NOT NULL,
    chain_type VARCHAR(50) NOT NULL DEFAULT 'tron_mainnet',
    transaction_hash VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(notice_id, chain_type)
);

-- Create indexes separately (PostgreSQL syntax)
CREATE INDEX IF NOT EXISTS idx_case_number ON notice_components(case_number);
CREATE INDEX IF NOT EXISTS idx_server_address ON notice_components(server_address);
CREATE INDEX IF NOT EXISTS idx_recipient_address ON notice_components(recipient_address);