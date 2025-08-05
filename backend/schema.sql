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
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notice_views_notice_id (notice_id),
    INDEX idx_notice_views_viewer (viewer_address),
    INDEX idx_notice_views_timestamp (viewed_at)
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
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notice_acceptances_notice_id (notice_id),
    INDEX idx_notice_acceptances_acceptor (acceptor_address)
);

-- Served notices metadata
CREATE TABLE IF NOT EXISTS served_notices (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(20) UNIQUE NOT NULL,
    server_address VARCHAR(42) NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    notice_type VARCHAR(100),
    recipient_jurisdiction VARCHAR(100),
    case_number VARCHAR(100),
    document_hash VARCHAR(66),
    accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_served_notices_server (server_address),
    INDEX idx_served_notices_recipient (recipient_address),
    INDEX idx_served_notices_created (created_at)
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_logs_actor (actor_address),
    INDEX idx_audit_logs_action (action_type),
    INDEX idx_audit_logs_timestamp (created_at)
);

-- Create indexes for PostgreSQL (comment out for MySQL)
CREATE INDEX IF NOT EXISTS idx_process_servers_status ON process_servers(status);
CREATE INDEX IF NOT EXISTS idx_process_servers_wallet ON process_servers(LOWER(wallet_address));

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