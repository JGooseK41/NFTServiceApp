#!/bin/bash

# Script to run the migration on Render
# This script connects to PostgreSQL and runs the SQL commands

echo "Connecting to PostgreSQL database..."

# Use the DATABASE_URL environment variable that Render provides
psql $DATABASE_URL << EOF
-- Add page_count column to notice_components table
ALTER TABLE notice_components 
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1;

-- Remove the unused compiled_document columns
ALTER TABLE served_notices 
DROP COLUMN IF EXISTS compiled_document_id CASCADE,
DROP COLUMN IF EXISTS compiled_document_url CASCADE,
DROP COLUMN IF EXISTS compiled_thumbnail_url CASCADE,
DROP COLUMN IF EXISTS page_count CASCADE;

-- Verify the fix
SELECT 'Migration completed successfully!' as status;

-- Show current columns in served_notices
\d served_notices

-- Show current columns in notice_components  
\d notice_components
EOF

echo "Migration complete!"