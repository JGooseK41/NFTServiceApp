#!/bin/bash

# Check Alert NFT metadata directly from blockchain and IPFS
# Alert #13 is showing up but #19 is not

echo "======================================================================="
echo "🔍 CHECKING ALERT NFT METADATA"
echo "======================================================================="
echo "Contract: TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh"
echo "Network: Nile Testnet"
echo ""

# Function to check token URI
check_token_uri() {
    local token_id=$1
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📍 Alert NFT #$token_id:"
    
    # Call tokenURI function on contract
    local response=$(curl -s -X POST https://nile.trongrid.io/wallet/triggersmartcontract \
        -H "Content-Type: application/json" \
        -d '{
            "owner_address": "410000000000000000000000000000000000000000",
            "contract_address": "41883f95e5dcfa1e81f1b5e5a6df6e7e4bb83f91f8",
            "function_selector": "tokenURI(uint256)",
            "parameter": "'$(printf "%064x" $token_id)'",
            "visible": true
        }')
    
    # Extract the result
    local constant_result=$(echo "$response" | grep -o '"constant_result":\["[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$constant_result" ] || [ "$constant_result" = "0000000000000000000000000000000000000000000000000000000000000000" ]; then
        echo "   ❌ No URI set for this token"
        return
    fi
    
    # Decode the hex result to get the URI
    # The result is ABI encoded, we need to extract the string
    # Skip first 64 chars (offset), next 64 chars (length), then decode
    local uri_hex="${constant_result:128}"
    
    # Convert hex to ASCII
    local uri=""
    for ((i=0; i<${#uri_hex}; i+=2)); do
        local byte="${uri_hex:$i:2}"
        if [ "$byte" != "00" ]; then
            uri+=$(printf "\x$byte")
        fi
    done
    
    # Clean up the URI
    uri=$(echo "$uri" | tr -d '\0' | sed 's/[[:space:]]*$//')
    
    if [ -z "$uri" ]; then
        echo "   ❌ Empty URI"
        return
    fi
    
    echo "   URI: $uri"
    
    # Check if it's IPFS
    if [[ "$uri" == ipfs://* ]]; then
        local ipfs_hash="${uri#ipfs://}"
        echo "   Type: IPFS"
        echo "   IPFS Hash: $ipfs_hash"
        
        # Try to fetch metadata from IPFS
        echo "   Fetching metadata..."
        
        # Try Pinata gateway
        local metadata=$(curl -s --max-time 5 "https://gateway.pinata.cloud/ipfs/$ipfs_hash")
        
        # Check if we got HTML (error page) or JSON
        if [[ "$metadata" == \<* ]]; then
            echo "   ❌ Pinata gateway returned HTML (404 or error)"
            
            # Try ipfs.io gateway
            metadata=$(curl -s --max-time 5 "https://ipfs.io/ipfs/$ipfs_hash")
            if [[ "$metadata" == \<* ]]; then
                echo "   ❌ ipfs.io gateway also returned HTML"
            else
                echo "   ✅ Fetched from ipfs.io"
            fi
        else
            echo "   ✅ Fetched from Pinata"
        fi
        
        # If we got JSON, parse it
        if [[ "$metadata" == \{* ]]; then
            local name=$(echo "$metadata" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
            local image=$(echo "$metadata" | grep -o '"image":"[^"]*' | cut -d'"' -f4)
            
            echo "   Name: $name"
            
            if [ -n "$image" ]; then
                echo "   Image: ${image:0:60}..."
                
                # Check if image is accessible
                if [[ "$image" == ipfs://* ]]; then
                    local img_hash="${image#ipfs://}"
                    local img_check=$(curl -s --max-time 3 -I "https://gateway.pinata.cloud/ipfs/$img_hash" | head -n1)
                    if [[ "$img_check" == *"200"* ]]; then
                        echo "   ✅ Image is accessible"
                    else
                        echo "   ❌ Image not accessible (HTTP response: $img_check)"
                    fi
                fi
            else
                echo "   ❌ No image in metadata"
            fi
        else
            echo "   ❌ Could not parse metadata"
        fi
        
    elif [[ "$uri" == data:* ]]; then
        echo "   Type: Data URI"
        # Extract and decode base64
        local base64_data="${uri#data:application/json;base64,}"
        local metadata=$(echo "$base64_data" | base64 -d)
        
        local name=$(echo "$metadata" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
        local image=$(echo "$metadata" | grep -o '"image":"[^"]*' | cut -d'"' -f4)
        
        echo "   Name: $name"
        if [ -n "$image" ]; then
            echo "   ✅ Has image"
        else
            echo "   ❌ No image"
        fi
    fi
}

# Check specific Alert NFTs that user mentioned
echo "Checking Alert NFTs that should be visible..."
echo ""

# Alert #1 (works)
check_token_uri 1

# Alert #13 (user says now showing)
check_token_uri 13

# Alert #19 (user says not showing)
check_token_uri 19

# Check a few more for comparison
echo ""
echo "Checking other Alert NFTs for comparison..."
check_token_uri 3
check_token_uri 5
check_token_uri 7
check_token_uri 9
check_token_uri 11
check_token_uri 15
check_token_uri 17
check_token_uri 21

echo ""
echo "======================================================================="
echo "📊 ANALYSIS"
echo "======================================================================="
echo ""
echo "If Alert #13 is showing but #19 is not, possible reasons:"
echo "1. #13 has valid metadata that's accessible, #19's metadata is not"
echo "2. #13 uses a different storage method (data URI vs IPFS)"
echo "3. #19's IPFS pin may have expired or be inaccessible"
echo "4. Wallet may be caching #13 but not refreshing for #19"
echo ""
echo "✅ Investigation complete"