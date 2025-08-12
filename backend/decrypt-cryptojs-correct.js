/**
 * Correct CryptoJS Decryption Implementation
 */

const crypto = require('crypto');
const CryptoJS = require('crypto-js');

/**
 * Proper CryptoJS decryption using Node.js crypto
 */
function decryptCryptoJS(encryptedString, passphrase) {
    // CryptoJS format explanation:
    // "U2FsdGVkX1" is base64 for "Salted__" (first 8 bytes)
    // The full format is: base64("Salted__" + salt[8 bytes] + ciphertext)
    // So the encrypted string IS the complete base64, not "U2FsdGVkX1" + base64(data)
    
    // Decode the entire string as base64
    const encryptedData = Buffer.from(encryptedString, 'base64');
    
    // Verify it starts with "Salted__"
    const header = encryptedData.slice(0, 8).toString('utf8');
    if (header !== 'Salted__') {
        throw new Error(`Invalid CryptoJS format. Expected "Salted__", got "${header}"`);
    }
    
    // Extract salt and ciphertext
    const salt = encryptedData.slice(8, 16);
    const ciphertext = encryptedData.slice(16);
    
    // Derive key and IV using MD5 (OpenSSL's EVP_BytesToKey method)
    const keyAndIV = deriveKeyAndIV(passphrase, salt);
    
    // Decrypt using AES-256-CBC
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIV.key, keyAndIV.iv);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
}

/**
 * OpenSSL's EVP_BytesToKey implementation (used by CryptoJS)
 */
function deriveKeyAndIV(passphrase, salt) {
    const password = Buffer.from(passphrase, 'utf8');
    const keyLen = 32; // AES-256
    const ivLen = 16;  // AES block size
    
    let derivedBytes = Buffer.alloc(0);
    let currentBlock = Buffer.alloc(0);
    
    while (derivedBytes.length < keyLen + ivLen) {
        const hash = crypto.createHash('md5');
        hash.update(currentBlock);
        hash.update(password);
        if (salt) {
            hash.update(salt);
        }
        currentBlock = hash.digest();
        derivedBytes = Buffer.concat([derivedBytes, currentBlock]);
    }
    
    return {
        key: derivedBytes.slice(0, keyLen),
        iv: derivedBytes.slice(keyLen, keyLen + ivLen)
    };
}

// Test function
function testDecryption() {
    console.log('🧪 Testing Correct CryptoJS Decryption\n');
    console.log('='.repeat(50));
    
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
        'mysecretpassword', // Simple passphrase
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 char hex
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA256 hash
    ];
    
    let successCount = 0;
    
    for (const testKey of testKeys) {
        console.log(`\nTesting with key: ${testKey.substring(0, 20)}...`);
        console.log(`Key length: ${testKey.length} characters`);
        
        // Encrypt with CryptoJS
        const encrypted = CryptoJS.AES.encrypt(testData, testKey).toString();
        console.log(`Encrypted: ${encrypted.substring(0, 50)}...`);
        
        // Analyze the encrypted string
        const decoded = Buffer.from(encrypted, 'base64');
        console.log(`Decoded first 16 bytes (hex): ${decoded.slice(0, 16).toString('hex')}`);
        console.log(`Decoded first 8 bytes (string): "${decoded.slice(0, 8).toString('utf8')}"`);
        
        // Try to decrypt with our implementation
        try {
            const decrypted = decryptCryptoJS(encrypted, testKey);
            const parsed = JSON.parse(decrypted);
            console.log('✅ Decryption successful!');
            console.log('Decrypted keys:', Object.keys(parsed));
            
            // Verify it matches original
            if (decrypted === testData) {
                console.log('✅ Decrypted data matches original perfectly!');
                successCount++;
            }
            
            // Also verify with CryptoJS itself
            const cryptoJsDecrypted = CryptoJS.AES.decrypt(encrypted, testKey).toString(CryptoJS.enc.Utf8);
            if (cryptoJsDecrypted === decrypted) {
                console.log('✅ Our decryption matches CryptoJS decryption!');
            }
            
        } catch (error) {
            console.log('❌ Decryption failed:', error.message);
            
            // Try with CryptoJS to see if the issue is our implementation
            try {
                const cryptoJsDecrypted = CryptoJS.AES.decrypt(encrypted, testKey).toString(CryptoJS.enc.Utf8);
                console.log('📝 CryptoJS can decrypt it, our implementation has a bug');
                console.log('CryptoJS result preview:', cryptoJsDecrypted.substring(0, 100));
            } catch (e2) {
                console.log('❌ Even CryptoJS cannot decrypt it');
            }
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`Summary: ${successCount}/${testKeys.length} successful decryptions`);
    
    if (successCount === testKeys.length) {
        console.log('🎉 All tests passed! Decryption implementation is correct.');
        console.log('\n📝 Instructions for IPFS recovery:');
        console.log('1. The encryption key in the database should be used as the passphrase');
        console.log('2. Download the encrypted data from IPFS');
        console.log('3. Pass the entire IPFS data string to decryptCryptoJS()');
        console.log('4. The decrypted JSON will contain thumbnail and document data URLs');
    }
}

// Run test
testDecryption();

// Export for use in recovery script
module.exports = { decryptCryptoJS };