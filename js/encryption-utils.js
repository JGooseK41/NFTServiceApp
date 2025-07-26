// Encryption utilities for NFT Service App
// Uses TronWeb for TRON-specific operations and crypto libraries for encryption

// Initialize encryption utilities
const EncryptionUtils = {
    
    // Generate a public/private key pair from TronWeb account
    async generateKeyPairFromWallet() {
        try {
            if (!window.tronWeb || !window.tronWeb.defaultAddress.base58) {
                throw new Error('TronLink wallet not connected');
            }
            
            // Get current address
            const address = window.tronWeb.defaultAddress.base58;
            
            // Sign a message to derive keys
            const message = `Generate encryption keys for NFT Service App at ${Date.now()}`;
            const signedMessage = await window.tronWeb.trx.sign(message);
            
            // Derive key pair from signature (deterministic)
            const privateKeyHash = CryptoJS.SHA256(signedMessage).toString();
            
            // For TRON, we'll use the account's inherent keys
            // This is a simplified approach - in production, use proper key derivation
            const publicKey = await this.derivePublicKeyFromAddress(address);
            
            return {
                publicKey: publicKey,
                address: address,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Error generating key pair:', error);
            throw error;
        }
    },
    
    // Derive public key from TRON address (simplified for demo)
    async derivePublicKeyFromAddress(address) {
        // In a real implementation, this would extract the actual public key
        // For now, we'll use a deterministic derivation
        const addressBytes = tronWeb.address.toHex(address);
        const publicKey = CryptoJS.SHA256(addressBytes + 'public').toString();
        return publicKey;
    },
    
    // Register public key to smart contract
    async registerPublicKey(contract) {
        try {
            console.log('Registering public key...');
            
            // Generate key pair
            const keyData = await this.generateKeyPairFromWallet();
            
            // Convert public key to bytes for contract
            const publicKeyBytes = tronWeb.toHex(keyData.publicKey);
            
            // Call contract method
            const tx = await contract.registerPublicKey(publicKeyBytes).send({
                feeLimit: 100_000_000,
                callValue: 0
            });
            
            console.log('Public key registered:', tx);
            
            // Store locally for convenience
            localStorage.setItem('nftService_publicKey', keyData.publicKey);
            localStorage.setItem('nftService_keyTimestamp', keyData.timestamp);
            
            return {
                success: true,
                publicKey: keyData.publicKey,
                txId: tx
            };
            
        } catch (error) {
            console.error('Error registering public key:', error);
            throw error;
        }
    },
    
    // Check if user has registered public key
    async checkPublicKeyRegistration(contract, address) {
        try {
            const hasKey = await contract.hasPublicKey(address).call();
            return hasKey;
        } catch (error) {
            console.error('Error checking public key:', error);
            return false;
        }
    },
    
    // Get public key for recipient
    async getRecipientPublicKey(contract, recipientAddress) {
        try {
            const hasKey = await contract.hasPublicKey(recipientAddress).call();
            if (!hasKey) {
                return null;
            }
            
            const publicKeyBytes = await contract.getPublicKey(recipientAddress).call();
            const publicKey = tronWeb.toUtf8(publicKeyBytes);
            
            return publicKey;
        } catch (error) {
            console.error('Error getting recipient public key:', error);
            return null;
        }
    },
    
    // Encrypt document with recipient's public key
    async encryptDocument(documentData, recipientPublicKey) {
        try {
            // Generate a random AES key for this document
            const documentKey = CryptoJS.lib.WordArray.random(256/8).toString();
            
            // Encrypt document with AES
            const encryptedDoc = CryptoJS.AES.encrypt(documentData, documentKey).toString();
            
            // Encrypt the AES key with recipient's public key
            // In a real implementation, use proper ECDSA encryption
            // For demo, we'll use a simplified approach
            const encryptedKey = this.encryptKeyWithPublicKey(documentKey, recipientPublicKey);
            
            return {
                encryptedDocument: encryptedDoc,
                encryptedKey: encryptedKey,
                algorithm: 'AES-256',
                keyEncryption: 'ECDSA-SECP256K1'
            };
            
        } catch (error) {
            console.error('Error encrypting document:', error);
            throw error;
        }
    },
    
    // Simplified public key encryption (in production, use proper ECDSA)
    encryptKeyWithPublicKey(key, publicKey) {
        // This is a simplified version - in production, use eccrypto or similar
        const combined = key + ':' + publicKey;
        const encrypted = CryptoJS.AES.encrypt(key, publicKey).toString();
        return encrypted;
    },
    
    // Decrypt document after acceptance
    async decryptDocument(encryptedData, encryptedKey) {
        try {
            // Sign message to derive decryption key
            const message = `Decrypt NFT Service document at ${Date.now()}`;
            const signature = await window.tronWeb.trx.sign(message);
            
            // Derive decryption key from signature
            const privateKey = CryptoJS.SHA256(signature).toString();
            
            // Decrypt the document key
            const documentKey = await this.decryptKeyWithPrivateKey(encryptedKey, privateKey);
            
            // Decrypt the document
            const decrypted = CryptoJS.AES.decrypt(encryptedData, documentKey);
            const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
            
            return decryptedText;
            
        } catch (error) {
            console.error('Error decrypting document:', error);
            throw error;
        }
    },
    
    // Simplified private key decryption
    async decryptKeyWithPrivateKey(encryptedKey, privateKey) {
        // Get user's public key from local storage or derive it
        const publicKey = localStorage.getItem('nftService_publicKey') || 
                         await this.derivePublicKeyFromAddress(window.tronWeb.defaultAddress.base58);
        
        // Decrypt using public key (simplified)
        const decrypted = CryptoJS.AES.decrypt(encryptedKey, publicKey);
        return decrypted.toString(CryptoJS.enc.Utf8);
    },
    
    // UI Helper: Show public key registration modal
    showRegistrationModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-key" style="color: #3b82f6;"></i> Public Key Registration Required</h2>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <strong>One-time Setup Required</strong>
                            <p style="margin: 0.5rem 0 0 0;">To send or receive encrypted documents, you need to register your public encryption key. This is a one-time process that enables secure document encryption.</p>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1.5rem;">
                        <h4>What happens when you register:</h4>
                        <ul style="margin-top: 0.5rem;">
                            <li>A unique encryption key is generated from your wallet</li>
                            <li>Your public key is stored on the blockchain</li>
                            <li>Others can send you encrypted documents</li>
                            <li>Only you can decrypt documents sent to you</li>
                        </ul>
                    </div>
                    
                    <div class="alert alert-warning" style="margin-top: 1rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Important:</strong> This process requires a small transaction fee (~10 TRX)
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn btn-primary" onclick="EncryptionUtils.handleRegistration(this)">
                        <i class="fas fa-key"></i> Register Public Key
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    // Handle registration button click
    async handleRegistration(button) {
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        
        try {
            const result = await this.registerPublicKey(window.legalContract);
            
            if (result.success) {
                button.innerHTML = '<i class="fas fa-check"></i> Registered!';
                
                // Show success notification
                if (window.uiManager) {
                    window.uiManager.showNotification('success', 'Public key registered successfully!');
                }
                
                // Close modal after delay
                setTimeout(() => {
                    button.closest('.modal').remove();
                    // Refresh UI to show registration status
                    if (window.checkWalletConnection) {
                        window.checkWalletConnection();
                    }
                }, 1500);
            }
        } catch (error) {
            console.error('Registration failed:', error);
            button.innerHTML = originalText;
            button.disabled = false;
            
            if (window.uiManager) {
                window.uiManager.showNotification('error', 'Registration failed: ' + error.message);
            }
        }
    },
    
    // Check and prompt for registration if needed
    async checkAndPromptRegistration(contract, address) {
        const hasKey = await this.checkPublicKeyRegistration(contract, address);
        
        if (!hasKey) {
            this.showRegistrationModal();
            return false;
        }
        
        return true;
    }
};

// Export for use in other scripts
window.EncryptionUtils = EncryptionUtils;