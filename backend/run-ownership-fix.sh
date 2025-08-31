#!/bin/bash

# Run ownership fix script on Render
# This links existing cases to the server wallet

echo "=== Running Case Ownership Fix ==="
echo "This will link all existing cases to the server wallet"
echo ""

# Set the server wallet address
export SERVER_WALLET="TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY"

# Run the fix script
node fix-case-ownership.js

echo ""
echo "=== Ownership fix complete ==="
echo "Check https://theblockservice.com Cases tab to verify"