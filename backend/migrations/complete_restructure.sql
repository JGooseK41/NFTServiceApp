-- Complete Backend Restructure for NFT Legal Notice Service
-- This migration creates the proper workflow-based schema

-- ================================================
-- STEP 1: DROP OLD/UNUSED TABLES
-- ================================================

-- Drop old tables that will be replaced
DROP TABLE IF EXISTS served_notices CASCADE;
DROP TABLE IF EXISTS notice_views CASCADE;
DROP TABLE IF EXISTS notice_acceptances CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- ================================================
-- STEP 2: CREATE NEW WORKFLOW-BASED TABLES
-- ================================================

-- 1. PENDING NOTICES (Pre-blockchain stage)
-- This stores notices being prepared before sending
CREATE TABLE IF NOT EXISTS pending_notices (
    id SERIAL PRIMARY KEY,
    
    -- Basic info
    case_number VARCHAR(255) NOT NULL,
    server_address VARCHAR(255) NOT NULL,
    recipient_address VARCHAR(255),
    recipient_name VARCHAR(255),
    
    -- Notice details
    notice_type VARCHAR(100) NOT NULL,
    issuing_agency VARCHAR(255),
    jurisdiction VARCHAR(255),
    
    -- Document data (stored BEFORE blockchain)
    document_file_url TEXT,          -- Full document stored in backend
    document_thumbnail_url TEXT,     -- Thumbnail for Alert NFT
    document_preview_url TEXT,       -- Preview image
    document_metadata JSONB,         -- Title, description, pages, etc.
    
    -- NFT Descriptions
    alert_nft_description TEXT,      -- Description for Alert NFT
    document_nft_description TEXT,   -- Description for Document NFT
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sending', 'sent', 'failed')),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ready_at TIMESTAMP,              -- When marked ready to send
    sent_at TIMESTAMP                -- When actually sent to blockchain
);

-- 2. ACTIVE NOTICES (Main table for served notices)
-- Replaces both served_notices and notice_components
CREATE TABLE IF NOT EXISTS active_notices (
    id SERIAL PRIMARY KEY,
    
    -- Link to pending notice
    pending_notice_id INTEGER REFERENCES pending_notices(id),
    
    -- Case information
    case_number VARCHAR(255) NOT NULL,
    server_address VARCHAR(255) NOT NULL,
    recipient_address VARCHAR(255) NOT NULL,
    
    -- Alert NFT data
    alert_id INTEGER NOT NULL,
    alert_tx_hash VARCHAR(255),
    alert_thumbnail_url TEXT,
    alert_nft_description TEXT,
    alert_token_uri TEXT,
    alert_delivered_at TIMESTAMP NOT NULL,
    
    -- Document NFT data  
    document_id INTEGER,
    document_tx_hash VARCHAR(255),
    document_ipfs_hash VARCHAR(255),
    document_encryption_key TEXT,
    document_unencrypted_url TEXT,    -- Server's unencrypted copy
    document_created_at TIMESTAMP,
    
    -- Signature/Acknowledgment tracking
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    acknowledgment_tx_hash VARCHAR(255),
    
    -- Notice metadata
    notice_type VARCHAR(100),
    issuing_agency VARCHAR(255),
    jurisdiction VARCHAR(255),
    
    -- Blockchain info
    chain_type VARCHAR(50) NOT NULL DEFAULT 'tron_mainnet',
    contract_address VARCHAR(255),
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    UNIQUE(alert_id, chain_type),
    UNIQUE(document_id, chain_type) WHERE document_id IS NOT NULL
);

-- 3. NOTICE EVENTS (Track all interactions)
-- Replaces notice_views and notice_acceptances with unified event log
CREATE TABLE IF NOT EXISTS notice_events (
    id SERIAL PRIMARY KEY,
    notice_id INTEGER REFERENCES active_notices(id),
    
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'created',           -- Notice created in backend
        'sent_to_blockchain', -- Sent to blockchain
        'delivered',         -- Alert NFT delivered
        'viewed',           -- Notice viewed
        'document_accessed', -- Document NFT accessed
        'acknowledged',     -- Alert acknowledged
        'document_signed',  -- Document signed
        'rejected',         -- Notice rejected
        'expired'          -- Notice expired
    )),
    
    -- Who and where
    actor_address VARCHAR(255),
    actor_type VARCHAR(50), -- 'server', 'recipient', 'viewer'
    ip_address VARCHAR(45),
    user_agent TEXT,
    location_data JSONB,
    
    -- Event details
    details JSONB,
    transaction_hash VARCHAR(255),
    
    -- Timestamp
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. BACKEND CACHE (For quick lookups)
-- Optimized for the hybrid data service
CREATE TABLE IF NOT EXISTS notice_cache (
    id SERIAL PRIMARY KEY,
    server_address VARCHAR(255) NOT NULL,
    cache_key VARCHAR(255) NOT NULL,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(server_address, cache_key)
);

