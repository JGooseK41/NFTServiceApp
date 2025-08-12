#!/bin/bash

# Test Document Access Control System
# Run this after deployment to verify it's working

echo "=========================================="
echo "Testing Document Access Control System"
echo "=========================================="
echo ""

# Check if we're in Render environment
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not found. Are you in the Render shell?"
    exit 1
fi

echo "1. Checking tables exist..."
psql $DATABASE_URL -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('document_access_tokens', 'access_attempts', 'document_access_log');" | while read table; do
    if [ ! -z "$table" ]; then
        echo "   ✅ Table exists: $table"
    fi
done

echo ""
echo "2. Testing access control functions..."

# Test can_access_document function
echo "   Testing can_access_document()..."
psql $DATABASE_URL -t -c "SELECT can_access_document('TTestWallet123', 1);" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ can_access_document() function works"
else
    echo "   ❌ can_access_document() function failed"
fi

# Test get_access_level function
echo "   Testing get_access_level()..."
psql $DATABASE_URL -t -c "SELECT * FROM get_access_level('TTestWallet123', 1, 2) LIMIT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ get_access_level() function works"
else
    echo "   ❌ get_access_level() function failed"
fi

echo ""
echo "3. Checking for recent access attempts..."
ATTEMPTS=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM access_attempts WHERE attempted_at > NOW() - INTERVAL '24 hours';")
echo "   Access attempts in last 24 hours: $ATTEMPTS"

echo ""
echo "4. Checking for active access tokens..."
TOKENS=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM document_access_tokens WHERE expires_at > NOW();")
echo "   Active access tokens: $TOKENS"

echo ""
echo "5. Sample data check..."
echo "   Recent notices with recipient info:"
psql $DATABASE_URL -c "SELECT token_id, token_type, recipient_address, created_at FROM token_tracking WHERE token_type = 'document' ORDER BY created_at DESC LIMIT 3;"

echo ""
echo "=========================================="
echo "Test complete!"
echo ""
echo "To manually test the API endpoints:"
echo ""
echo "1. Test public access (anyone can do this):"
echo "   curl https://nftserviceapp.onrender.com/api/access/public/1"
echo ""
echo "2. Test recipient verification (requires wallet):"
echo "   POST to /api/access/verify-recipient with:"
echo "   {"
echo "     \"walletAddress\": \"YOUR_WALLET\","
echo "     \"alertTokenId\": 1,"
echo "     \"documentTokenId\": 2"
echo "   }"
echo ""
echo "3. Test document access (requires access token):"
echo "   GET /api/access/document/2"
echo "   Header: X-Access-Token: YOUR_TOKEN"
echo ""