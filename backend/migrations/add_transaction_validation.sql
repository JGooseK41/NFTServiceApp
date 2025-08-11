-- Add transaction validation columns to served_notices
ALTER TABLE served_notices 
ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS block_number BIGINT,
ADD COLUMN IF NOT EXISTS blockchain_verified BOOLEAN DEFAULT FALSE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_served_notices_tx_hash 
ON served_notices(transaction_hash);

CREATE INDEX IF NOT EXISTS idx_served_notices_blockchain_verified 
ON served_notices(blockchain_verified);

-- Create unique constraint on transaction_hash when not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_served_notices_tx_unique 
ON served_notices(transaction_hash) 
WHERE transaction_hash IS NOT NULL AND transaction_hash != '';

-- Remove false positives (notices without blockchain confirmation from last 7 days)
DELETE FROM served_notices 
WHERE (transaction_hash IS NULL OR transaction_hash = '')
  AND blockchain_verified = FALSE
  AND created_at > NOW() - INTERVAL '7 days';

-- Update status for unverified notices
UPDATE served_notices 
SET status = 'PENDING_BLOCKCHAIN'
WHERE (transaction_hash IS NULL OR transaction_hash = '')
  AND blockchain_verified = FALSE;

-- Add comment explaining the columns
COMMENT ON COLUMN served_notices.transaction_hash IS 'Blockchain transaction hash - required for delivered status';
COMMENT ON COLUMN served_notices.blockchain_verified IS 'True only when verified on blockchain';
COMMENT ON COLUMN served_notices.block_number IS 'Block number where transaction was mined';