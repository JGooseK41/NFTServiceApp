-- Fix ALL notice_id columns across ALL tables
-- Run this in Render shell to fix the batch upload issue

-- 1. Check and fix notice_batch_items table
DO $$ 
BEGIN
    -- Check if notice_batch_items exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notice_batch_items') THEN
        -- Check if notice_id is INTEGER
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'notice_batch_items' 
            AND column_name = 'notice_id' 
            AND data_type = 'integer'
        ) THEN
            RAISE NOTICE 'Converting notice_batch_items.notice_id from INTEGER to VARCHAR...';
            ALTER TABLE notice_batch_items 
            ALTER COLUMN notice_id TYPE VARCHAR(255) USING notice_id::VARCHAR;
            RAISE NOTICE '✓ notice_batch_items.notice_id converted';
        ELSE
            RAISE NOTICE '✓ notice_batch_items.notice_id is already VARCHAR';
        END IF;
    ELSE
        RAISE NOTICE '! Table notice_batch_items does not exist';
    END IF;
END $$;

-- 2. Check and fix notice_components table
DO $$ 
BEGIN
    -- Check if notice_components exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notice_components') THEN
        -- Check notice_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'notice_components' 
            AND column_name = 'notice_id' 
            AND data_type = 'integer'
        ) THEN
            RAISE NOTICE 'Converting notice_components.notice_id from INTEGER to VARCHAR...';
            ALTER TABLE notice_components 
            ALTER COLUMN notice_id TYPE VARCHAR(255) USING notice_id::VARCHAR;
            RAISE NOTICE '✓ notice_components.notice_id converted';
        ELSE
            RAISE NOTICE '✓ notice_components.notice_id is already VARCHAR';
        END IF;
        
        -- Check alert_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'notice_components' 
            AND column_name = 'alert_id' 
            AND data_type = 'integer'
        ) THEN
            RAISE NOTICE 'Converting notice_components.alert_id from INTEGER to VARCHAR...';
            ALTER TABLE notice_components 
            ALTER COLUMN alert_id TYPE VARCHAR(255) USING alert_id::VARCHAR;
            RAISE NOTICE '✓ notice_components.alert_id converted';
        ELSE
            RAISE NOTICE '✓ notice_components.alert_id is already VARCHAR';
        END IF;
        
        -- Check document_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'notice_components' 
            AND column_name = 'document_id' 
            AND data_type = 'integer'
        ) THEN
            RAISE NOTICE 'Converting notice_components.document_id from INTEGER to VARCHAR...';
            ALTER TABLE notice_components 
            ALTER COLUMN document_id TYPE VARCHAR(255) USING document_id::VARCHAR;
            RAISE NOTICE '✓ notice_components.document_id converted';
        ELSE
            RAISE NOTICE '✓ notice_components.document_id is already VARCHAR';
        END IF;
    ELSE
        RAISE NOTICE '! Table notice_components does not exist';
    END IF;
END $$;

-- 3. Show final status
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    CASE 
        WHEN c.data_type = 'integer' THEN '❌ NEEDS FIX'
        ELSE '✅ OK'
    END as status
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
AND t.table_name IN ('served_notices', 'notice_batch_items', 'notice_components')
AND c.column_name IN ('notice_id', 'alert_id', 'document_id')
ORDER BY t.table_name, c.column_name;