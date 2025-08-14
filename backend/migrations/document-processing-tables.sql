-- Document Processing Tables
-- For proper workflow: backend storage → encryption → IPFS → blockchain

-- Table for storing compressed documents
CREATE TABLE IF NOT EXISTS processed_documents (
    document_id VARCHAR(255) PRIMARY KEY,
    compressed_data BYTEA NOT NULL,              -- Compressed combined document
    original_files JSONB,                        -- Metadata about original files
    page_count INTEGER NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    server_address VARCHAR(255),
    case_number VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing alert images (first page with overlay)
CREATE TABLE IF NOT EXISTS alert_images (
    document_id VARCHAR(255) PRIMARY KEY REFERENCES processed_documents(document_id),
    image_data BYTEA NOT NULL,                   -- PNG image with overlay
    thumbnail_data BYTEA,                        -- Smaller thumbnail version
    mime_type VARCHAR(100) DEFAULT 'image/png',
    has_overlay BOOLEAN DEFAULT true,
    overlay_text VARCHAR(255) DEFAULT 'SEALED LEGAL DOCUMENT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking IPFS uploads
CREATE TABLE IF NOT EXISTS ipfs_uploads (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) REFERENCES processed_documents(document_id),
    ipfs_hash VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL,           -- 'document' or 'metadata'
    encryption_key VARCHAR(255),                 -- Stored encrypted
    recipient_address VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pin_status VARCHAR(50) DEFAULT 'pinned',
    UNIQUE(document_id, content_type)
);

-- Table for blockchain transaction records
CREATE TABLE IF NOT EXISTS blockchain_records (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) REFERENCES processed_documents(document_id),
    alert_nft_id INTEGER,
    document_nft_id INTEGER,
    transaction_hash VARCHAR(255) UNIQUE,
    recipient_address VARCHAR(255) NOT NULL,
    server_address VARCHAR(255) NOT NULL,
    metadata_uri TEXT,                           -- The data URI with base64 image
    ipfs_hash VARCHAR(255),                      -- The encrypted document IPFS hash
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_processed_documents_case ON processed_documents(case_number);
CREATE INDEX IF NOT EXISTS idx_processed_documents_server ON processed_documents(server_address);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_recipient ON blockchain_records(recipient_address);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_status ON blockchain_records(status);
CREATE INDEX IF NOT EXISTS idx_ipfs_uploads_hash ON ipfs_uploads(ipfs_hash);

-- Add columns to existing tables if they don't exist
DO $$ 
BEGIN
    -- Add alert image reference to notice_components if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notice_components' 
                   AND column_name = 'alert_image_id') THEN
        ALTER TABLE notice_components 
        ADD COLUMN alert_image_id VARCHAR(255) REFERENCES alert_images(document_id);
    END IF;
    
    -- Add processed document reference to notice_components
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notice_components' 
                   AND column_name = 'processed_document_id') THEN
        ALTER TABLE notice_components 
        ADD COLUMN processed_document_id VARCHAR(255) REFERENCES processed_documents(document_id);
    END IF;
END $$;