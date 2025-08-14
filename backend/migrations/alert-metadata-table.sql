-- Alert Metadata Table
-- Stores base64 metadata for Alert NFTs

CREATE TABLE IF NOT EXISTS alert_metadata (
    alert_id INTEGER PRIMARY KEY,
    metadata_uri TEXT NOT NULL,              -- The full data:application/json;base64,... URI
    metadata_type VARCHAR(50) NOT NULL,      -- 'base64', 'ipfs', or 'http'
    case_number VARCHAR(255),
    recipient_address VARCHAR(255),
    server_address VARCHAR(255),
    issuing_agency VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    image_embedded BOOLEAN DEFAULT true,     -- Whether image is embedded in metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_metadata_case ON alert_metadata(case_number);
CREATE INDEX IF NOT EXISTS idx_alert_metadata_recipient ON alert_metadata(recipient_address);
CREATE INDEX IF NOT EXISTS idx_alert_metadata_type ON alert_metadata(metadata_type);
CREATE INDEX IF NOT EXISTS idx_alert_metadata_status ON alert_metadata(status);

-- Add column to notices table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notices' 
                   AND column_name = 'alert_metadata_type') THEN
        ALTER TABLE notices 
        ADD COLUMN alert_metadata_type VARCHAR(50) DEFAULT 'ipfs';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notices' 
                   AND column_name = 'alert_metadata_uri') THEN
        ALTER TABLE notices 
        ADD COLUMN alert_metadata_uri TEXT;
    END IF;
END $$;

-- Function to update metadata type when serving notice
CREATE OR REPLACE FUNCTION update_alert_metadata_type()
RETURNS TRIGGER AS $$
BEGIN
    -- If the URI starts with 'data:', it's base64
    IF NEW.alert_metadata_uri LIKE 'data:%' THEN
        NEW.alert_metadata_type := 'base64';
    ELSIF NEW.alert_metadata_uri LIKE 'ipfs://%' THEN
        NEW.alert_metadata_type := 'ipfs';
    ELSIF NEW.alert_metadata_uri LIKE 'http%' THEN
        NEW.alert_metadata_type := 'http';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger 
                   WHERE tgname = 'update_metadata_type_trigger') THEN
        CREATE TRIGGER update_metadata_type_trigger
        BEFORE INSERT OR UPDATE ON notices
        FOR EACH ROW
        EXECUTE FUNCTION update_alert_metadata_type();
    END IF;
END $$;