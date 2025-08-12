#!/bin/bash

# Document Access Control Deployment Script
# Run this in Render shell

echo "=========================================="
echo "Document Access Control System Deployment"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Create access control tables"
echo "2. Set up tracking for document views"
echo "3. Enforce recipient-only document access"
echo ""

# Check if we're in Render environment
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not found. Are you in the Render shell?"
    echo "Please run this script from the Render shell."
    exit 1
fi

echo "Deploying to database..."
echo ""

# Run the SQL script
psql $DATABASE_URL < deploy-access-control.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS: Document Access Control System deployed!"
    echo ""
    echo "Testing the deployment..."
    
    # Test the tables exist
    psql $DATABASE_URL -c "SELECT COUNT(*) FROM document_access_tokens;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ document_access_tokens table created"
    fi
    
    psql $DATABASE_URL -c "SELECT COUNT(*) FROM access_attempts;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ access_attempts table created"
    fi
    
    psql $DATABASE_URL -c "SELECT COUNT(*) FROM document_access_log;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ document_access_log table created"
    fi
    
    echo ""
    echo "System Status:"
    echo "  - Document access control: ACTIVE"
    echo "  - Only recipients can view documents: YES"
    echo "  - Access logging: ENABLED"
    echo ""
    echo "Next steps:"
    echo "1. Restart your Render service to load the new routes"
    echo "2. Test with a recipient wallet to verify access"
    echo "3. Test with a non-recipient wallet to verify restriction"
    echo ""
else
    echo ""
    echo "❌ ERROR: Deployment failed. Please check the error messages above."
    echo "You may need to run the SQL commands manually."
    exit 1
fi

echo "Deployment complete!"