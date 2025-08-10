-- URGENT FIX for production errors
-- Run this immediately in Render PostgreSQL shell to fix the current errors

-- Step 1: Add page_count column to notice_components table
ALTER TABLE notice_components 
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1;

-- Step 2: Remove the unused compiled_document columns that are causing errors
-- These are not needed since data is stored in notice_components
ALTER TABLE served_notices 
DROP COLUMN IF EXISTS compiled_document_id CASCADE,
DROP COLUMN IF EXISTS compiled_document_url CASCADE,
DROP COLUMN IF EXISTS compiled_thumbnail_url CASCADE,
DROP COLUMN IF EXISTS page_count CASCADE;

-- Verify the fix
SELECT 'Fixed!' as status;