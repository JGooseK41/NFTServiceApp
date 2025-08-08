-- Add missing columns to served_notices table
ALTER TABLE served_notices 
ADD COLUMN IF NOT EXISTS alert_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS document_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS issuing_agency VARCHAR(200),
ADD COLUMN IF NOT EXISTS document_hash TEXT,
ADD COLUMN IF NOT EXISTS ipfs_hash TEXT,
ADD COLUMN IF NOT EXISTS has_document BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recipient_jurisdiction VARCHAR(100);

-- Create active_notices table if it doesn't exist (used by notices route)
CREATE TABLE IF NOT EXISTS active_notices (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(100) UNIQUE,
    alert_id VARCHAR(100),
    document_id VARCHAR(100),
    server_address VARCHAR(100),
    recipient_address VARCHAR(100),
    notice_type VARCHAR(100),
    issuing_agency VARCHAR(200),
    case_number VARCHAR(100),
    document_hash TEXT,
    ipfs_hash TEXT,
    has_document BOOLEAN DEFAULT false,
    accepted BOOLEAN DEFAULT false,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notice_views table if missing
CREATE TABLE IF NOT EXISTS notice_views (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(100),
    viewer_address VARCHAR(100),
    ip_address VARCHAR(100),
    user_agent TEXT,
    location_data JSONB,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    real_ip VARCHAR(100)
);

-- Create notice_acceptances table if missing
CREATE TABLE IF NOT EXISTS notice_acceptances (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(100) UNIQUE,
    acceptor_address VARCHAR(100),
    transaction_hash VARCHAR(100),
    ip_address VARCHAR(100),
    location_data JSONB,
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    real_ip VARCHAR(100)
);

-- Create audit_logs table if missing
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(100),
    actor_address VARCHAR(100),
    target_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create process_servers table if missing
CREATE TABLE IF NOT EXISTS process_servers (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(100) UNIQUE,
    agency_name VARCHAR(200),
    contact_email VARCHAR(200),
    phone_number VARCHAR(50),
    website VARCHAR(200),
    license_number VARCHAR(100),
    jurisdictions JSONB,
    verification_documents JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    total_notices_served INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallet_connections table if missing
CREATE TABLE IF NOT EXISTS wallet_connections (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(100),
    event_type VARCHAR(100),
    ip_address VARCHAR(100),
    real_ip VARCHAR(100),
    user_agent TEXT,
    location_data JSONB,
    site VARCHAR(200),
    notice_count INTEGER DEFAULT 0,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create blockchain_cache table if missing
CREATE TABLE IF NOT EXISTS blockchain_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE,
    type VARCHAR(50),
    notice_id VARCHAR(100),
    data JSONB,
    network VARCHAR(50),
    contract_address VARCHAR(100),
    timestamp BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_served_notices_server ON served_notices(server_address);
CREATE INDEX IF NOT EXISTS idx_served_notices_recipient ON served_notices(recipient_address);
CREATE INDEX IF NOT EXISTS idx_served_notices_case ON served_notices(case_number);
CREATE INDEX IF NOT EXISTS idx_notice_views_notice ON notice_views(notice_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_address);

-- Insert case 34-987654 if not exists
INSERT INTO served_notices (
    notice_id, 
    alert_id, 
    document_id, 
    server_address, 
    recipient_address,
    notice_type, 
    issuing_agency, 
    case_number, 
    ipfs_hash, 
    has_document
) VALUES (
    '1',
    '3',
    '4', 
    'tgdd34rr3rzfuozoqlze9d4tzfbigl4jay',
    'td1f37v4cafh1yqcyvltcfyfxkzus7mbde',
    'Notice of Seizure',
    'The Block Audit',
    '34-987654',
    'Qmc6cdUtoncRb9Lb5T9dzLF5mXqPqWEF4RKwDgEnGnxTTd',
    true
) ON CONFLICT (notice_id) DO UPDATE SET
    alert_id = EXCLUDED.alert_id,
    document_id = EXCLUDED.document_id,
    server_address = EXCLUDED.server_address,
    case_number = EXCLUDED.case_number,
    issuing_agency = EXCLUDED.issuing_agency;