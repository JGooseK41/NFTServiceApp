-- Emergency fix for NULL server_address issue
-- This script updates all NULL server_address fields to your wallet address

-- Your process server wallet
\set server_wallet 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6'

-- Fix notice_components table
UPDATE notice_components
SET server_address = :'server_wallet'
WHERE server_address IS NULL OR server_address = '';

-- Fix served_notices table to allow NULL temporarily
ALTER TABLE served_notices ALTER COLUMN server_address DROP NOT NULL;

-- Update existing NULL values
UPDATE served_notices
SET server_address = :'server_wallet'
WHERE server_address IS NULL;

-- Try to update token_tracking if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'token_tracking') THEN
        EXECUTE 'UPDATE token_tracking SET server_address = $1 WHERE server_address IS NULL OR server_address = '''' '
        USING 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6';
    END IF;
END $$;

-- Show results
SELECT 'notice_components' as table_name, COUNT(*) as total, 
       COUNT(server_address) as has_server, 
       COUNT(CASE WHEN server_address = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6' THEN 1 END) as your_wallet
FROM notice_components
UNION ALL
SELECT 'served_notices', COUNT(*), COUNT(server_address), 
       COUNT(CASE WHEN server_address = 'TJRex3vGsNeoNjKWEXsM87qCDdvqV7Koa6' THEN 1 END)
FROM served_notices;