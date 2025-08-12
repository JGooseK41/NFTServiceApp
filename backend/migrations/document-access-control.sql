-- Document Access Control System
-- Ensures only recipients can view documents

-- Access tokens table
CREATE TABLE IF NOT EXISTS document_access_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(100) UNIQUE NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    alert_token_id INTEGER,
    document_token_id INTEGER,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    revoked BOOLEAN DEFAULT false,
    
    -- Unique constraint per wallet and alert
    UNIQUE(wallet_address, alert_token_id)
);

CREATE INDEX IF NOT EXISTS idx_access_token ON document_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_access_wallet ON document_access_tokens(wallet_address);
CREATE INDEX IF NOT EXISTS idx_access_expires ON document_access_tokens(expires_at);

-- Access attempts log
CREATE TABLE IF NOT EXISTS access_attempts (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42),
    alert_token_id INTEGER,
    document_token_id INTEGER,
    is_recipient BOOLEAN,
    granted BOOLEAN,
    denial_reason VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attempts_wallet ON access_attempts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_attempts_token ON access_attempts(alert_token_id, document_token_id);
CREATE INDEX IF NOT EXISTS idx_attempts_time ON access_attempts(attempted_at);

-- Document access log
CREATE TABLE IF NOT EXISTS document_access_log (
    id SERIAL PRIMARY KEY,
    document_token_id INTEGER NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    access_token_used VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    bytes_served BIGINT,
    access_duration INTEGER, -- seconds
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_access_token ON document_access_log(document_token_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_wallet ON document_access_log(wallet_address);
CREATE INDEX IF NOT EXISTS idx_doc_access_time ON document_access_log(accessed_at);

-- View to see access patterns
CREATE OR REPLACE VIEW document_access_summary AS
SELECT 
    dt.document_token_id,
    dt.alert_token_id,
    tt.case_number,
    tt.recipient_address,
    COUNT(DISTINCT aa.wallet_address) as unique_access_attempts,
    COUNT(CASE WHEN aa.is_recipient = true THEN 1 END) as recipient_attempts,
    COUNT(CASE WHEN aa.is_recipient = false THEN 1 END) as non_recipient_attempts,
    COUNT(DISTINCT dal.id) as document_views,
    MAX(dal.accessed_at) as last_accessed,
    COUNT(DISTINCT CASE WHEN aa.granted = true THEN aa.wallet_address END) as granted_access_count
FROM token_tracking tt
LEFT JOIN document_access_tokens dt ON dt.document_token_id = tt.token_id
LEFT JOIN access_attempts aa ON aa.document_token_id = tt.token_id
LEFT JOIN document_access_log dal ON dal.document_token_id = tt.token_id
WHERE tt.token_type = 'document'
GROUP BY dt.document_token_id, dt.alert_token_id, tt.case_number, tt.recipient_address;

-- Function to check if wallet can access document
CREATE OR REPLACE FUNCTION can_access_document(
    p_wallet_address VARCHAR,
    p_document_token_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_recipient BOOLEAN;
BEGIN
    -- Check if wallet is the recipient
    SELECT 
        LOWER(recipient_address) = LOWER(p_wallet_address)
    INTO v_is_recipient
    FROM token_tracking
    WHERE token_id = p_document_token_id
    AND token_type = 'document';
    
    RETURN COALESCE(v_is_recipient, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get access level for a wallet
CREATE OR REPLACE FUNCTION get_access_level(
    p_wallet_address VARCHAR,
    p_alert_token_id INTEGER,
    p_document_token_id INTEGER
) RETURNS TABLE (
    access_level VARCHAR,
    can_view_alert BOOLEAN,
    can_view_document BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_recipient_address VARCHAR;
    v_is_recipient BOOLEAN;
    v_is_server BOOLEAN;
BEGIN
    -- Get recipient and server addresses
    SELECT 
        recipient_address,
        LOWER(recipient_address) = LOWER(p_wallet_address),
        LOWER(server_address) = LOWER(p_wallet_address)
    INTO v_recipient_address, v_is_recipient, v_is_server
    FROM token_tracking
    WHERE token_id = p_alert_token_id OR token_id = p_document_token_id
    LIMIT 1;
    
    -- Determine access level
    IF v_is_recipient THEN
        RETURN QUERY SELECT 
            'recipient'::VARCHAR as access_level,
            true as can_view_alert,
            true as can_view_document,
            'Full access - you are the recipient'::TEXT as reason;
    ELSIF v_is_server THEN
        RETURN QUERY SELECT 
            'server'::VARCHAR as access_level,
            true as can_view_alert,
            false as can_view_document,
            'Server access - can view alert only'::TEXT as reason;
    ELSE
        RETURN QUERY SELECT 
            'public'::VARCHAR as access_level,
            true as can_view_alert,
            false as can_view_document,
            'Public access - alert information only'::TEXT as reason;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM document_access_tokens
    WHERE expires_at < NOW() - INTERVAL '24 hours'
    OR revoked = true;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run this periodically)
-- In production, use pg_cron or external scheduler
-- SELECT cleanup_expired_tokens();