-- ================================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ================================================

-- Pending notices indexes
CREATE INDEX idx_pending_case_number ON pending_notices(case_number);
CREATE INDEX idx_pending_server ON pending_notices(server_address);
CREATE INDEX idx_pending_status ON pending_notices(status);

-- Active notices indexes
CREATE INDEX idx_active_case_number ON active_notices(case_number);
CREATE INDEX idx_active_server ON active_notices(server_address);
CREATE INDEX idx_active_recipient ON active_notices(recipient_address);
CREATE INDEX idx_active_alert_id ON active_notices(alert_id);
CREATE INDEX idx_active_document_id ON active_notices(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_active_acknowledged ON active_notices(is_acknowledged);
CREATE INDEX idx_active_created ON active_notices(created_at DESC);

-- Notice events indexes
CREATE INDEX idx_events_notice ON notice_events(notice_id);
CREATE INDEX idx_events_type ON notice_events(event_type);
CREATE INDEX idx_events_actor ON notice_events(actor_address);
CREATE INDEX idx_events_occurred ON notice_events(occurred_at DESC);

-- Cache indexes
CREATE INDEX idx_cache_expires ON notice_cache(expires_at);

-- ================================================
-- STEP 4: CREATE VIEWS FOR COMMON QUERIES
-- ================================================

-- View for server dashboard
CREATE OR REPLACE VIEW server_dashboard AS
SELECT 
    an.server_address,
    COUNT(DISTINCT an.id) as total_notices,
    COUNT(DISTINCT CASE WHEN an.is_acknowledged THEN an.id END) as acknowledged_count,
    COUNT(DISTINCT CASE WHEN NOT an.is_acknowledged THEN an.id END) as pending_count,
    COUNT(DISTINCT an.case_number) as total_cases,
    MAX(an.created_at) as last_activity
FROM active_notices an
GROUP BY an.server_address;

-- View for case grouping
CREATE OR REPLACE VIEW cases_summary AS
SELECT 
    an.case_number,
    an.server_address,
    COUNT(*) as notice_count,
    MIN(an.created_at) as first_served,
    MAX(an.created_at) as last_served,
    BOOL_OR(an.is_acknowledged) as has_acknowledgment,
    ARRAY_AGG(
        JSON_BUILD_OBJECT(
            'alert_id', an.alert_id,
            'document_id', an.document_id,
            'recipient', an.recipient_address,
            'acknowledged', an.is_acknowledged,
            'delivered_at', an.alert_delivered_at
        ) ORDER BY an.created_at
    ) as notices
FROM active_notices an
GROUP BY an.case_number, an.server_address;

-- ================================================
-- STEP 5: MIGRATE EXISTING DATA (if any)
-- ================================================

-- Migrate any existing data from notice_components to active_notices
INSERT INTO active_notices (
    case_number,
    server_address,
    recipient_address,
    alert_id,
    alert_thumbnail_url,
    alert_nft_description,
    alert_delivered_at,
    document_id,
    document_ipfs_hash,
    document_unencrypted_url,
    is_acknowledged,
    acknowledged_at,
    notice_type,
    issuing_agency,
    chain_type,
    created_at,
    updated_at
)
SELECT 
    case_number,
    server_address,
    recipient_address,
    alert_id,
    alert_thumbnail_url,
    alert_nft_description,
    served_at,
    document_id,
    document_ipfs_hash,
    document_unencrypted_url,
    document_accepted OR alert_acknowledged,
    COALESCE(document_accepted_at, alert_acknowledged_at),
    notice_type,
    issuing_agency,
    chain_type,
    created_at,
    updated_at
FROM notice_components
WHERE NOT EXISTS (
    SELECT 1 FROM active_notices 
    WHERE active_notices.alert_id = notice_components.alert_id
);

-- ================================================
-- STEP 6: DROP THE OLD notice_components TABLE
-- ================================================

DROP TABLE IF EXISTS notice_components CASCADE;

-- ================================================
-- STEP 7: KEEP THESE TABLES (Still needed)
-- ================================================
-- process_servers - Keep for server registration
-- wallet_connections - Keep for analytics
-- blockchain_cache - Keep for caching
-- server_ratings - Keep for ratings system

-- ================================================
-- FUNCTION: Update timestamps automatically
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_pending_notices_updated_at
    BEFORE UPDATE ON pending_notices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_active_notices_updated_at
    BEFORE UPDATE ON active_notices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();