#!/bin/bash

echo "🔐 Legal Service NFT - Key Setup Helper"
echo "======================================="
echo ""

# Get private key
echo "📝 Enter your TRON private key (64 characters):"
echo "   (Get from TronLink → Account → Export Private Key)"
read -s PRIVATE_KEY
echo ""

# Get fee collector address
echo "📝 Enter your wallet address for fee collection:"
echo "   (Format: T... - your TRON address)"
read FEE_COLLECTOR
echo ""

# Create .env file
cat > .env << EOF
# TRON Deployment Configuration
TRON_PRIVATE_KEY=$PRIVATE_KEY
FEE_COLLECTOR=$FEE_COLLECTOR
NETWORK=nile
EOF

echo "✅ Created .env file with your configuration"
echo ""

# Run checker
echo "🔍 Running deployment checker..."
node deploy-checker.js