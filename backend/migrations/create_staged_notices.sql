-- Create staged_notices table for validating and staging notices before blockchain submission
CREATE TABLE IF NOT EXISTS staged_notices (
    id SERIAL PRIMARY KEY,
    
    -- Notice data fields (must match smart contract parameters)
    recipient_address VARCHAR(255) NOT NULL,
    encrypted_ipfs TEXT NOT NULL,
    encryption_key TEXT NOT NULL,
    issuing_agency VARCHAR(255) NOT NULL, -- Must match process_servers.agency
    notice_type VARCHAR(100) NOT NULL,
    case_number VARCHAR(100),
    case_details TEXT,
    legal_rights TEXT,
    sponsor_fees BOOLEAN DEFAULT false,
    metadata_uri TEXT,
    
    -- Server information
    server_address VARCHAR(255) NOT NULL, -- Must match process_servers.wallet_address
    
    -- Staging status
    status VARCHAR(50) DEFAULT 'pending', -- pending, submitted, confirmed, failed
    
    -- Blockchain confirmation fields (populated after events)
    alert_id TEXT,
    document_id TEXT,
    notice_id TEXT,
    transaction_hash VARCHAR(255),
    block_number BIGINT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP, -- When sent to blockchain
    confirmed_at TIMESTAMP, -- When confirmed by blockchain event
    
    -- Indexes for performance
    CONSTRAINT fk_server_address FOREIGN KEY (server_address) 
        REFERENCES process_servers(wallet_address) ON DELETE CASCADE
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_staged_notices_status ON staged_notices(status);
CREATE INDEX IF NOT EXISTS idx_staged_notices_server ON staged_notices(server_address);
CREATE INDEX IF NOT EXISTS idx_staged_notices_recipient ON staged_notices(recipient_address);
CREATE INDEX IF NOT EXISTS idx_staged_notices_created ON staged_notices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staged_notices_tx_hash ON staged_notices(transaction_hash);

-- Add unique constraint on transaction hash when it exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_staged_notices_tx_unique 
    ON staged_notices(transaction_hash) 
    WHERE transaction_hash IS NOT NULL;

-- Create function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_staged_notices_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'submitted' AND OLD.status = 'pending' THEN
        NEW.submitted_at = NOW();
    END IF;
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        NEW.confirmed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for timestamp updates
DROP TRIGGER IF EXISTS update_staged_notices_timestamps ON staged_notices;
CREATE TRIGGER update_staged_notices_timestamps
    BEFORE UPDATE ON staged_notices
    FOR EACH ROW
    EXECUTE PROCEDURE update_staged_notices_timestamp();

-- Add comment explaining the table's purpose
COMMENT ON TABLE staged_notices IS 'Staging table for validating notices before blockchain submission and tracking confirmation';
COMMENT ON COLUMN staged_notices.issuing_agency IS 'Must match the agency field in process_servers table for the server_address';
COMMENT ON COLUMN staged_notices.status IS 'pending: awaiting submission, submitted: sent to blockchain, confirmed: blockchain event received, failed: transaction failed';