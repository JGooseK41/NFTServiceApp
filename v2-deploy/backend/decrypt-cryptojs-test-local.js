/**
 * Test CryptoJS Decryption Locally
 * This version tests decryption without database dependency
 */

const crypto = require('crypto');

/**
 * CryptoJS-compatible decryption
 */
function decryptCryptoJS(encryptedString, passphrase) {
    if (!encryptedString.startsWith('U2FsdGVkX1')) {
        throw new Error('Not a CryptoJS encrypted string');
    }
    
    // Decode the base64 part after "U2FsdGVkX1"
    const encryptedData = Buffer.from(encryptedString.substring(10), 'base64');
    
    // The base64 decoded data should start with "Salted__" (8 bytes) followed by 8 bytes of salt
    // However, let's check what we actually have
    const first8Bytes = encryptedData.slice(0, 8);
    const first8AsString = first8Bytes.toString('utf8');
    const first8AsHex = first8Bytes.toString('hex');
    
    console.log(`  First 8 bytes as string: "${first8AsString}"`);
    console.log(`  First 8 bytes as hex: ${first8AsHex}`);
    
    // CryptoJS always adds "Salted__" but let's handle both cases
    if (first8AsString === 'Salted__') {
        console.log('  Found Salted__ header (standard format)');
        const salt = encryptedData.slice(8, 16);
        const ciphertext = encryptedData.slice(16);
        
        // Derive key and IV using MD5 (OpenSSL's EVP_BytesToKey)
        const keyAndIV = deriveKeyAndIV(passphrase, salt);
        
        // Decrypt using AES-256-CBC
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIV.key, keyAndIV.iv);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8');
    } else {
        // No "Salted__" header - might be raw salt + ciphertext
        console.log('  No Salted__ header, treating as raw salt + ciphertext');
        const salt = encryptedData.slice(0, 8);
        const ciphertext = encryptedData.slice(8);
        
        // Derive key and IV
        const keyAndIV = deriveKeyAndIV(passphrase, salt);
        
        // Decrypt
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIV.key, keyAndIV.iv);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8');
    }
}

/**
 * OpenSSL's EVP_BytesToKey implementation
 */
function deriveKeyAndIV(passphrase, salt) {
    const password = Buffer.from(passphrase, 'utf8');
    const keyLen = 32; // AES-256
    const ivLen = 16;  // AES block size
    
    const derivedBytes = [];
    let data = Buffer.concat([password, salt]);
    
    while (derivedBytes.length < keyLen + ivLen) {
        const hash = crypto.createHash('md5');
        hash.update(data);
        const digest = hash.digest();
        derivedBytes.push(digest);
        data = Buffer.concat([digest, password, salt]);
    }
    
    const result = Buffer.concat(derivedBytes);
    return {
        key: result.slice(0, keyLen),
        iv: result.slice(keyLen, keyLen + ivLen)
    };
}

// Test with a known example
function testWithExample() {
    console.log('🧪 Testing CryptoJS Decryption with Example Data\n');
    console.log('='.repeat(50));
    
    // Create a test case similar to what the frontend might produce
    const CryptoJS = require('crypto-js');
    
    // Test data
    const testData = JSON.stringify({
        thumbnail: 'data:image/png;base64,TEST_THUMBNAIL_DATA',
        document: 'data:image/png;base64,TEST_DOCUMENT_DATA',
        metadata: {
            caseNumber: 'TEST-001',
            timestamp: new Date().toISOString()
        }
    });
    
    // Test with different key formats
    const testKeys = [
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 char hex
        'mysecretpassword', // Simple passphrase
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA256 hash
    ];
    
    for (const testKey of testKeys) {
        console.log(`\nTesting with key: ${testKey.substring(0, 20)}...`);
        console.log(`Key length: ${testKey.length} characters`);
        
        // Encrypt with CryptoJS
        const encrypted = CryptoJS.AES.encrypt(testData, testKey).toString();
        console.log(`Encrypted: ${encrypted.substring(0, 50)}...`);
        console.log(`Starts with U2FsdGVkX1: ${encrypted.startsWith('U2FsdGVkX1')}`);
        
        // Try to decrypt with our implementation
        try {
            const decrypted = decryptCryptoJS(encrypted, testKey);
            const parsed = JSON.parse(decrypted);
            console.log('✅ Decryption successful!');
            console.log('Decrypted keys:', Object.keys(parsed));
            
            // Verify it matches original
            if (decrypted === testData) {
                console.log('✅ Decrypted data matches original perfectly!');
            }
        } catch (error) {
            console.log('❌ Decryption failed:', error.message);
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📝 Key insights:');
    console.log('1. CryptoJS.AES.encrypt() uses the passphrase directly');
    console.log('2. It derives the actual AES key using MD5-based KDF');
    console.log('3. The format is always: U2FsdGVkX1 + base64(salt + ciphertext)');
}

// Check if crypto-js is installed
try {
    require.resolve('crypto-js');
    testWithExample();
} catch (e) {
    console.log('crypto-js not installed. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install crypto-js', { stdio: 'inherit' });
    testWithExample();
}