-- Comprehensive Token Tracking System
-- Links Token IDs with Case Numbers, Transaction Hashes, and all metadata

-- First, ensure served_notices table has all needed columns
ALTER TABLE served_notices
ADD COLUMN IF NOT EXISTS alert_token_id INTEGER,
ADD COLUMN IF NOT EXISTS document_token_id INTEGER,
ADD COLUMN IF NOT EXISTS alert_tx_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS document_tx_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS creation_tx_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS blockchain_timestamp TIMESTAMP,
ADD COLUMN IF NOT EXISTS block_number BIGINT,
ADD COLUMN IF NOT EXISTS token_pair_id VARCHAR(50);

-- Update notice_components with comprehensive tracking
ALTER TABLE notice_components 
ADD COLUMN IF NOT EXISTS alert_token_id INTEGER,
ADD COLUMN IF NOT EXISTS document_token_id INTEGER,
ADD COLUMN IF NOT EXISTS alert_tx_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS document_tx_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS creation_tx_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS blockchain_timestamp TIMESTAMP,
ADD COLUMN IF NOT EXISTS block_number BIGINT,
ADD COLUMN IF NOT EXISTS unified_reference VARCHAR(100),
ADD COLUMN IF NOT EXISTS notice_pair_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS token_metadata JSONB;

-- Create comprehensive token tracking table
CREATE TABLE IF NOT EXISTS token_tracking (
    id SERIAL PRIMARY KEY,
    -- Token Information
    token_id INTEGER NOT NULL,
    token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('alert', 'document')),
    paired_token_id INTEGER,
    
    -- Case Information
    case_number VARCHAR(100) NOT NULL,
    notice_type VARCHAR(100),
    issuing_agency VARCHAR(255),
    
    -- Blockchain Information
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT,
    blockchain_timestamp TIMESTAMP,
    contract_address VARCHAR(42),
    
    -- Parties
    server_address VARCHAR(42) NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    recipient_name VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    is_delivered BOOLEAN DEFAULT false,
    is_signed BOOLEAN DEFAULT false,
    signed_at TIMESTAMP,
    signature_tx_hash VARCHAR(66),
    
    -- Metadata
    ipfs_hash VARCHAR(100),
    document_hash VARCHAR(100),
    page_count INTEGER DEFAULT 1,
    public_text TEXT,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint on token_id and type
    UNIQUE(token_id, token_type)
);

