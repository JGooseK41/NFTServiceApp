-- Database schema for Legal Notice NFT Service Backend

-- Process servers table
CREATE TABLE IF NOT EXISTS process_servers (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    agency_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    phone_number VARCHAR(50),
    website VARCHAR(255),
    license_number VARCHAR(100),
    jurisdictions JSONB DEFAULT '[]',
    verification_documents JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    total_notices_served INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by VARCHAR(42)
);

-- Notice views table (tracks when notices are viewed)
CREATE TABLE IF NOT EXISTS notice_views (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(20) NOT NULL,
    viewer_address VARCHAR(42),
    ip_address VARCHAR(45),
    real_ip VARCHAR(45),
    user_agent TEXT,
    location_data JSONB,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notice acceptances table
CREATE TABLE IF NOT EXISTS notice_acceptances (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(20) NOT NULL UNIQUE,
    acceptor_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    ip_address VARCHAR(45),
    real_ip VARCHAR(45),
    location_data JSONB,
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Served notices metadata
CREATE TABLE IF NOT EXISTS served_notices (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(20) UNIQUE NOT NULL,
    alert_id VARCHAR(20),
    document_id VARCHAR(20),
    server_address VARCHAR(42) NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    notice_type VARCHAR(100),
    issuing_agency VARCHAR(255),
    case_number VARCHAR(100),
    document_hash VARCHAR(66),
    ipfs_hash VARCHAR(100),
    has_document BOOLEAN DEFAULT FALSE,
    accepted BOOLEAN DEFAULT FALSE,
    served_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Process server ratings
CREATE TABLE IF NOT EXISTS server_ratings (
    id SERIAL PRIMARY KEY,
    server_address VARCHAR(42) NOT NULL,
    rater_address VARCHAR(42) NOT NULL,
    notice_id VARCHAR(20),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_address, rater_address, notice_id)
);

-- Audit logs for all actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    actor_address VARCHAR(42),
    target_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    is_blockchain_synced BOOLEAN DEFAULT false,
    permissions JSONB DEFAULT '{}',
    added_by VARCHAR(100),
    last_sync_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin access logs table
CREATE TABLE IF NOT EXISTS admin_access_logs (
    id SERIAL PRIMARY KEY,
    admin_wallet VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet connection tracking table
CREATE TABLE IF NOT EXISTS wallet_connections (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('wallet_connected', 'manual_query')),
    ip_address VARCHAR(45),
    real_ip VARCHAR(45),
    user_agent TEXT,
    location_data JSONB,
    site VARCHAR(20),
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notice_count INTEGER DEFAULT 0
);

-- Create indexes for PostgreSQL
CREATE INDEX IF NOT EXISTS idx_process_servers_status ON process_servers(status);
CREATE INDEX IF NOT EXISTS idx_process_servers_wallet ON process_servers(LOWER(wallet_address));

-- Indexes for notice_views table
CREATE INDEX IF NOT EXISTS idx_notice_views_notice_id ON notice_views(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_views_viewer ON notice_views(viewer_address);
CREATE INDEX IF NOT EXISTS idx_notice_views_timestamp ON notice_views(viewed_at);

-- Indexes for notice_acceptances table
CREATE INDEX IF NOT EXISTS idx_notice_acceptances_notice_id ON notice_acceptances(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_acceptances_acceptor ON notice_acceptances(acceptor_address);

-- Indexes for served_notices table  
CREATE INDEX IF NOT EXISTS idx_served_notices_server ON served_notices(server_address);
CREATE INDEX IF NOT EXISTS idx_served_notices_recipient ON served_notices(recipient_address);
CREATE INDEX IF NOT EXISTS idx_served_notices_created ON served_notices(created_at);

-- Indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at);

-- Indexes for wallet_connections table
CREATE INDEX IF NOT EXISTS idx_wallet_connections_address ON wallet_connections(LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_wallet_connections_event ON wallet_connections(event_type);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_timestamp ON wallet_connections(connected_at);

-- Indexes for admin_users table
CREATE INDEX IF NOT EXISTS idx_admin_users_wallet ON admin_users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Indexes for admin_access_logs table
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_wallet ON admin_access_logs(admin_wallet);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_action ON admin_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_created ON admin_access_logs(created_at DESC);

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_process_servers_updated_at BEFORE UPDATE ON process_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_served_notices_updated_at BEFORE UPDATE ON served_notices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update process server average rating
CREATE OR REPLACE FUNCTION update_server_average_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE process_servers 
    SET average_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM server_ratings 
        WHERE server_address = NEW.server_address
    )
    WHERE wallet_address = NEW.server_address;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_average_rating AFTER INSERT OR UPDATE ON server_ratings
    FOR EACH ROW EXECUTE FUNCTION update_server_average_rating();