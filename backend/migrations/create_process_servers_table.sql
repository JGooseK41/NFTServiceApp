-- Create process_servers table for managing process server registrations
CREATE TABLE IF NOT EXISTS process_servers (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    agency VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    server_id VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, deactivated
    jurisdiction VARCHAR(255),
    license_number VARCHAR(100),
    notes TEXT,
    registration_data JSONB, -- Store any additional registration data
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    approved_by VARCHAR(255)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_process_servers_wallet ON process_servers(wallet_address);
CREATE INDEX IF NOT EXISTS idx_process_servers_status ON process_servers(status);
CREATE INDEX IF NOT EXISTS idx_process_servers_agency ON process_servers(agency);
CREATE INDEX IF NOT EXISTS idx_process_servers_created ON process_servers(created_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_process_servers_updated_at 
    BEFORE UPDATE ON process_servers 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();