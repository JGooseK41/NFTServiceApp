#!/bin/bash

echo "Deploying v2 to production..."

# Create a backup of current site
echo "1. Backing up current site..."
cp -r ../index.html ../index.html.v1.backup
cp -r ../js ../js.v1.backup
cp -r ../css ../css.v1.backup

# Copy v2 files to root
echo "2. Copying v2 files to root..."
cp index.html ../index-v2.html
cp -r js ../js-v2
cp -r css ../css-v2

echo "3. Creating switcher page..."
cat > ../index-switcher.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>LegalNotice - Choose Version</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
        }
        h1 { color: #333; }
        .buttons {
            display: flex;
            gap: 20px;
            margin-top: 30px;
        }
        .btn {
            flex: 1;
            padding: 15px 30px;
            font-size: 18px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            text-decoration: none;
            color: white;
            transition: transform 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .btn-v1 {
            background: #28a745;
        }
        .btn-v2 {
            background: #007bff;
        }
        .recommended {
            background: #ffc107;
            color: #333;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>LegalNotice Service</h1>
        <p>Choose your preferred version:</p>
        
        <div class="buttons">
            <a href="index.html" class="btn btn-v1">
                Classic Version
                <br><small>Original UI</small>
            </a>
            <a href="index-v2.html" class="btn btn-v2">
                Version 2.0
                <span class="recommended">RECOMMENDED</span>
                <br><small>Clean Architecture</small>
            </a>
        </div>
        
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
            V2 Features: Multiple PDF consolidation, Base64 thumbnails, Clean modules
        </p>
    </div>
</body>
</html>
EOF

echo "4. Done! You can now:"
echo "   - Test locally first"
echo "   - Push to GitHub/Netlify"
echo "   - Users can choose their version"
echo ""
echo "To make v2 the default, rename:"
echo "   index.html -> index-v1.html"
echo "   index-v2.html -> index.html"