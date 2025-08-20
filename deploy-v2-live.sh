#!/bin/bash

echo "==================================="
echo "Deploying V2 as Live Site"
echo "==================================="

# Backup current v1
echo "1. Backing up current v1 site..."
mkdir -p v1-backup
cp index.html v1-backup/index.html 2>/dev/null || true
cp -r js v1-backup/js-v1 2>/dev/null || true
cp -r css v1-backup/css-v1 2>/dev/null || true

# Move v2 to root
echo "2. Moving v2 to live position..."
cp v2/index.html index-v2-live.html
cp -r v2/js js-v2
cp -r v2/css css-v2

# Update paths in the new index file
echo "3. Updating paths in v2 index..."
sed -i 's|href="css/main.css"|href="css-v2/main.css"|g' index-v2-live.html
sed -i 's|src="js/|src="js-v2/|g' index-v2-live.html

# Create a simple switcher as temporary index
echo "4. Creating switcher (temporary)..."
cat > index-temp.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>LegalNotice Service</title>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=index-v2-live.html">
    <script>
        // Auto-redirect to v2
        window.location.replace("index-v2-live.html");
    </script>
</head>
<body>
    <p>Redirecting to LegalNotice v2...</p>
    <p>If not redirected, <a href="index-v2-live.html">click here</a></p>
</body>
</html>
EOF

echo ""
echo "==================================="
echo "DEPLOYMENT READY!"
echo "==================================="
echo ""
echo "Files created:"
echo "  - index-v2-live.html (new v2 interface)"
echo "  - index-temp.html (auto-redirects to v2)"
echo "  - js-v2/ (v2 JavaScript)"
echo "  - css-v2/ (v2 styles)"
echo ""
echo "To go live:"
echo "  1. Test locally: python3 -m http.server 8080"
echo "  2. If everything works:"
echo "     mv index.html index-v1-old.html"
echo "     mv index-v2-live.html index.html"
echo "  3. Commit and push to GitHub"
echo "  4. Netlify will auto-deploy"
echo ""
echo "To rollback if needed:"
echo "  mv index.html index-v2-broken.html"
echo "  mv index-v1-old.html index.html"