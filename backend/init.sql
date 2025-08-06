-- Initialize NFT Legal Service Database Tables

-- Notice views tracking
CREATE TABLE IF NOT EXISTS notice_views (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(100) NOT NULL,
    viewer_address VARCHAR(100),
    ip_address VARCHAR(45),
    real_ip VARCHAR(45),
    user_agent TEXT,
    location_data JSONB,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notice acceptances tracking
CREATE TABLE IF NOT EXISTS notice_acceptances (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(100) UNIQUE NOT NULL,
    acceptor_address VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(100),
    ip_address VARCHAR(45),
    real_ip VARCHAR(45),
    location_data JSONB,
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Served notices metadata
CREATE TABLE IF NOT EXISTS served_notices (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(100) UNIQUE NOT NULL,
    alert_id VARCHAR(100),
    document_id VARCHAR(100),
    server_address VARCHAR(100) NOT NULL,
    recipient_address VARCHAR(100) NOT NULL,
    notice_type VARCHAR(100),
    issuing_agency VARCHAR(255),
    case_number VARCHAR(100),
    recipient_jurisdiction VARCHAR(100),
    document_hash VARCHAR(100),
    ipfs_hash VARCHAR(100),
    has_document BOOLEAN DEFAULT false,
    accepted BOOLEAN DEFAULT false,
    accepted_at TIMESTAMP,
    served_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Process servers registry
CREATE TABLE IF NOT EXISTS process_servers (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(100) UNIQUE NOT NULL,
    agency_name VARCHAR(255),
    contact_email VARCHAR(255),
    phone_number VARCHAR(50),
    website VARCHAR(255),
    license_number VARCHAR(100),
    jurisdictions JSONB,
    verification_documents JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    total_notices_served INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL,
    actor_address VARCHAR(100),
    target_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet connections tracking
CREATE TABLE IF NOT EXISTS wallet_connections (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(100) NOT NULL,
    event_type VARCHAR(50),
    ip_address VARCHAR(45),
    real_ip VARCHAR(45),
    user_agent TEXT,
    location_data JSONB,
    site VARCHAR(100),
    notice_count INTEGER DEFAULT 0,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blockchain cache
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notice_views_notice_id ON notice_views(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_views_viewer_address ON notice_views(viewer_address);
CREATE INDEX IF NOT EXISTS idx_notice_acceptances_notice_id ON notice_acceptances(notice_id);
CREATE INDEX IF NOT EXISTS idx_served_notices_server_address ON served_notices(server_address);
CREATE INDEX IF NOT EXISTS idx_served_notices_recipient_address ON served_notices(recipient_address);
CREATE INDEX IF NOT EXISTS idx_process_servers_status ON process_servers(status);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_wallet_address ON wallet_connections(wallet_address);
CREATE INDEX IF NOT EXISTS idx_blockchain_cache_contract_address ON blockchain_cache(contract_address);