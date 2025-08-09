-- Add missing columns to served_notices table
-- Run this in Render's PostgreSQL shell

ALTER TABLE served_notices 
ADD COLUMN IF NOT EXISTS alert_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS document_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING_BLOCKCHAIN',
ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(100),
ADD COLUMN IF NOT EXISTS block_number BIGINT;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'served_notices' 
AND column_name IN ('alert_id', 'document_id', 'page_count', 'recipient_name', 'status', 'transaction_hash', 'block_number');

-- Insert your known cases
INSERT INTO served_notices (
    notice_id, 
    case_number, 
    server_address, 
    recipient_address,
    notice_type,
    issuing_agency,
    alert_id,
    document_id,
    has_document,
    created_at
) VALUES 
(
    'notice_123456_alert',
    '123456',
    'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
    'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH',
    'Legal Notice',
    'Court Agency',
    '1',
    '2',
    true,
    NOW() - INTERVAL '2 days'
),
(
    'notice_34987654_alert',
    '34-987654',
    'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
    'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE',
    'Notice of Seizure',
    'The Block Audit',
    '3',
    '4',
    true,
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (notice_id) DO UPDATE
SET 
    server_address = EXCLUDED.server_address,
    case_number = EXCLUDED.case_number,
    alert_id = EXCLUDED.alert_id,
    document_id = EXCLUDED.document_id;

-- Verify data was inserted
SELECT case_number, server_address, recipient_address, alert_id, document_id
FROM served_notices
WHERE server_address = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';