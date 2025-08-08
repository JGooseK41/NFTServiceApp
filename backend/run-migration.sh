#!/bin/bash

# Backend Migration Script
# This script runs the complete restructure migration

echo "================================"
echo "NFT Service Backend Migration"
echo "================================"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set database URL if not already set
if [ -z "$DATABASE_URL" ]; then
    DATABASE_URL="postgresql://nftservice:nftservice123@localhost:5432/nftservice_db"
fi

echo "Database URL: $DATABASE_URL"
echo ""

# Confirm before proceeding
read -p "This will restructure the database. Are you sure? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 1
fi

echo "Running migration..."
psql "$DATABASE_URL" < migrations/complete_restructure.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "New tables created:"
    echo "  - pending_notices (pre-blockchain stage)"
    echo "  - active_notices (served notices)"
    echo "  - notice_events (all interactions)"
    echo "  - notice_cache (performance cache)"
    echo ""
    echo "Views created:"
    echo "  - server_dashboard"
    echo "  - cases_summary"
    echo ""
    echo "Old tables removed:"
    echo "  - served_notices"
    echo "  - notice_views"
    echo "  - notice_acceptances"
    echo "  - audit_logs"
    echo "  - notice_components"
    echo ""
    echo "Next steps:"
    echo "1. Restart the backend server"
    echo "2. Test the new endpoints"
    echo "3. Clear browser cache and reload frontend"
else
    echo ""
    echo "❌ Migration failed! Check the error messages above."
    exit 1
fi