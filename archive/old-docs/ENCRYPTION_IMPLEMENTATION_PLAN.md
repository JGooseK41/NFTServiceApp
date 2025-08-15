# Encryption Implementation Plan for Document Images

## Overview
To implement true encryption for document images where only the recipient can decrypt, we need to use the recipient's TRON wallet public key for encryption.

## Technical Requirements

### 1. Get Recipient's Public Key
TRON uses different key formats than Ethereum. We need to:

```javascript
// Option 1: Get from TronWeb if wallet is connected
const publicKey = await tronWeb.trx.getAccountResources(recipientAddress);

// Option 2: Derive from address (requires additional computation)
// TRON addresses are derived from public keys, but reverse calculation is not possible
// We need the recipient to have made at least one transaction
```

**Challenge:** TRON doesn't expose public keys directly like Ethereum. We need to:
- Check if recipient has transaction history
- Extract public key from a signed transaction
- OR implement a registry where users register their public keys

### 2. Encryption Library
Add a crypto library that supports ECDSA encryption:

```html
<!-- Add to index.html -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/eccrypto-js@5.0.0/dist/eccrypto-js.min.js"></script>
```

### 3. Encryption Process

```javascript
// Encrypt document with recipient's public key
async function encryptDocument(documentData, recipientAddress) {
    try {
        // 1. Get recipient's public key
        const publicKey = await getRecipientPublicKey(recipientAddress);
        
        if (!publicKey) {
            throw new Error('Recipient has no public key available');
        }
        
        // 2. Generate ephemeral key for this document
        const ephemeralKey = generateRandomKey();
        
        // 3. Encrypt document with ephemeral key (AES)
        const encryptedDoc = CryptoJS.AES.encrypt(
            documentData, 
            ephemeralKey
        ).toString();
        
        // 4. Encrypt ephemeral key with recipient's public key (ECDSA)
        const encryptedKey = await eccryptoJS.encrypt(
            publicKey,
            Buffer.from(ephemeralKey)
        );
        
        return {
            encryptedDocument: encryptedDoc,
            encryptedKey: encryptedKey.toString('base64')
        };
        
    } catch (error) {
        console.error('Encryption failed:', error);
        throw error;
    }
}
```

### 4. Decryption Process

```javascript
// Decrypt document after signing
async function decryptDocument(encryptedData, privateKey) {
    try {
        // 1. Decrypt the ephemeral key with wallet's private key
        const ephemeralKey = await eccryptoJS.decrypt(
            privateKey,
            Buffer.from(encryptedData.encryptedKey, 'base64')
        );
        
        // 2. Decrypt document with ephemeral key
        const decryptedDoc = CryptoJS.AES.decrypt(
            encryptedData.encryptedDocument,
            ephemeralKey.toString()
        ).toString(CryptoJS.enc.Utf8);
        
        return decryptedDoc;
        
    } catch (error) {
        console.error('Decryption failed:', error);
        throw error;
    }
}
```

## Implementation Steps

### Step 1: Public Key Registry (Fallback Solution)
Since TRON doesn't directly expose public keys, create a registry:

```solidity
// Add to contract
mapping(address => bytes) public publicKeyRegistry;

function registerPublicKey(bytes memory publicKey) external {
    publicKeyRegistry[msg.sender] = publicKey;
}
```

### Step 2: Update UI Flow

1. **When Creating Notice:**
   ```javascript
   // Check if recipient has registered public key
   const hasPublicKey = await checkRecipientPublicKey(recipientAddress);
   
   if (!hasPublicKey) {
       showWarning('Recipient needs to register their public key first');
       // Provide fallback: symmetric encryption with shared secret
   }
   ```

2. **First-Time Users:**
   - Prompt to register public key on first connection
   - Store in contract for future use

### Step 3: Modify Document Upload

```javascript
async function uploadEncryptedDocument() {
    // 1. Get document data
    const documentData = await getDocumentAsBase64();
    
    // 2. Encrypt with recipient's public key
    const encrypted = await encryptDocument(documentData, recipientAddress);
    
    // 3. Upload to IPFS
    const ipfsHash = await uploadToIPFS({
        encrypted: encrypted.encryptedDocument,
        metadata: {
            encrypted: true,
            keyFormat: 'ECDSA-SECP256K1'
        }
    });
    
    // 4. Store encrypted key on-chain or in metadata
    return {
        ipfsHash,
        encryptedKey: encrypted.encryptedKey
    };
}
```

### Step 4: Wallet Integration for Decryption

```javascript
// After recipient signs acceptance
async function handlePostSignature(noticeId) {
    try {
        // 1. Get encrypted document data
        const notice = await getNoticeDetails(noticeId);
        const encryptedData = await fetchFromIPFS(notice.ipfsHash);
        
        // 2. Request wallet to decrypt
        // Note: TronLink doesn't expose private keys directly
        // Need to implement message signing/decryption flow
        
        // 3. Alternative: Use deterministic key derivation
        const message = `Decrypt Notice ${noticeId}`;
        const signature = await tronWeb.trx.sign(message);
        const derivedKey = deriveKeyFromSignature(signature);
        
        // 4. Decrypt and display
        const decrypted = await decryptWithDerivedKey(
            encryptedData,
            derivedKey
        );
        
        displayDocument(decrypted);
        
    } catch (error) {
        showError('Failed to decrypt document');
    }
}
```

## Alternative Approach: Hybrid Encryption

If public key extraction proves too complex, use hybrid approach:

1. **Symmetric Encryption with Access Control:**
   ```javascript
   // Generate unique key per document
   const docKey = generateRandomKey();
   
   // Encrypt document
   const encrypted = encryptWithAES(document, docKey);
   
   // Store key encrypted with master key
   // Only reveal after signature
   ```

2. **Smart Contract Controls Access:**
   ```solidity
   // Only reveal decryption key after acceptance
   function getDecryptionKey(uint256 noticeId) 
       external 
       view 
       returns (string memory) 
   {
       require(notices[noticeId].accepted, "Not accepted");
       require(msg.sender == notices[noticeId].recipient, "Not recipient");
       return decryptionKeys[noticeId];
   }
   ```

## Libraries Needed

1. **crypto-js** - For AES encryption
2. **eccrypto-js** or **eth-crypto** - For public key encryption
3. **buffer** - For handling binary data

```bash
npm install crypto-js eccrypto-js buffer
```

Or via CDN:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/eccrypto-js@5.0.0/dist/eccrypto-js.min.js"></script>
<script src="https://bundle.run/buffer@6.0.3"></script>
```

## Security Considerations

1. **Key Management:**
   - Never expose private keys
   - Use secure key derivation
   - Implement key rotation

2. **Validation:**
   - Verify recipient address matches
   - Check signature validity
   - Validate decryption success

3. **Fallbacks:**
   - Handle missing public keys
   - Provide manual key entry option
   - Support legacy unencrypted notices

## Next Steps

1. Research TRON-specific public key extraction methods
2. Implement public key registry in smart contract
3. Add encryption libraries to project
4. Create encryption/decryption utilities
5. Update UI to handle encrypted documents
6. Test with real TronLink wallets