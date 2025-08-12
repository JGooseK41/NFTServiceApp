/**
 * Check IPFS Data Format
 * Quick script to see what format the IPFS data is in
 */

const https = require('https');

function downloadFromIPFS(ipfsHash) {
    return new Promise((resolve, reject) => {
        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        console.log(`Downloading from: ${url}\n`);
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function checkFormat() {
    // Check one of your IPFS hashes
    const ipfsHash = 'QmbUjYxHMS8kfVb57De54JxqayL7TBh8gpWcUmuCe6SHbj';
    
    const data = await downloadFromIPFS(ipfsHash);
    
    console.log('Data Analysis:');
    console.log('='.repeat(50));
    console.log('Length:', data.length, 'bytes');
    console.log('First 100 chars:', data.substring(0, 100));
    console.log('');
    
    // Check what format it is
    if (data.startsWith('U2FsdGVkX1')) {
        console.log('✅ This is CryptoJS encrypted format!');
        console.log('   It starts with "U2FsdGVkX1" which is base64 for "Salted__"');
        console.log('   This data needs to be decrypted with the encryption key');
        
        // Check if we can decode it
        try {
            const decoded = Buffer.from(data, 'base64');
            console.log('\nBase64 decode test:');
            console.log('- First 8 bytes (string):', decoded.slice(0, 8).toString('utf8'));
            console.log('- First 16 bytes (hex):', decoded.slice(0, 16).toString('hex'));
        } catch (e) {
            console.log('Error decoding base64:', e.message);
        }
    } else if (data.startsWith('data:')) {
        console.log('This is a raw data URL (unencrypted)');
    } else if (data.startsWith('{')) {
        console.log('This is JSON data');
        try {
            const parsed = JSON.parse(data);
            console.log('JSON keys:', Object.keys(parsed));
        } catch (e) {
            console.log('Invalid JSON');
        }
    } else {
        console.log('❓ Unknown format');
        console.log('Last 100 chars:', data.substring(data.length - 100));
    }
}

checkFormat().catch(console.error);