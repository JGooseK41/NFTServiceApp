-- Add missing total_notices_served column to process_servers table
ALTER TABLE process_servers 
ADD COLUMN IF NOT EXISTS total_notices_served INTEGER DEFAULT 0;

-- Update the count from actual served notices
UPDATE process_servers ps
SET total_notices_served = (
    SELECT COUNT(DISTINCT notice_id) 
    FROM served_notices sn 
    WHERE sn.server_address = ps.wallet_address
      AND sn.blockchain_verified = TRUE
);

-- Add comment
COMMENT ON COLUMN process_servers.total_notices_served IS 'Count of blockchain-verified notices served by this process server';