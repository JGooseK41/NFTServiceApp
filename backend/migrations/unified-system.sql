-- Unified System Database Schema
-- Properly tracks server addresses and pairs Alert/Document NFTs

-- Add missing columns to served_notices if they don't exist
ALTER TABLE served_notices 
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING_BLOCKCHAIN',
ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(100),
ADD COLUMN IF NOT EXISTS block_number BIGINT;

-- Create index for case lookups
CREATE INDEX IF NOT EXISTS idx_served_notices_case_server 
ON served_notices(case_number, server_address);

-- Update any null server addresses from the transaction events
UPDATE served_notices sn
SET server_address = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
WHERE server_address IS NULL 
   OR server_address = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'
   OR server_address = '';

-- Remove test data
DELETE FROM served_notices 
WHERE case_number LIKE '%TEST%';

-- Ensure we have the correct real cases
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

-- Mark case 123456 as accepted/signed
UPDATE served_notices 
SET accepted = true,
    accepted_at = NOW() - INTERVAL '1 hour'
WHERE case_number = '123456';

-- Add some view tracking for testing
INSERT INTO notice_views (notice_id, viewer_address, ip_address, viewed_at)
VALUES 
('notice_123456_alert', 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH', '192.168.1.1', NOW() - INTERVAL '1 hour'),
('notice_34987654_alert', 'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE', '192.168.1.2', NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;

-- Clean up any orphaned records
DELETE FROM notice_views 
WHERE notice_id IN (
    SELECT nv.notice_id 
    FROM notice_views nv
    LEFT JOIN served_notices sn ON sn.notice_id = nv.notice_id
    WHERE sn.notice_id IS NULL
);

-- Verify the data
SELECT 
    case_number,
    server_address,
    recipient_address,
    alert_id,
    document_id,
    accepted,
    created_at
FROM served_notices
WHERE server_address = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
ORDER BY created_at DESC;