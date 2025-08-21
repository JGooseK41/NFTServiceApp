-- Fix document_access_summary view
-- This version works whether token_tracking exists or not

DROP VIEW IF EXISTS document_access_summary;

-- Check if token_tracking table exists and create appropriate view
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'token_tracking') THEN
        
        -- Create full view with token_tracking
        EXECUTE 'CREATE OR REPLACE VIEW document_access_summary AS
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
        WHERE tt.token_type = ''document''
        GROUP BY dt.document_token_id, dt.alert_token_id, tt.case_number, tt.recipient_address';
        
        RAISE NOTICE 'Created document_access_summary view with token_tracking integration';
    ELSE
        -- Create basic view without token_tracking
        EXECUTE 'CREATE OR REPLACE VIEW document_access_summary AS
        SELECT 
            dt.document_token_id,
            dt.alert_token_id,
            dt.wallet_address as recipient_address,
            COUNT(DISTINCT aa.wallet_address) as unique_access_attempts,
            COUNT(CASE WHEN aa.is_recipient = true THEN 1 END) as recipient_attempts,
            COUNT(CASE WHEN aa.is_recipient = false THEN 1 END) as non_recipient_attempts,
            COUNT(DISTINCT dal.id) as document_views,
            MAX(dal.accessed_at) as last_accessed,
            COUNT(DISTINCT CASE WHEN aa.granted = true THEN aa.wallet_address END) as granted_access_count
        FROM document_access_tokens dt
        LEFT JOIN access_attempts aa ON aa.document_token_id = dt.document_token_id
        LEFT JOIN document_access_log dal ON dal.document_token_id = dt.document_token_id
        GROUP BY dt.document_token_id, dt.alert_token_id, dt.wallet_address';
        
        RAISE NOTICE 'Created document_access_summary view (basic version without token_tracking)';
    END IF;
END $$;

-- Also fix the can_access_document function to handle missing token_tracking table
CREATE OR REPLACE FUNCTION can_access_document(
    p_wallet_address VARCHAR,
    p_document_token_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_recipient BOOLEAN;
BEGIN
    -- Check if token_tracking table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'token_tracking') THEN
        -- Check if wallet is the recipient using token_tracking
        SELECT 
            LOWER(recipient_address) = LOWER(p_wallet_address)
        INTO v_is_recipient
        FROM token_tracking
        WHERE token_id = p_document_token_id
        AND token_type = 'document';
    ELSE
        -- Fallback: check if wallet has an active access token
        SELECT EXISTS(
            SELECT 1 FROM document_access_tokens
            WHERE document_token_id = p_document_token_id
            AND LOWER(wallet_address) = LOWER(p_wallet_address)
            AND expires_at > NOW()
            AND revoked = false
        ) INTO v_is_recipient;
    END IF;
    
    RETURN COALESCE(v_is_recipient, false);
END;
$$ LANGUAGE plpgsql;

-- Fix get_access_level function similarly
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
    v_is_recipient BOOLEAN;
BEGIN
    -- Check if token_tracking table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'token_tracking') THEN
        -- Use token_tracking to determine access
        SELECT 
            LOWER(recipient_address) = LOWER(p_wallet_address)
        INTO v_is_recipient
        FROM token_tracking
        WHERE (token_id = p_alert_token_id OR token_id = p_document_token_id)
        AND token_type IN ('alert', 'document')
        LIMIT 1;
    ELSE
        -- Fallback: check access tokens
        SELECT EXISTS(
            SELECT 1 FROM document_access_tokens
            WHERE (alert_token_id = p_alert_token_id OR document_token_id = p_document_token_id)
            AND LOWER(wallet_address) = LOWER(p_wallet_address)
            AND expires_at > NOW()
            AND revoked = false
        ) INTO v_is_recipient;
    END IF;
    
    -- Return access level
    IF v_is_recipient THEN
        RETURN QUERY SELECT 
            'recipient'::VARCHAR as access_level,
            true as can_view_alert,
            true as can_view_document,
            'Full access - you are the recipient'::TEXT as reason;
    ELSE
        RETURN QUERY SELECT 
            'public'::VARCHAR as access_level,
            true as can_view_alert,
            false as can_view_document,
            'Public access - alert information only'::TEXT as reason;
    END IF;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Access control functions updated to work without token_tracking table';