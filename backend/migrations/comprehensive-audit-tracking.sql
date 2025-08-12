-- Comprehensive Audit Tracking System
-- Links all recipient interactions with token IDs

-- First, enhance the notice_views table to properly track token access
ALTER TABLE notice_views
ADD COLUMN IF NOT EXISTS alert_token_id INTEGER,
ADD COLUMN IF NOT EXISTS document_token_id INTEGER,
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS wallet_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS connection_timestamp TIMESTAMP,
ADD COLUMN IF NOT EXISTS view_type VARCHAR(50), -- 'direct_link', 'qr_scan', 'email_click', 'search'
ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS referrer_url TEXT,
ADD COLUMN IF NOT EXISTS view_duration INTEGER, -- seconds spent viewing
ADD COLUMN IF NOT EXISTS actions_taken JSONB; -- track what they did

-- Create comprehensive audit event table
CREATE TABLE IF NOT EXISTS token_audit_events (
    id SERIAL PRIMARY KEY,
    
    -- Token Information
    alert_token_id INTEGER,
    document_token_id INTEGER,
    case_number VARCHAR(100),
    
    -- Event Information
    event_type VARCHAR(50) NOT NULL, -- 'view', 'wallet_connect', 'sign_attempt', 'sign_success', 'download', 'print'
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_details JSONB,
    
    -- Actor Information
    actor_address VARCHAR(42), -- wallet address if connected
    actor_ip VARCHAR(45),
    actor_user_agent TEXT,
    actor_location JSONB, -- geographic location if available
    
    -- Session Information
    session_id VARCHAR(100),
    is_authenticated BOOLEAN DEFAULT false,
    authentication_method VARCHAR(50), -- 'wallet', 'email', 'sms'
    
    -- Transaction Information (for blockchain events)
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    gas_used INTEGER,
    transaction_status VARCHAR(20), -- 'pending', 'success', 'failed'
    
    -- Additional Context
    device_type VARCHAR(50), -- 'mobile', 'desktop', 'tablet'
    browser_name VARCHAR(50),
    operating_system VARCHAR(50),
    
    -- Index for faster queries
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_token_ids ON token_audit_events(alert_token_id, document_token_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON token_audit_events(actor_address);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON token_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON token_audit_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_session ON token_audit_events(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_case ON token_audit_events(case_number);

-- Create wallet connection tracking table
CREATE TABLE IF NOT EXISTS wallet_connections (
    id SERIAL PRIMARY KEY,
    
    -- Connection Information
    wallet_address VARCHAR(42) NOT NULL,
    connection_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnection_timestamp TIMESTAMP,
    connection_duration INTEGER, -- seconds
    
    -- Token Context
    alert_token_id INTEGER,
    document_token_id INTEGER,
    case_number VARCHAR(100),
    
    -- Connection Details
    network VARCHAR(50), -- 'tron_mainnet', 'tron_testnet'
    wallet_type VARCHAR(50), -- 'tronlink', 'metamask', 'walletconnect'
    connection_method VARCHAR(50), -- 'browser_extension', 'mobile_app', 'qr_code'
    
    -- Session Information
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Actions Performed
    viewed_notice BOOLEAN DEFAULT false,
    attempted_signature BOOLEAN DEFAULT false,
    completed_signature BOOLEAN DEFAULT false,
    signature_tx_hash VARCHAR(66),
    
    -- Status
    is_recipient BOOLEAN DEFAULT false, -- verified if wallet matches recipient_address
    is_authorized BOOLEAN DEFAULT false, -- has permission to sign
    
    UNIQUE(wallet_address, session_id, alert_token_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_address ON wallet_connections(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_token ON wallet_connections(alert_token_id, document_token_id);
CREATE INDEX IF NOT EXISTS idx_wallet_session ON wallet_connections(session_id);

-- Create signature attempts tracking
CREATE TABLE IF NOT EXISTS signature_attempts (
    id SERIAL PRIMARY KEY,
    
    -- Token Information
    document_token_id INTEGER NOT NULL,
    alert_token_id INTEGER,
    case_number VARCHAR(100),
    
    -- Attempt Information
    attempt_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    wallet_address VARCHAR(42) NOT NULL,
    
    -- Result
    attempt_status VARCHAR(50), -- 'initiated', 'wallet_confirmed', 'blockchain_pending', 'success', 'failed', 'rejected'
    failure_reason TEXT,
    transaction_hash VARCHAR(66),
    
    -- Context
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    estimated_gas INTEGER,
    gas_price BIGINT,
    
    -- Verification
    is_correct_recipient BOOLEAN,
    recipient_address VARCHAR(42),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signature_token ON signature_attempts(document_token_id);
CREATE INDEX IF NOT EXISTS idx_signature_wallet ON signature_attempts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_signature_status ON signature_attempts(attempt_status);

-- Enhanced view to see complete recipient journey
CREATE OR REPLACE VIEW recipient_journey AS
SELECT 
    -- Token Information
    t.alert_token_id,
    t.document_token_id,
    t.case_number,
    t.recipient_address,
    
    -- First View
    MIN(v.viewed_at) as first_viewed_at,
    COUNT(DISTINCT v.id) as total_views,
    COUNT(DISTINCT v.ip_address) as unique_ips,
    
    -- Wallet Connections
    COUNT(DISTINCT w.wallet_address) as wallets_connected,
    MAX(CASE WHEN w.wallet_address = t.recipient_address THEN w.connection_timestamp END) as recipient_connected_at,
    
    -- Signature Attempts
    COUNT(DISTINCT s.id) as signature_attempts,
    MAX(CASE WHEN s.attempt_status = 'success' THEN s.attempt_timestamp END) as signed_at,
    MAX(CASE WHEN s.attempt_status = 'success' THEN s.transaction_hash END) as signature_tx_hash,
    
    -- Journey Status
    CASE 
        WHEN MAX(CASE WHEN s.attempt_status = 'success' THEN 1 ELSE 0 END) = 1 THEN 'completed'
        WHEN COUNT(DISTINCT w.wallet_address) > 0 THEN 'wallet_connected'
        WHEN COUNT(DISTINCT v.id) > 0 THEN 'viewed'
        ELSE 'not_viewed'
    END as journey_status,
    
    -- Time Metrics
    EXTRACT(EPOCH FROM (
        MAX(CASE WHEN s.attempt_status = 'success' THEN s.attempt_timestamp END) - 
        MIN(v.viewed_at)
    )) as seconds_to_signature,
    
    -- Engagement Score (0-100)
    LEAST(100, 
        (COUNT(DISTINCT v.id) * 10) + -- views worth 10 points each
        (CASE WHEN COUNT(DISTINCT w.wallet_address) > 0 THEN 30 ELSE 0 END) + -- wallet connection worth 30
        (CASE WHEN MAX(CASE WHEN s.attempt_status = 'success' THEN 1 ELSE 0 END) = 1 THEN 50 ELSE 0 END) -- signature worth 50
    ) as engagement_score

FROM token_tracking t
LEFT JOIN notice_views v ON v.alert_token_id = t.token_id OR v.document_token_id = t.token_id
LEFT JOIN wallet_connections w ON w.alert_token_id = t.token_id OR w.document_token_id = t.token_id
LEFT JOIN signature_attempts s ON s.document_token_id = t.paired_token_id OR s.document_token_id = t.token_id
WHERE t.token_type = 'alert'
GROUP BY t.alert_token_id, t.document_token_id, t.case_number, t.recipient_address;

-- Function to record complete audit event
CREATE OR REPLACE FUNCTION record_audit_event(
    p_event_type VARCHAR,
    p_alert_token_id INTEGER,
    p_document_token_id INTEGER,
    p_actor_address VARCHAR,
    p_event_details JSONB,
    p_session_id VARCHAR,
    p_ip_address VARCHAR,
    p_user_agent TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_event_id INTEGER;
    v_case_number VARCHAR;
BEGIN
    -- Get case number from token tracking
    SELECT case_number INTO v_case_number
    FROM token_tracking
    WHERE token_id = p_alert_token_id OR token_id = p_document_token_id
    LIMIT 1;
    
    -- Insert audit event
    INSERT INTO token_audit_events (
        event_type,
        alert_token_id,
        document_token_id,
        case_number,
        actor_address,
        event_details,
        session_id,
        actor_ip,
        actor_user_agent
    ) VALUES (
        p_event_type,
        p_alert_token_id,
        p_document_token_id,
        v_case_number,
        p_actor_address,
        p_event_details,
        p_session_id,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_event_id;
    
    -- Update notice_views if this is a view event
    IF p_event_type = 'view' THEN
        UPDATE notice_views
        SET alert_token_id = p_alert_token_id,
            document_token_id = p_document_token_id,
            wallet_address = p_actor_address
        WHERE session_id = p_session_id
        AND (notice_id::INTEGER = p_alert_token_id OR notice_id::INTEGER = p_document_token_id);
    END IF;
    
    -- Update wallet_connections if this is a wallet event
    IF p_event_type = 'wallet_connect' AND p_actor_address IS NOT NULL THEN
        INSERT INTO wallet_connections (
            wallet_address,
            alert_token_id,
            document_token_id,
            case_number,
            session_id,
            ip_address,
            user_agent
        ) VALUES (
            p_actor_address,
            p_alert_token_id,
            p_document_token_id,
            v_case_number,
            p_session_id,
            p_ip_address,
            p_user_agent
        ) ON CONFLICT (wallet_address, session_id, alert_token_id) 
        DO UPDATE SET connection_timestamp = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get complete audit trail for a token pair
CREATE OR REPLACE FUNCTION get_complete_audit_trail(
    p_alert_token_id INTEGER,
    p_document_token_id INTEGER
) RETURNS TABLE (
    event_timestamp TIMESTAMP,
    event_type VARCHAR,
    actor_address VARCHAR,
    event_description TEXT,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.event_timestamp,
        e.event_type,
        e.actor_address,
        CASE e.event_type
            WHEN 'view' THEN 'Notice viewed'
            WHEN 'wallet_connect' THEN 'Wallet connected'
            WHEN 'sign_attempt' THEN 'Signature attempted'
            WHEN 'sign_success' THEN 'Document signed'
            WHEN 'download' THEN 'Document downloaded'
            ELSE e.event_type
        END as event_description,
        e.event_details as details
    FROM token_audit_events e
    WHERE e.alert_token_id = p_alert_token_id 
       OR e.document_token_id = p_document_token_id
    ORDER BY e.event_timestamp;
END;
$$ LANGUAGE plpgsql;

-- Sample queries for common operations
COMMENT ON VIEW recipient_journey IS '
Sample queries:
- Get recipient journey: SELECT * FROM recipient_journey WHERE alert_token_id = 12;
- Track engagement: SELECT * FROM recipient_journey WHERE engagement_score > 50;
- Find completed signatures: SELECT * FROM recipient_journey WHERE journey_status = ''completed'';
- Average time to sign: SELECT AVG(seconds_to_signature) FROM recipient_journey WHERE seconds_to_signature IS NOT NULL;
';