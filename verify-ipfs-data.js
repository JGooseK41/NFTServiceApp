#!/usr/bin/env node

/**
 * IPFS Data Verification Script
 * Verifies that IPFS data is properly stored and accessible
 */

const fetch = require('node-fetch');

async function verifyIPFS() {
    console.log('🔍 Verifying IPFS Data from Latest Transaction\n');
    
    const ipfsHashes = {
        alertImage: 'QmdvbdmKmPT7HcYRLAYZPxHnH5Xcj447tXovtaWH6eKsHz',
        encryptedDoc: 'QmQg8cAaMxBfj1dFaKLWnEdPix6qButoBWwhYfPygxy7y2',
        metadata: 'QmTvSJ559PcCg9giyJun1GjWZq3M9uHBJ1B4Ar7N1gdact'
    };
    
    const gateways = [
        'https://gateway.pinata.cloud/ipfs/',
        'https://ipfs.io/ipfs/',
        'https://cloudflare-ipfs.com/ipfs/'
    ];
    
    for (const [type, hash] of Object.entries(ipfsHashes)) {
        console.log(`\n📦 Checking ${type}: ${hash}`);
        console.log('─'.repeat(60));
        
        for (const gateway of gateways) {
            const url = `${gateway}${hash}`;
            try {
                console.log(`Testing ${gateway.split('/')[2]}...`);
                const response = await fetch(url, { 
                    method: 'HEAD',
                    timeout: 5000 
                });
                
                if (response.ok) {
                    console.log(`✅ Available at: ${url}`);
                    
                    // For metadata, fetch and display content
                    if (type === 'metadata') {
                        const dataResponse = await fetch(url);
                        const data = await dataResponse.json();
                        console.log('\n📋 Metadata Content Preview:');
                        console.log('  Name:', data.name);
                        console.log('  Description:', data.description?.substring(0, 100) + '...');
                        console.log('  Image:', data.image);
                        console.log('  Case Number:', data.caseNumber);
                        console.log('  Agency:', data.issuingAgency);
                        console.log('  Portal URL:', data.portalUrl);
                        console.log('  Has Instructions:', !!data.instructions);
                    }
                    
                    // For images, check content type
                    if (type === 'alertImage') {
                        const headers = response.headers;
                        console.log('  Content-Type:', headers.get('content-type'));
                        console.log('  Size:', headers.get('content-length'), 'bytes');
                    }
                    
                    break; // Found on this gateway, move to next hash
                } else {
                    console.log(`❌ Not available (${response.status})`);
                }
            } catch (error) {
                console.log(`❌ Gateway timeout or error`);
            }
        }
    }
    
    console.log('\n\n📊 Summary:');
    console.log('─'.repeat(60));
    console.log('All IPFS data should be accessible via the URLs above.');
    console.log('The Alert NFT image should display in wallets.');
    console.log('The metadata provides instructions for accessing documents.');
    console.log('\n✨ To view in wallet: Import one of the recipient addresses');
    console.log('   and check the NFT collection. The image and metadata');
    console.log('   should be visible.\n');
}

// Check if fetch is available
if (!fetch) {
    console.log('Installing node-fetch...');
    const { execSync } = require('child_process');
    execSync('npm install node-fetch@2', { stdio: 'inherit' });
    console.log('Please run the script again.');
    process.exit(0);
}

verifyIPFS().catch(console.error);