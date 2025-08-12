-- Migration: Add Token ID tracking to notice_components table
-- Date: 2025-01-12
-- Purpose: Better cataloging system with NFT Token IDs

-- Add token ID columns to notice_components
ALTER TABLE notice_components 
ADD COLUMN IF NOT EXISTS alert_token_id INTEGER,
ADD COLUMN IF NOT EXISTS document_token_id INTEGER,
ADD COLUMN IF NOT EXISTS unified_reference VARCHAR(100),
ADD COLUMN IF NOT EXISTS notice_pair_id VARCHAR(50);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_ids ON notice_components(alert_token_id, document_token_id);
CREATE INDEX IF NOT EXISTS idx_unified_reference ON notice_components(unified_reference);
CREATE INDEX IF NOT EXISTS idx_alert_token ON notice_components(alert_token_id);
CREATE INDEX IF NOT EXISTS idx_document_token ON notice_components(document_token_id);

-- Update existing records to populate token IDs from notice_id
-- This assumes notice_id contains the alert token ID
UPDATE notice_components 
SET alert_token_id = CASE 
    WHEN notice_id ~ '^[0-9]+$' THEN notice_id::INTEGER 
    ELSE NULL 
END
WHERE alert_token_id IS NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN notice_components.alert_token_id IS 'NFT Token ID for the Alert notice';
COMMENT ON COLUMN notice_components.document_token_id IS 'NFT Token ID for the paired Document';
COMMENT ON COLUMN notice_components.unified_reference IS 'Unified reference format: CASE#-ALERTID-DOCID';
COMMENT ON COLUMN notice_components.notice_pair_id IS 'Unique identifier for the alert-document pair';

-- Create a view for easy token lookup
CREATE OR REPLACE VIEW token_registry AS
SELECT 
    nc.notice_id,
    nc.alert_token_id,
    nc.document_token_id,
    nc.unified_reference,
    nc.case_number,
    nc.server_address,
    nc.recipient_address,
    nc.created_at,
    nc.storage_source,
    CASE 
        WHEN nc.alert_thumbnail_data IS NOT NULL THEN true 
        ELSE false 
    END as has_alert_image,
    CASE 
        WHEN nc.document_data IS NOT NULL THEN true 
        ELSE false 
    END as has_document_image
FROM notice_components nc
WHERE nc.alert_token_id IS NOT NULL OR nc.document_token_id IS NOT NULL
ORDER BY nc.created_at DESC;

-- Add function to generate unified reference
CREATE OR REPLACE FUNCTION generate_unified_reference(
    p_case_number VARCHAR,
    p_alert_id INTEGER,
    p_document_id INTEGER
) RETURNS VARCHAR AS $$
BEGIN
    RETURN CONCAT(p_case_number, '-', p_alert_id, '-', p_document_id);
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-generate unified reference
CREATE OR REPLACE FUNCTION update_unified_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.case_number IS NOT NULL AND NEW.alert_token_id IS NOT NULL THEN
        NEW.unified_reference = generate_unified_reference(
            NEW.case_number,
            NEW.alert_token_id,
            NEW.document_token_id
        );
        NEW.notice_pair_id = CONCAT(NEW.alert_token_id, '-', NEW.document_token_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_unified_reference
BEFORE INSERT OR UPDATE ON notice_components
FOR EACH ROW
EXECUTE FUNCTION update_unified_reference();

-- Sample query to test the new structure
-- SELECT * FROM token_registry WHERE alert_token_id = 12;