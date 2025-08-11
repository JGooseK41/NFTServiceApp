-- Comprehensive fix for process server registration
-- Run this on Render: psql $DATABASE_URL < migrations/fix_process_server_registration.sql

-- 1. Ensure process_servers table exists with all columns
CREATE TABLE IF NOT EXISTS process_servers (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    agency VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    server_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    jurisdiction VARCHAR(255),
    license_number VARCHAR(255),
    notes TEXT,
    total_notices_served INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add any missing columns
ALTER TABLE process_servers 
ADD COLUMN IF NOT EXISTS total_notices_served INTEGER DEFAULT 0;

ALTER TABLE process_servers 
ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(255);

ALTER TABLE process_servers 
ADD COLUMN IF NOT EXISTS license_number VARCHAR(255);

ALTER TABLE process_servers 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_process_servers_wallet ON process_servers(wallet_address);
CREATE INDEX IF NOT EXISTS idx_process_servers_status ON process_servers(status);

-- 4. Insert/Update your process server registration
INSERT INTO process_servers (
    wallet_address,
    name,
    agency,
    email,
    phone,
    status,
    jurisdiction,
    notes
) VALUES (
    'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
    'Jesse',
    'The Block Service',
    'service@theblockservice.com',
    '',
    'approved',
    'United States',
    'Primary admin server'
) ON CONFLICT (wallet_address) 
DO UPDATE SET
    name = EXCLUDED.name,
    agency = EXCLUDED.agency,
    email = EXCLUDED.email,
    status = EXCLUDED.status,
    jurisdiction = EXCLUDED.jurisdiction,
    updated_at = CURRENT_TIMESTAMP;

-- 5. Also handle lowercase wallet address
INSERT INTO process_servers (
    wallet_address,
    name,
    agency,
    email,
    phone,
    status,
    jurisdiction,
    notes
) VALUES (
    'tgdd34rr3rzfuozoqlze9d4tzfbigl4jay',
    'Jesse',
    'The Block Service',
    'service@theblockservice.com',
    '',
    'approved',
    'United States',
    'Primary admin server (lowercase)'
) ON CONFLICT (wallet_address) 
DO UPDATE SET
    name = EXCLUDED.name,
    agency = EXCLUDED.agency,
    email = EXCLUDED.email,
    status = EXCLUDED.status,
    jurisdiction = EXCLUDED.jurisdiction,
    updated_at = CURRENT_TIMESTAMP;

-- 6. Show the results
SELECT 
    wallet_address,
    name,
    agency,
    email,
    status,
    created_at,
    updated_at
FROM process_servers 
WHERE wallet_address IN (
    'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
    'tgdd34rr3rzfuozoqlze9d4tzfbigl4jay'
);