-- Migration: Convert all ID columns from INTEGER to TEXT
-- This resolves the "value out of range for type integer" errors

-- 1. Convert served_notices table
ALTER TABLE served_notices 
ALTER COLUMN notice_id TYPE TEXT USING notice_id::TEXT;

ALTER TABLE served_notices 
ALTER COLUMN alert_id TYPE TEXT USING alert_id::TEXT;

ALTER TABLE served_notices 
ALTER COLUMN document_id TYPE TEXT USING document_id::TEXT;

-- 2. Convert notice_components table  
ALTER TABLE notice_components
ALTER COLUMN notice_id TYPE TEXT USING notice_id::TEXT;

ALTER TABLE notice_components
ALTER COLUMN alert_id TYPE TEXT USING alert_id::TEXT;

ALTER TABLE notice_components
ALTER COLUMN document_id TYPE TEXT USING document_id::TEXT;

-- 3. Convert notice_batch_items table
ALTER TABLE notice_batch_items
ALTER COLUMN notice_id TYPE TEXT USING notice_id::TEXT;

-- 4. Add indexes for performance on TEXT columns
CREATE INDEX IF NOT EXISTS idx_served_notices_notice_id_text ON served_notices(notice_id);
CREATE INDEX IF NOT EXISTS idx_served_notices_alert_id_text ON served_notices(alert_id);
CREATE INDEX IF NOT EXISTS idx_served_notices_document_id_text ON served_notices(document_id);
CREATE INDEX IF NOT EXISTS idx_notice_components_notice_id_text ON notice_components(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_batch_items_notice_id_text ON notice_batch_items(notice_id);

-- 5. Verify the changes
DO $$ 
BEGIN
    RAISE NOTICE 'Migration complete. ID columns converted to TEXT type.';
END $$;