-- Create indexes for all common queries
CREATE INDEX IF NOT EXISTS idx_token_tracking_token_id ON token_tracking(token_id);
CREATE INDEX IF NOT EXISTS idx_token_tracking_case ON token_tracking(case_number);
CREATE INDEX IF NOT EXISTS idx_token_tracking_tx_hash ON token_tracking(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_token_tracking_server ON token_tracking(server_address);
CREATE INDEX IF NOT EXISTS idx_token_tracking_recipient ON token_tracking(recipient_address);
CREATE INDEX IF NOT EXISTS idx_token_tracking_paired ON token_tracking(token_id, paired_token_id);
CREATE INDEX IF NOT EXISTS idx_token_tracking_blockchain ON token_tracking(block_number, blockchain_timestamp);

-- Create a comprehensive view that joins everything
CREATE OR REPLACE VIEW comprehensive_notice_view AS
SELECT 
    -- Token IDs
    t1.token_id as alert_token_id,
    t2.token_id as document_token_id,
    
    -- Case Information
    t1.case_number,
    t1.notice_type,
    t1.issuing_agency,
    
    -- Blockchain Data
    t1.transaction_hash as alert_tx_hash,
    t2.transaction_hash as document_tx_hash,
    t1.block_number,
    t1.blockchain_timestamp,
    t1.contract_address,
    
    -- Parties
    t1.server_address,
    t1.recipient_address,
    t1.recipient_name,
    
    -- Status
    t1.is_delivered as alert_delivered,
    t2.is_signed as document_signed,
    t2.signed_at,
    t2.signature_tx_hash,
    
    -- Document Data
    t2.ipfs_hash,
    t2.document_hash,
    t2.page_count,
    t1.public_text,
    
    -- Images from notice_components
    nc.alert_thumbnail_data,
    nc.alert_thumbnail_mime_type,
    nc.document_data,
    nc.document_mime_type,
    
    -- Unified Reference
    CONCAT(t1.case_number, '-', t1.token_id, '-', t2.token_id) as unified_reference,
    
    -- Timestamps
    t1.created_at,
    GREATEST(t1.updated_at, t2.updated_at) as last_updated
FROM token_tracking t1
LEFT JOIN token_tracking t2 ON t1.paired_token_id = t2.token_id AND t2.token_type = 'document'
LEFT JOIN notice_components nc ON nc.alert_token_id = t1.token_id
WHERE t1.token_type = 'alert'
ORDER BY t1.created_at DESC;

-- Function to find notices by any identifier
CREATE OR REPLACE FUNCTION find_notice_by_any_id(
    search_id VARCHAR
) RETURNS TABLE (
    alert_token_id INTEGER,
    document_token_id INTEGER,
    case_number VARCHAR,
    transaction_hash VARCHAR,
    unified_reference VARCHAR,
    server_address VARCHAR,
    recipient_address VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        COALESCE(t1.token_id, t2.paired_token_id) as alert_token_id,
        COALESCE(t2.token_id, t1.paired_token_id) as document_token_id,
        COALESCE(t1.case_number, t2.case_number) as case_number,
        COALESCE(t1.transaction_hash, t2.transaction_hash) as transaction_hash,
        CONCAT(
            COALESCE(t1.case_number, t2.case_number), '-',
            COALESCE(t1.token_id, t2.paired_token_id), '-',
            COALESCE(t2.token_id, t1.paired_token_id)
        ) as unified_reference,
        COALESCE(t1.server_address, t2.server_address) as server_address,
        COALESCE(t1.recipient_address, t2.recipient_address) as recipient_address
    FROM token_tracking t1
    FULL OUTER JOIN token_tracking t2 ON t1.paired_token_id = t2.token_id
    WHERE 
        -- Search by token ID
        t1.token_id::TEXT = search_id OR
        t2.token_id::TEXT = search_id OR
        -- Search by transaction hash
        t1.transaction_hash = search_id OR
        t2.transaction_hash = search_id OR
        -- Search by case number
        t1.case_number = search_id OR
        t2.case_number = search_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get complete notice history
CREATE OR REPLACE FUNCTION get_notice_history(
    p_token_id INTEGER
) RETURNS TABLE (
    event_type VARCHAR,
    event_timestamp TIMESTAMP,
    transaction_hash VARCHAR,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    -- Creation event
    SELECT 
        'created'::VARCHAR as event_type,
        created_at as event_timestamp,
        transaction_hash,
        jsonb_build_object(
            'token_id', token_id,
            'token_type', token_type,
            'case_number', case_number,
            'server', server_address,
            'recipient', recipient_address
        ) as details
    FROM token_tracking
    WHERE token_id = p_token_id
    
    UNION ALL
    
    -- View events
    SELECT 
        'viewed'::VARCHAR as event_type,
        viewed_at as event_timestamp,
        NULL::VARCHAR as transaction_hash,
        jsonb_build_object(
            'viewer', viewer_address,
            'ip_address', ip_address
        ) as details
    FROM notice_views
    WHERE notice_id::INTEGER = p_token_id
    
    UNION ALL
    
    -- Signature events
    SELECT 
        'signed'::VARCHAR as event_type,
        signed_at as event_timestamp,
        signature_tx_hash as transaction_hash,
        jsonb_build_object(
            'signer', recipient_address,
            'document_token_id', token_id
        ) as details
    FROM token_tracking
    WHERE token_id = p_token_id AND is_signed = true
    
    ORDER BY event_timestamp;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to maintain updated_at
CREATE OR REPLACE FUNCTION update_token_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_token_tracking_timestamp
BEFORE UPDATE ON token_tracking
FOR EACH ROW
EXECUTE FUNCTION update_token_tracking_timestamp();

-- Sample queries for common operations:
COMMENT ON VIEW comprehensive_notice_view IS '
Sample queries:
- Find by token ID: SELECT * FROM comprehensive_notice_view WHERE alert_token_id = 12;
- Find by case: SELECT * FROM comprehensive_notice_view WHERE case_number = ''34-2501-8285700'';
- Find by tx hash: SELECT * FROM find_notice_by_any_id(''0xabc123...'');
- Get history: SELECT * FROM get_notice_history(12);
';