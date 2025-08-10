-- Migration: Add fields for compiled document support
-- Date: 2025-01-10
-- Purpose: Support multi-document compilation feature

-- Add new columns to notice_components table
ALTER TABLE notice_components 
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_compiled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS document_count INTEGER DEFAULT 1;

-- Create index for compiled documents
CREATE INDEX IF NOT EXISTS idx_is_compiled ON notice_components(is_compiled);

-- Update existing records to have default values
UPDATE notice_components 
SET page_count = 1, 
    is_compiled = FALSE, 
    document_count = 1 
WHERE page_count IS NULL;