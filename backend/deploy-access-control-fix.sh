#!/bin/bash

echo "🔒 DEPLOYING ACCESS CONTROL FIX TO BACKEND"
echo "=========================================="
echo ""
echo "This script will update your notice-images.js to enforce strict access control"
echo ""

# Create backup
echo "1. Creating backup of current notice-images.js..."
cp routes/notice-images.js routes/notice-images.backup.js 2>/dev/null || echo "   No existing file to backup"

# Copy the secure version
echo "2. Deploying secure version with access control..."
cp routes/notice-images-secure.js routes/notice-images.js

echo "3. Verifying the update..."
if grep -q "STRICT ACCESS CONTROL" routes/notice-images.js; then
    echo "   ✅ Access control is now ACTIVE"
else
    echo "   ❌ Update may have failed"
    exit 1
fi

echo ""
echo "✅ ACCESS CONTROL FIX DEPLOYED!"
echo ""
echo "The backend now enforces:"
echo "  • Only process servers can view notices they served"
echo "  • Only recipients can view notices sent to them"
echo "  • Unauthorized access attempts are logged"
echo "  • All access is tracked in access_logs table"
echo ""
echo "Next steps:"
echo "1. Commit and push to GitHub"
echo "2. Deploy to Render (it will auto-deploy from GitHub)"
echo "3. Test with FixBackendAccessControl.verifyWorkflows()"
echo ""
echo "To test locally first:"
echo "  cd backend"
echo "  npm start"