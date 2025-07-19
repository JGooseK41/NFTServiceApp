// Decryption Helper for Process Server Registrations
// Usage: node decrypt.js <encrypted-file>

const CryptoJS = require('crypto-js');
const fs = require('fs');

const ENCRYPTION_KEY = 'NFTServiceApp-ProcessServer-1752936246200';

if (process.argv.length < 3) {
    console.log('Usage: node decrypt.js <encrypted-file>');
    process.exit(1);
}

try {
    const encryptedData = fs.readFileSync(process.argv[2], 'utf8');
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedData = decrypted.toString(CryptoJS.enc.Utf8);
    
    const registration = JSON.parse(decryptedData);
    console.log('Decrypted Registration:', registration);
    
    // Save decrypted file
    const outputFile = process.argv[2].replace('.enc', '.json');
    fs.writeFileSync(outputFile, JSON.stringify(registration, null, 2));
    console.log('Decrypted data saved to:', outputFile);
} catch (error) {
    console.error('Decryption error:', error.message);
}