/**
 * BlockServed Mobile Integration
 * Connects the mobile interface with the actual smart contract
 */

window.BlockServedMobile = {
    CONTRACT_ADDRESS: 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN', // v5 Enumerable mainnet
    contract: null,
    userAddress: null,
    
    /**
     * Initialize the mobile integration
     */
    async init() {
        console.log('📱 Initializing BlockServed Mobile Integration...');
        
        // Wait for TronLink
        if (!window.tronWeb || !window.tronWeb.ready) {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        // Load contract ABI (simplified for mobile)
        const ABI = [
            {
                "inputs": [{"internalType": "address", "name": "", "type": "address"}, {"internalType": "uint256", "name": "", "type": "uint256"}],
                "name": "recipientAlerts",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "name": "alertNotices",
                "outputs": [
                    {"internalType": "address", "name": "recipient", "type": "address"},
                    {"internalType": "address", "name": "sender", "type": "address"},
                    {"internalType": "uint256", "name": "documentId", "type": "uint256"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "bool", "name": "acknowledged", "type": "bool"},
                    {"internalType": "string", "name": "issuingAgency", "type": "string"},
                    {"internalType": "string", "name": "noticeType", "type": "string"},
                    {"internalType": "string", "name": "caseNumber", "type": "string"},
                    {"internalType": "string", "name": "caseDetails", "type": "string"},
                    {"internalType": "string", "name": "legalRights", "type": "string"},
                    {"internalType": "uint256", "name": "responseDeadline", "type": "uint256"},
                    {"internalType": "string", "name": "previewImage", "type": "string"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "name": "documentNotices",
                "outputs": [
                    {"internalType": "string", "name": "encryptedIPFS", "type": "string"},
                    {"internalType": "string", "name": "decryptionKey", "type": "string"},
                    {"internalType": "address", "name": "authorizedViewer", "type": "address"},
                    {"internalType": "uint256", "name": "alertId", "type": "uint256"},
                    {"internalType": "bool", "name": "isRestricted", "type": "bool"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "noticeId", "type": "uint256"}],
                "name": "acceptNotice",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {"internalType": "uint256", "name": "index", "type": "uint256"}],
                "name": "tokenOfOwnerByIndex",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ];
        
        try {
            this.contract = await tronWeb.contract(ABI, this.CONTRACT_ADDRESS);
            console.log('✅ Contract loaded successfully');
        } catch (error) {
            console.error('Failed to load contract:', error);
        }
    },
    
    /**
     * Get all notices for the connected wallet
     */
    async getRecipientNotices(address) {
        if (!this.contract) {
            console.error('Contract not initialized');
            return [];
        }
        
        const notices = [];
        
        try {
            // Method 1: Try using recipientAlerts mapping
            let alertIndex = 0;
            while (true) {
                try {
                    const alertId = await this.contract.recipientAlerts(address, alertIndex).call();
                    if (!alertId || alertId.toString() === '0') break;
                    
                    const alertData = await this.contract.alertNotices(alertId).call();
                    const documentData = await this.contract.documentNotices(alertData.documentId).call();
                    
                    notices.push({
                        id: alertId.toString(),
                        alertId: alertId.toString(),
                        documentId: alertData.documentId.toString(),
                        type: alertData.noticeType,
                        caseNumber: alertData.caseNumber,
                        agency: alertData.issuingAgency,
                        sender: alertData.sender,
                        timestamp: parseInt(alertData.timestamp) * 1000,
                        acknowledged: alertData.acknowledged,
                        caseDetails: alertData.caseDetails,
                        legalRights: alertData.legalRights,
                        deadline: parseInt(alertData.responseDeadline) * 1000,
                        hasDocument: documentData.encryptedIPFS && documentData.encryptedIPFS.length > 0,
                        encryptedIPFS: documentData.encryptedIPFS,
                        decryptionKey: documentData.decryptionKey,
                        previewImage: alertData.previewImage
                    });
                    
                    alertIndex++;
                } catch (error) {
                    break;
                }
            }
            
            // Method 2: If no notices found, try tokenOfOwnerByIndex (for TRC721 Enumerable)
            if (notices.length === 0) {
                const balance = await this.contract.balanceOf(address).call();
                const tokenCount = parseInt(balance);
                
                for (let i = 0; i < tokenCount && i < 20; i++) { // Limit to 20 for performance
                    try {
                        const tokenId = await this.contract.tokenOfOwnerByIndex(address, i).call();
                        const alertData = await this.contract.alertNotices(tokenId).call();
                        
                        // Check if this is actually an alert (recipient matches)
                        if (alertData.recipient === address) {
                            const documentData = await this.contract.documentNotices(alertData.documentId).call();
                            
                            notices.push({
                                id: tokenId.toString(),
                                alertId: tokenId.toString(),
                                documentId: alertData.documentId.toString(),
                                type: alertData.noticeType || 'Legal Notice',
                                caseNumber: alertData.caseNumber || 'N/A',
                                agency: alertData.issuingAgency || 'Unknown',
                                sender: alertData.sender,
                                timestamp: parseInt(alertData.timestamp) * 1000,
                                acknowledged: alertData.acknowledged,
                                caseDetails: alertData.caseDetails,
                                legalRights: alertData.legalRights,
                                deadline: parseInt(alertData.responseDeadline) * 1000,
                                hasDocument: documentData.encryptedIPFS && documentData.encryptedIPFS.length > 0,
                                encryptedIPFS: documentData.encryptedIPFS,
                                decryptionKey: documentData.decryptionKey,
                                previewImage: alertData.previewImage
                            });
                        }
                    } catch (error) {
                        console.log(`Error fetching token ${i}:`, error);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error fetching notices:', error);
        }
        
        // Sort by timestamp (newest first)
        notices.sort((a, b) => b.timestamp - a.timestamp);
        
        return notices;
    },
    
    /**
     * Sign/Accept a notice
     */
    async signNotice(noticeId) {
        if (!this.contract) {
            throw new Error('Contract not initialized');
        }
        
        try {
            const tx = await this.contract.acceptNotice(noticeId).send({
                feeLimit: 100_000_000, // 100 TRX
                callValue: 0,
                shouldPollResponse: true
            });
            
            console.log('✅ Notice signed successfully:', tx);
            return {
                success: true,
                txHash: tx,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error signing notice:', error);
            throw error;
        }
    },
    
    /**
     * Decrypt and display document
     */
    async decryptDocument(encryptedIPFS, decryptionKey) {
        try {
            // If it's a direct data URL, return it
            if (encryptedIPFS.startsWith('data:')) {
                return encryptedIPFS;
            }
            
            // If it's an IPFS hash, fetch from gateway
            if (encryptedIPFS.startsWith('Qm') || encryptedIPFS.startsWith('bafy')) {
                const gateways = [
                    `https://ipfs.io/ipfs/${encryptedIPFS}`,
                    `https://gateway.pinata.cloud/ipfs/${encryptedIPFS}`,
                    `https://cloudflare-ipfs.com/ipfs/${encryptedIPFS}`
                ];
                
                for (const gateway of gateways) {
                    try {
                        const response = await fetch(gateway);
                        if (response.ok) {
                            const data = await response.text();
                            
                            // If there's a decryption key, decrypt the content
                            if (decryptionKey && decryptionKey !== '') {
                                return await this.decryptContent(data, decryptionKey);
                            }
                            
                            return data;
                        }
                    } catch (error) {
                        console.log(`Gateway ${gateway} failed:`, error);
                    }
                }
            }
            
            // If it's encrypted base64, decrypt it
            if (decryptionKey && decryptionKey !== '') {
                return await this.decryptContent(encryptedIPFS, decryptionKey);
            }
            
            return encryptedIPFS;
            
        } catch (error) {
            console.error('Error decrypting document:', error);
            throw error;
        }
    },
    
    /**
     * Decrypt content using the provided key
     */
    async decryptContent(encryptedData, key) {
        try {
            // Simple XOR decryption for demo (in production, use proper encryption)
            // This assumes the encrypted data is base64 encoded
            const encrypted = atob(encryptedData);
            let decrypted = '';
            
            for (let i = 0; i < encrypted.length; i++) {
                decrypted += String.fromCharCode(
                    encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            
            return decrypted;
            
        } catch (error) {
            console.error('Decryption failed:', error);
            // Return original if decryption fails
            return encryptedData;
        }
    },
    
    /**
     * Generate certificate for signed notice
     */
    generateCertificate(notice, txHash) {
        const certificate = {
            title: 'CERTIFICATE OF SERVICE ACKNOWLEDGMENT',
            recipient: tronWeb.defaultAddress.base58,
            documentType: notice.type,
            caseNumber: notice.caseNumber,
            agency: notice.agency,
            dateServed: new Date(notice.timestamp).toLocaleString(),
            dateSigned: new Date().toLocaleString(),
            transactionHash: txHash,
            blockchainNetwork: 'TRON Mainnet',
            contractAddress: this.CONTRACT_ADDRESS,
            noticeId: notice.id,
            verificationUrl: `https://tronscan.org/#/transaction/${txHash}`
        };
        
        return certificate;
    },
    
    /**
     * Format notice for mobile display
     */
    formatNoticeForMobile(notice) {
        const now = Date.now();
        const deadline = notice.deadline || (notice.timestamp + 30 * 24 * 60 * 60 * 1000); // 30 days default
        const daysRemaining = Math.floor((deadline - now) / (24 * 60 * 60 * 1000));
        
        return {
            ...notice,
            status: notice.acknowledged ? 'signed' : 'pending',
            urgent: daysRemaining <= 7 && !notice.acknowledged,
            formattedDate: new Date(notice.timestamp).toLocaleDateString(),
            formattedDeadline: new Date(deadline).toLocaleDateString(),
            daysRemaining: daysRemaining,
            displayType: notice.type || 'Legal Notice',
            displayAgency: notice.agency || 'Process Server',
            displayCaseNumber: notice.caseNumber || `Notice #${notice.id}`
        };
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        BlockServedMobile.init();
    });
} else {
    BlockServedMobile.init();
}

console.log('✅ BlockServed Mobile Integration loaded');