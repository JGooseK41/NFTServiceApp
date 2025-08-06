#!/bin/bash

# Database setup script for NFT Service App

echo "Setting up NFT Service App Database..."

# Database connection details
export PGPASSWORD=9sH6aWG250oNlzbEyeg5Z75TyFJgXp4C
DB_HOST=dpg-d290ovqli9vc739cllm0-a.virginia-postgres.render.com
DB_USER=nftserviceapp_db_user
DB_NAME=nftserviceapp_db

# Run the init.sql file
echo "Creating database tables..."
psql -h $DB_HOST -U $DB_USER $DB_NAME -f init.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup complete!"
    echo ""
    echo "Tables created:"
    echo "  - notice_views (tracks document views)"
    echo "  - notice_acceptances (tracks acceptances)"
    echo "  - served_notices (notice metadata)"
    echo "  - process_servers (server registry)"
    echo "  - audit_logs (audit trail)"
    echo "  - wallet_connections (wallet tracking)"
    echo "  - blockchain_cache (performance cache)"
    echo ""
    echo "Your backend is now ready to track audit trails!"
else
    echo "❌ Error setting up database. Please check your connection."
fi