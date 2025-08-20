#!/usr/bin/env node

/**
 * Investigate why only Alert NFT #1 displays images in wallets
 * while other Alert NFTs don't show images despite having metadata URIs
 */

const TronWeb = require('tronweb').default || require('tronweb');
const fetch = require('node-fetch');

// Configuration
const TRON_NETWORK = 'nile'; // testnet
const CONTRACT_ADDRESS = 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh'; // Your deployed contract

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: TRON_NETWORK === 'mainnet' 
        ? 'https://api.trongrid.io'
        : 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": process.env.TRON_PRO_API_KEY || '' }
});

// Contract ABI (minimal for tokenURI)
const CONTRACT_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"name": "", "type": "address"}],
        "type": "function"
    }
];

async function fetchMetadata(uri) {
    if (!uri) return null;
    
    try {
        // Handle IPFS URIs
        if (uri.startsWith('ipfs://')) {
            const ipfsHash = uri.replace('ipfs://', '');
            const gateways = [
                `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
                `https://ipfs.io/ipfs/${ipfsHash}`,
                `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
            ];
            
            for (const gateway of gateways) {
                try {
                    console.log(`      Trying gateway: ${gateway.substring(0, 50)}...`);
                    const response = await fetch(gateway, { timeout: 5000 });
                    
                    if (response.ok) {
                        const text = await response.text();
                        
                        // Check if HTML (404 page) or JSON
                        if (text.trim().startsWith('<')) {
                            console.log('      ❌ Gateway returned HTML (404 or error page)');
                            continue;
                        }
                        
                        try {
                            const metadata = JSON.parse(text);
                            console.log('      ✅ Metadata fetched successfully');
                            return metadata;
                        } catch (e) {
                            console.log('      ❌ Invalid JSON:', text.substring(0, 100));
                            continue;
                        }
                    } else {
                        console.log(`      ❌ HTTP ${response.status}`);
                    }
                } catch (e) {
                    console.log(`      ❌ Fetch error: ${e.message}`);
                }
            }
            
            return null; // All gateways failed
        }
        
        // Handle data URIs
        if (uri.startsWith('data:')) {
            const base64 = uri.split(',')[1];
            const metadata = JSON.parse(Buffer.from(base64, 'base64').toString());
            console.log('      ✅ Data URI parsed successfully');
            return metadata;
        }
        
        // Handle HTTP(S) URIs
        if (uri.startsWith('http')) {
            const response = await fetch(uri);
            if (response.ok) {
                const metadata = await response.json();
                console.log('      ✅ HTTP metadata fetched');
                return metadata;
            }
        }
        
    } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
    }
    
    return null;
}

async function checkImageAccessibility(imageUri) {
    if (!imageUri) return false;
    
    try {
        if (imageUri.startsWith('ipfs://')) {
            const ipfsHash = imageUri.replace('ipfs://', '');
            const gateway = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
            const response = await fetch(gateway, { method: 'HEAD', timeout: 5000 });
            return response.ok;
        }
        
        if (imageUri.startsWith('data:image')) {
            return true; // Base64 images are always accessible
        }
        
        if (imageUri.startsWith('http')) {
            const response = await fetch(imageUri, { method: 'HEAD', timeout: 5000 });
            return response.ok;
        }
    } catch (e) {
        return false;
    }
    
    return false;
}

async function investigateAlerts() {
    console.log('=' .repeat(70));
    console.log('🔍 INVESTIGATING ALERT NFT DISPLAY ISSUES');
    console.log('=' .repeat(70));
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`Network: ${TRON_NETWORK}`);
    console.log('');
    
    try {
        // Initialize contract
        const contract = await tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        
        // Get total supply
        const totalSupply = await contract.totalSupply().call();
        const total = parseInt(totalSupply.toString());
        console.log(`Total NFTs minted: ${total}`);
        console.log('');
        
        // Check Alert NFTs (odd token IDs)
        const alertIds = [];
        for (let i = 1; i <= Math.min(total, 21); i += 2) {
            alertIds.push(i);
        }
        
        console.log(`Checking Alert NFTs: ${alertIds.join(', ')}`);
        console.log('-'.repeat(70));
        
        const results = [];
        
        for (const tokenId of alertIds) {
            console.log(`\n📍 Alert NFT #${tokenId}:`);
            
            try {
                // Get owner
                const owner = await contract.ownerOf(tokenId).call();
                console.log(`   Owner: ${tronWeb.address.fromHex(owner)}`);
                
                // Get tokenURI
                const uri = await contract.tokenURI(tokenId).call();
                
                if (!uri) {
                    console.log('   ❌ No URI set');
                    results.push({
                        id: tokenId,
                        hasURI: false,
                        uriType: 'none',
                        metadataFetched: false,
                        hasImage: false,
                        imageAccessible: false
                    });
                    continue;
                }
                
                console.log(`   URI: ${uri.substring(0, 60)}...`);
                
                // Determine URI type
                let uriType = 'unknown';
                if (uri.startsWith('ipfs://')) uriType = 'IPFS';
                else if (uri.startsWith('data:')) uriType = 'DataURI';
                else if (uri.startsWith('http')) uriType = 'HTTP';
                
                console.log(`   URI Type: ${uriType}`);
                
                // Fetch metadata
                console.log('   Fetching metadata...');
                const metadata = await fetchMetadata(uri);
                
                let hasImage = false;
                let imageAccessible = false;
                
                if (metadata) {
                    console.log(`   Name: ${metadata.name || 'N/A'}`);
                    console.log(`   Description: ${(metadata.description || 'N/A').substring(0, 50)}...`);
                    
                    if (metadata.image) {
                        hasImage = true;
                        console.log(`   Image URI: ${metadata.image.substring(0, 60)}...`);
                        
                        // Check image accessibility
                        console.log('   Checking image accessibility...');
                        imageAccessible = await checkImageAccessibility(metadata.image);
                        console.log(`   Image accessible: ${imageAccessible ? '✅ YES' : '❌ NO'}`);
                    } else {
                        console.log('   ❌ No image in metadata');
                    }
                } else {
                    console.log('   ❌ Could not fetch metadata');
                }
                
                results.push({
                    id: tokenId,
                    hasURI: true,
                    uriType,
                    metadataFetched: metadata !== null,
                    hasImage,
                    imageAccessible
                });
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                results.push({
                    id: tokenId,
                    error: error.message
                });
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('📊 SUMMARY');
        console.log('='.repeat(70));
        
        const fullyWorking = results.filter(r => 
            r.hasURI && r.metadataFetched && r.hasImage && r.imageAccessible
        );
        
        const hasURINoMetadata = results.filter(r => 
            r.hasURI && !r.metadataFetched
        );
        
        const hasMetadataNoImage = results.filter(r => 
            r.metadataFetched && !r.hasImage
        );
        
        const hasImageNotAccessible = results.filter(r => 
            r.hasImage && !r.imageAccessible
        );
        
        console.log(`✅ Fully working (visible in wallets): ${fullyWorking.map(r => '#' + r.id).join(', ') || 'NONE'}`);
        console.log(`⚠️  Has URI but metadata fetch failed: ${hasURINoMetadata.map(r => '#' + r.id).join(', ') || 'none'}`);
        console.log(`⚠️  Metadata OK but no image: ${hasMetadataNoImage.map(r => '#' + r.id).join(', ') || 'none'}`);
        console.log(`⚠️  Has image but not accessible: ${hasImageNotAccessible.map(r => '#' + r.id).join(', ') || 'none'}`);
        
        // Analysis by URI type
        console.log('\n📈 URI Type Analysis:');
        const ipfsTokens = results.filter(r => r.uriType === 'IPFS');
        const dataTokens = results.filter(r => r.uriType === 'DataURI');
        
        console.log(`IPFS URIs: ${ipfsTokens.map(r => '#' + r.id).join(', ') || 'none'}`);
        console.log(`Data URIs: ${dataTokens.map(r => '#' + r.id).join(', ') || 'none'}`);
        
        // Diagnosis
        console.log('\n🔍 DIAGNOSIS:');
        
        if (fullyWorking.length === 1 && fullyWorking[0].id === 1) {
            console.log('Only Alert #1 is fully working!');
            console.log('\nPossible reasons:');
            console.log('1. Alert #1 was created with different metadata storage method');
            console.log('2. Other Alert NFTs have expired IPFS pins');
            console.log('3. Other Alert NFTs were created with incorrect metadata URIs');
            console.log('4. IPFS gateway issues or pinning service problems');
        } else if (fullyWorking.length === 0) {
            console.log('NO Alert NFTs are fully working!');
            console.log('This suggests a systemic issue with metadata storage or IPFS pinning.');
        } else {
            console.log(`${fullyWorking.length} Alert NFTs are working: ${fullyWorking.map(r => '#' + r.id).join(', ')}`);
        }
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        
        if (hasURINoMetadata.length > 0) {
            console.log('1. Re-pin metadata to IPFS for tokens:', hasURINoMetadata.map(r => '#' + r.id).join(', '));
            console.log('   OR use data URIs instead of IPFS for more reliability');
        }
        
        if (hasImageNotAccessible.length > 0) {
            console.log('2. Fix image hosting for tokens:', hasImageNotAccessible.map(r => '#' + r.id).join(', '));
            console.log('   Consider hosting images on a reliable CDN or using base64 data URIs');
        }
        
        console.log('\n3. For future mints: Use data URIs or ensure IPFS pins are permanent');
        console.log('4. Consider implementing a fallback metadata hosting solution');
        
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

// Run investigation
investigateAlerts().then(() => {
    console.log('\n✅ Investigation complete');
    process.exit(0);
}).catch(error => {
    console.error('Investigation failed:', error);
    process.exit(1);
});