-- Migration to add missing server registration fields
-- These fields link blockchain server IDs to backend records

-- Add server_id column (from blockchain)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='process_servers' 
        AND column_name='server_id'
    ) THEN
        ALTER TABLE process_servers ADD COLUMN server_id INTEGER UNIQUE;
        RAISE NOTICE 'Added server_id column to process_servers table';
    END IF;

    -- Add server_name column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='process_servers' 
        AND column_name='server_name'
    ) THEN
        ALTER TABLE process_servers ADD COLUMN server_name VARCHAR(255);
        RAISE NOTICE 'Added server_name column to process_servers table';
    END IF;

    -- Add physical_address column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='process_servers' 
        AND column_name='physical_address'
    ) THEN
        ALTER TABLE process_servers ADD COLUMN physical_address TEXT;
        RAISE NOTICE 'Added physical_address column to process_servers table';
    END IF;
END $$;

-- Create index for server_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_process_servers_server_id ON process_servers(server_id);

-- Add comment explaining the columns
COMMENT ON COLUMN process_servers.server_id IS 'Unique ID from blockchain smart contract';
COMMENT ON COLUMN process_servers.server_name IS 'Display name of the process server';
COMMENT ON COLUMN process_servers.physical_address IS 'Physical business address of the process server';