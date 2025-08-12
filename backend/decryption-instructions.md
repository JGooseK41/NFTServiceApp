
# Document Decryption Instructions

## ⚠️ Important Security Notice
Your legal documents have been encrypted for security. Keep your decryption key safe and confidential.

## Your Decryption Information
- **IPFS Hash:** `[YOUR_IPFS_HASH]`
- **Decryption Key:** `[YOUR_DECRYPTION_KEY]`

## Method 1: Using Node.js

### Step 1: Install Dependencies
```bash
npm install crypto-js
```

### Step 2: Download Encrypted Data
```bash
curl https://gateway.pinata.cloud/ipfs/[YOUR_IPFS_HASH] > encrypted.txt
```

### Step 3: Create Decryption Script
Save this as `decrypt.js`:

```javascript
const CryptoJS = require('crypto-js');
const fs = require('fs');

const encryptedData = fs.readFileSync('encrypted.txt', 'utf8');
const decryptionKey = '[YOUR_DECRYPTION_KEY]';

const decrypted = CryptoJS.AES.decrypt(encryptedData, decryptionKey);
const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
const data = JSON.parse(decryptedText);

// Save thumbnail
if (data.thumbnail) {
    const thumbnailData = data.thumbnail.split(',')[1];
    fs.writeFileSync('thumbnail.png', Buffer.from(thumbnailData, 'base64'));
    console.log('Thumbnail saved as thumbnail.png');
}

// Save document
if (data.document) {
    const documentData = data.document.split(',')[1];
    fs.writeFileSync('document.png', Buffer.from(documentData, 'base64'));
    console.log('Document saved as document.png');
}
```

### Step 4: Run the Script
```bash
node decrypt.js
```

## Alternative IPFS Gateways
If the primary gateway is unavailable, try these alternatives:
- https://ipfs.io/ipfs/[YOUR_IPFS_HASH]
- https://cloudflare-ipfs.com/ipfs/[YOUR_IPFS_HASH]
- https://gateway.ipfs.io/ipfs/[YOUR_IPFS_HASH]

## Security Best Practices
- ✅ Keep your decryption key in a secure location
- ✅ Never share your decryption key via email
- ✅ Verify the IPFS hash matches what was provided
- ✅ Delete decrypted files after viewing if sensitive
- ✅ Use a secure, malware-free computer

## Need Help?
If you're having trouble:
1. Verify you have the correct IPFS hash and key
2. Ensure you're copying the entire encrypted string
3. Try a different IPFS gateway if one isn't working
4. Contact your legal representative for assistance
