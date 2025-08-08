-- Create audit logs table for tracking all notice service attempts
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    sender_address VARCHAR(42) NOT NULL,
    recipient_address VARCHAR(42),
    notice_type VARCHAR(100),
    case_number VARCHAR(100),
    status VARCHAR(50) NOT NULL, -- 'attempt', 'success', 'failed', 'validation_error', 'energy_error', 'ipfs_error', 'blockchain_error'
    error_message TEXT,
    error_code VARCHAR(50),
    transaction_hash VARCHAR(128),
    gas_used BIGINT,
    fee_paid BIGINT,
    document_hash VARCHAR(128),
    ipfs_hash VARCHAR(128),
    metadata JSONB,
    client_ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_audit_logs_sender ON audit_logs(sender_address);
CREATE INDEX idx_audit_logs_recipient ON audit_logs(recipient_address);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_transaction_hash ON audit_logs(transaction_hash);
CREATE INDEX idx_audit_logs_case_number ON audit_logs(case_number);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_audit_logs_updated_at 
    BEFORE UPDATE ON audit_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for all legal notice service attempts including failures';
COMMENT ON COLUMN audit_logs.status IS 'Status of the notice attempt: attempt, success, failed, validation_error, energy_error, ipfs_error, blockchain_error';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional metadata as JSON including network, wallet type, etc.';