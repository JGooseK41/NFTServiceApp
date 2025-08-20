/**
 * Check NFT metadata directly on-chain
 */

const CONTRACT_ADDRESS = 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';

async function checkTokenURI(tokenId) {
    const url = 'https://nile.trongrid.io/wallet/triggersmartcontract';
    
    // Prepare the call
    const payload = {
        owner_address: "410000000000000000000000000000000000000000", // dummy address for view function
        contract_address: CONTRACT_ADDRESS.startsWith('T') 
            ? CONTRACT_ADDRESS  // Let API handle conversion
            : CONTRACT_ADDRESS,
        function_selector: "tokenURI(uint256)",
        parameter: tokenId.toString(16).padStart(64, '0'),
        visible: true
    };
    
    console.log(`\n📍 Checking Alert NFT #${tokenId}:`);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.result && data.result.result) {
            // Get the constant_result
            const constantResult = data.constant_result?.[0];
            
            if (!constantResult || constantResult === '0'.repeat(64)) {
                console.log('   ❌ No URI set');
                return null;
            }
            
            // Decode the ABI-encoded string
            // Format: offset (32 bytes) + length (32 bytes) + data
            const decoded = decodeABIString(constantResult);
            
            if (decoded) {
                console.log(`   ✅ URI: ${decoded.substring(0, 80)}...`);
                
                // Check metadata
                await checkMetadata(decoded);
                
                return decoded;
            } else {
                console.log('   ❌ Could not decode URI');
            }
        } else {
            console.log('   ❌ Contract call failed:', data.result?.message || 'Unknown error');
        }
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
    
    return null;
}

function decodeABIString(hex) {
    try {
        // Remove 0x if present
        hex = hex.replace(/^0x/, '');
        
        // ABI encoding for string: offset (32 bytes) + length (32 bytes) + data
        if (hex.length < 128) return null;
        
        // Skip offset (first 64 chars)
        // Get length (next 64 chars)
        const lengthHex = hex.substring(64, 128);
        const length = parseInt(lengthHex, 16);
        
        if (length === 0) return null;
        
        // Get the actual string data
        const dataHex = hex.substring(128, 128 + (length * 2));
        
        // Convert hex to string
        let result = '';
        for (let i = 0; i < dataHex.length; i += 2) {
            const byte = parseInt(dataHex.substr(i, 2), 16);
            if (byte > 0) {
                result += String.fromCharCode(byte);
            }
        }
        
        return result.trim();
    } catch (e) {
        return null;
    }
}

async function checkMetadata(uri) {
    if (!uri) return;
    
    try {
        // Handle IPFS URIs
        if (uri.startsWith('ipfs://')) {
            const ipfsHash = uri.replace('ipfs://', '');
            console.log(`   IPFS Hash: ${ipfsHash}`);
            
            // Try to fetch from gateway
            const gateway = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
            const response = await fetch(gateway);
            
            if (response.ok) {
                const text = await response.text();
                
                // Check if HTML or JSON
                if (text.trim().startsWith('<')) {
                    console.log('   ❌ IPFS returns HTML (404/error) - metadata not accessible');
                } else {
                    try {
                        const metadata = JSON.parse(text);
                        console.log(`   ✅ Metadata found: "${metadata.name}"`);
                        
                        if (metadata.image) {
                            console.log(`   Image: ${metadata.image.substring(0, 60)}...`);
                            
                            // Check if image is accessible
                            if (metadata.image.startsWith('ipfs://')) {
                                const imgHash = metadata.image.replace('ipfs://', '');
                                const imgResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${imgHash}`, {
                                    method: 'HEAD'
                                });
                                
                                if (imgResponse.ok) {
                                    console.log('   ✅ Image is accessible');
                                } else {
                                    console.log('   ❌ Image not accessible');
                                }
                            }
                        } else {
                            console.log('   ❌ No image in metadata');
                        }
                    } catch (e) {
                        console.log('   ❌ Invalid JSON metadata');
                    }
                }
            } else {
                console.log(`   ❌ Could not fetch metadata: HTTP ${response.status}`);
            }
        }
        // Handle data URIs
        else if (uri.startsWith('data:')) {
            const base64 = uri.split(',')[1];
            const metadata = JSON.parse(Buffer.from(base64, 'base64').toString());
            console.log(`   ✅ Data URI metadata: "${metadata.name}"`);
            
            if (metadata.image) {
                console.log('   ✅ Has image');
            }
        }
    } catch (error) {
        console.log('   ❌ Metadata check failed:', error.message);
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('🔍 CHECKING ALERT NFT METADATA ON-CHAIN');
    console.log('='.repeat(70));
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log('Network: Nile Testnet');
    
    // Check the NFTs user mentioned
    const alertIds = [1, 13, 19];
    
    console.log('\nChecking Alert NFTs user mentioned:');
    for (const id of alertIds) {
        await checkTokenURI(id);
    }
    
    // Check a few more for comparison
    console.log('\n' + '-'.repeat(70));
    console.log('Checking other Alert NFTs for comparison:');
    
    const otherAlerts = [3, 5, 7, 9, 11, 15, 17, 21];
    for (const id of otherAlerts) {
        await checkTokenURI(id);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log('\nIf Alert #13 shows but #19 doesn\'t:');
    console.log('• #13 may have been minted with metadata, #19 without');
    console.log('• #13\'s metadata may be cached in wallet, #19\'s not');
    console.log('• Wallet may have different display rules for different token IDs');
    console.log('\n💡 Solution: Ensure all Alert NFTs have metadata URIs set during minting');
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

main().catch(console.error);