#!/bin/bash

# Check Alert NFT metadata directly from blockchain
# This shows exactly what's stored on-chain for each Alert

echo "=========================================="
echo "CHECKING ALERT NFT METADATA ON BLOCKCHAIN"
echo "=========================================="

# Contract address for Legal Notice NFT
CONTRACT="TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh"

# Function to check a specific token
check_token() {
    local TOKEN_ID=$1
    echo ""
    echo "Alert #$TOKEN_ID:"
    echo "-------------------"
    
    # Get tokenURI using tronweb (you'll need to have this set up)
    # This is a placeholder - you'd use actual tronweb CLI or API
    echo "Checking tokenURI for token $TOKEN_ID..."
    
    # Using curl to check via TronGrid API
    curl -s -X POST "https://api.trongrid.io/wallet/triggersmartcontract" \
        -H "Content-Type: application/json" \
        -d "{
            \"contract_address\": \"$CONTRACT\",
            \"function_selector\": \"tokenURI(uint256)\",
            \"parameter\": \"$(printf '%064x' $TOKEN_ID)\",
            \"owner_address\": \"TPfgHUkxPrDgmJ3BLeVcm4jvCBrVfkcNFG\"
        }" | jq -r '.constant_result[0]' | xxd -r -p | strings
}

# Check working alerts
echo ""
echo "CHECKING WORKING ALERTS (1, 13, 17):"
echo "====================================="
check_token 1
check_token 13
check_token 17

echo ""
echo "CHECKING NON-WORKING ALERT (19):"
echo "================================"
check_token 19

echo ""
echo "=========================================="
echo "ANALYSIS COMPLETE"
echo "=========================================="