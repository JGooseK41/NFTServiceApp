// Contract Module - Handles all smart contract interactions
window.contract = {
    instance: null,
    tronWeb: null,
    address: null,
    abi: null,
    
    // Initialize contract module
    async init() {
        console.log('Initializing contract module...');
        
        // Load ABI from existing app
        await this.loadABI();
    },
    
    // Load contract ABI
    async loadABI() {
        try {
            // Determine base path based on current location
            const basePath = window.location.pathname.includes('/v2/') ? '' : 'v2/';
            
            // Try loading v5 Enumerable contract ABI
            const response = await fetch(basePath + 'js/v5-contract-abi.json');
            if (response.ok) {
                this.abi = await response.json();
                console.log('V5 Enumerable Contract ABI loaded');
                console.log('Contract methods available:', this.abi.filter(item => item.type === 'function').map(f => f.name));
            } else {
                throw new Error('Failed to fetch ABI');
            }
        } catch (error) {
            console.error('Failed to load ABI:', error);
            // Fallback to inline ABI if file loading fails
            try {
                // Try the parent directory's complete ABI
                const response = await fetch('../js/complete-contract-abi.js');
                if (response.ok) {
                    const scriptText = await response.text();
                    eval(scriptText); // Load the script content
                    if (window.CONTRACT_ABI) {
                        this.abi = window.CONTRACT_ABI;
                        console.log('Parent directory ABI loaded');
                    }
                }
            } catch (fallbackError) {
                console.error('All ABI loading methods failed:', fallbackError);
                // As last resort, we could embed a minimal ABI here
                console.error('Please run a local web server to load the ABI properly');
            }
        }
    },
    
    // Initialize contract with wallet
    async initialize(tronWeb) {
        if (!tronWeb) {
            throw new Error('TronWeb not provided');
        }
        
        this.tronWeb = tronWeb;
        this.address = getCurrentNetwork().contractAddress;
        
        if (!this.abi) {
            await this.loadABI();
        }
        
        try {
            // Create contract instance
            this.instance = await this.tronWeb.contract(this.abi, this.address);
            console.log('Contract initialized at:', this.address);
            
            // Get contract owner for admin check
            await this.checkAdminRole();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize contract:', error);
            throw error;
        }
    },
    
    // Check if current user has admin role
    async checkAdminRole() {
        try {
            const userAddress = this.tronWeb.defaultAddress.base58;
            const adminRole = getConfig('contract.roles.DEFAULT_ADMIN_ROLE');
            
            const hasRole = await this.instance.hasRole(adminRole, userAddress).call();
            console.log('User has admin role:', hasRole);
            
            return hasRole;
        } catch (error) {
            console.error('Failed to check admin role:', error);
            return false;
        }
    },
    
    // ====================
    // ADMIN FUNCTIONS
    // ====================
    
    // Update service fee
    async updateServiceFee(newFee) {
        try {
            const feeInSun = this.tronWeb.toSun(newFee);
            const tx = await this.instance.updateCreationFee(feeInSun).send();
            console.log('Service fee updated:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to update service fee:', error);
            throw error;
        }
    },
    
    // Update sponsorship fee
    async updateSponsorshipFee(newFee) {
        try {
            const feeInSun = this.tronWeb.toSun(newFee);
            const tx = await this.instance.updateSponsorshipFee(feeInSun).send();
            console.log('Sponsorship fee updated:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to update sponsorship fee:', error);
            throw error;
        }
    },
    
    // Grant role to address
    async grantRole(role, address) {
        try {
            const tx = await this.instance.grantRole(role, address).send();
            console.log('Role granted:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to grant role:', error);
            throw error;
        }
    },
    
    // Revoke role from address
    async revokeRole(role, address) {
        try {
            const tx = await this.instance.revokeRole(role, address).send();
            console.log('Role revoked:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to revoke role:', error);
            throw error;
        }
    },
    
    // Update fee collector address
    async updateFeeCollector(newAddress) {
        try {
            const tx = await this.instance.updateFeeCollector(newAddress).send();
            console.log('Fee collector updated:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to update fee collector:', error);
            throw error;
        }
    },
    
    // ====================
    // NOTICE FUNCTIONS
    // ====================
    
    // Create Alert NFT with embedded metadata (v5 contract)
    async createAlertNFT(data) {
        try {
            // Prepare metadata with Base64 image and access info
            const metadata = {
                name: `Legal Notice - ${data.caseNumber}`,
                description: data.noticeText,
                image: data.thumbnail, // Base64 data URI of first page
                external_url: `https://blockserved.com/notice/${data.noticeId}`,
                attributes: [
                    { trait_type: "Type", value: "Alert Notice" },
                    { trait_type: "Case Number", value: data.caseNumber },
                    { trait_type: "Server ID", value: data.serverId },
                    { trait_type: "Timestamp", value: new Date().toISOString() },
                    { trait_type: "Status", value: "Delivered" },
                    { trait_type: "Document Access", value: data.encrypted ? "Encrypted" : "Public" }
                ],
                // Critical info for recipient
                access_info: {
                    portal: "https://blockserved.com",
                    notice_id: data.noticeId,
                    encrypted: data.encrypted,
                    ipfs_hash: data.ipfsHash,
                    instructions: "Visit blockserved.com and enter your wallet address to view and sign this document"
                }
            };
            
            // Convert metadata to Base64 data URI
            const metadataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            
            // Calculate fees
            const creationFee = await this.instance.creationFee().call();
            const sponsorshipFee = data.sponsorFees ? await this.instance.sponsorshipFee().call() : 0;
            const totalFee = parseInt(creationFee) + parseInt(sponsorshipFee);
            
            // Use v5 serveNotice function
            const tx = await this.instance.serveNotice(
                data.recipient,                    // recipient address
                data.ipfsHash || '',               // encryptedIPFS
                data.encryptionKey || '',          // encryptionKey
                data.agency || 'Legal Services',   // issuingAgency
                'alert',                           // noticeType
                data.caseNumber,                   // caseNumber
                data.caseDetails || data.noticeText, // caseDetails
                data.legalRights || 'You have the right to respond within the specified deadline', // legalRights
                data.sponsorFees || false,         // sponsorFees
                metadataUri                        // metadataURI with embedded Base64 image
            ).send({
                feeLimit: 150000000,  // 150 TRX fee limit
                callValue: totalFee,  // Send the required fees
                shouldPollResponse: true
            });
            
            console.log('Alert NFT created with v5 contract:', tx);
            return { success: true, txId: tx, metadata };
            
        } catch (error) {
            console.error('Failed to create Alert NFT:', error);
            throw error;
        }
    },
    
    // Create batch notices for multiple recipients (v5 contract)
    async createBatchNotices(data) {
        try {
            console.log('Creating batch notices for recipients:', data.recipients);
            
            // Prepare metadata
            const metadata = {
                name: `Legal Notice Batch - ${data.caseNumber}`,
                description: data.noticeText,
                image: data.thumbnail,
                external_url: `https://blockserved.com/notice/${data.noticeId}`,
                attributes: [
                    { trait_type: "Type", value: "Batch Notice" },
                    { trait_type: "Recipients", value: data.recipients.length },
                    { trait_type: "Case Number", value: data.caseNumber },
                    { trait_type: "Timestamp", value: new Date().toISOString() }
                ],
                access_info: {
                    portal: "https://blockserved.com",
                    notice_id: data.noticeId,
                    encrypted: data.encrypted,
                    ipfs_hash: data.ipfsHash
                }
            };
            
            const metadataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            
            // Build batch notice array for contract
            const batchNotices = data.recipients.map(recipient => ({
                recipient: recipient,
                encryptedIPFS: data.ipfsHash || '',
                encryptionKey: data.encryptionKey || '',
                issuingAgency: data.agency || 'Legal Services',
                noticeType: 'batch',
                caseNumber: data.caseNumber,
                caseDetails: data.noticeText,
                legalRights: data.legalRights || 'You have the right to respond',
                sponsorFees: data.sponsorFees || false,
                metadataURI: metadataUri
            }));
            
            // Calculate total fees
            const creationFee = await this.instance.creationFee().call();
            const totalFee = parseInt(creationFee) * data.recipients.length * 2; // x2 for Alert + Document
            
            // Call batch function
            const tx = await this.instance.serveNoticeBatch(batchNotices).send({
                feeLimit: 300000000, // Higher limit for batch
                callValue: totalFee,
                shouldPollResponse: true
            });
            
            console.log('Batch notices created:', tx);
            return {
                success: true,
                txId: tx,
                alertTx: tx, // For compatibility
                documentTx: tx,
                recipientCount: data.recipients.length,
                metadata
            };
            
        } catch (error) {
            console.error('Failed to create batch notices:', error);
            throw error;
        }
    },
    
    // Create Document NFT (for signature) - v5 contract
    async createDocumentNFT(data) {
        try {
            const metadata = {
                name: `Legal Document - ${data.caseNumber}`,
                description: data.noticeText,
                image: data.thumbnail, // Base64 preview
                external_url: `https://blockserved.com/document/${data.noticeId}`,
                document_url: data.ipfsHash ? `ipfs://${data.ipfsHash}` : '',
                attributes: [
                    { trait_type: "Type", value: "Document for Signature" },
                    { trait_type: "Case Number", value: data.caseNumber },
                    { trait_type: "Server ID", value: data.serverId },
                    { trait_type: "Timestamp", value: new Date().toISOString() },
                    { trait_type: "Status", value: "Awaiting Signature" },
                    { trait_type: "Pages", value: data.pageCount },
                    { trait_type: "Encrypted", value: data.encrypted ? "Yes" : "No" }
                ],
                signature_required: true,
                access_info: {
                    portal: "https://blockserved.com",
                    notice_id: data.noticeId,
                    encrypted: data.encrypted,
                    ipfs_hash: data.ipfsHash,
                    decryption_required: data.encrypted,
                    instructions: "Visit blockserved.com to view and sign this legal document"
                }
            };
            
            const metadataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            
            // Calculate fees
            const creationFee = await this.instance.creationFee().call();
            const sponsorshipFee = data.sponsorFees ? await this.instance.sponsorshipFee().call() : 0;
            const totalFee = parseInt(creationFee) + parseInt(sponsorshipFee);
            
            // Use v5 serveNotice function for documents too
            const tx = await this.instance.serveNotice(
                data.recipient,                    // recipient address
                data.ipfsHash || '',               // encryptedIPFS (contains the document)
                data.encryptionKey || '',          // encryptionKey
                data.agency || 'Legal Services',   // issuingAgency
                'document',                        // noticeType
                data.caseNumber,                   // caseNumber
                data.caseDetails || data.noticeText, // caseDetails
                data.legalRights || 'You must sign this document by the specified deadline', // legalRights
                data.sponsorFees || false,         // sponsorFees
                metadataUri                        // metadataURI with embedded Base64 preview
            ).send({
                feeLimit: 150000000,
                callValue: totalFee,
                shouldPollResponse: true
            });
            
            console.log('Document NFT created with v5 contract:', tx);
            return { success: true, txId: tx, metadata };
            
        } catch (error) {
            console.error('Failed to create Document NFT:', error);
            throw error;
        }
    },
    
    // ====================
    // QUERY FUNCTIONS
    // ====================
    
    // Get current fees
    async getCurrentFees() {
        try {
            const creationFee = await this.instance.creationFee().call();
            const sponsorshipFee = await this.instance.sponsorshipFee().call();
            
            return {
                creation: this.tronWeb.fromSun(creationFee),
                sponsorship: this.tronWeb.fromSun(sponsorshipFee)
            };
        } catch (error) {
            console.error('Failed to get fees:', error);
            throw error;
        }
    },
    
    // Get notice by ID
    async getNotice(noticeId) {
        try {
            const notice = await this.instance.notices(noticeId).call();
            return notice;
        } catch (error) {
            console.error('Failed to get notice:', error);
            throw error;
        }
    },
    
    // Get token URI
    async getTokenURI(tokenId) {
        try {
            const uri = await this.instance.tokenURI(tokenId).call();
            return uri;
        } catch (error) {
            console.error('Failed to get token URI:', error);
            throw error;
        }
    },
    
    // Check if address has role
    async hasRole(role, address) {
        try {
            const hasRole = await this.instance.hasRole(role, address).call();
            return hasRole;
        } catch (error) {
            console.error('Failed to check role:', error);
            return false;
        }
    },
    
    // Get total supply
    async getTotalSupply() {
        try {
            const supply = await this.instance.totalSupply().call();
            return supply.toString();
        } catch (error) {
            console.error('Failed to get total supply:', error);
            throw error;
        }
    },
    
    // ====================
    // HELPER FUNCTIONS
    // ====================
    
    // Estimate energy for transaction
    estimateEnergy(functionName) {
        const estimates = getConfig('contract.energyEstimates');
        return estimates[functionName] || 100000;
    },
    
    // Wait for transaction confirmation
    async waitForConfirmation(txId, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const tx = await this.tronWeb.trx.getTransactionInfo(txId);
                if (tx && tx.blockNumber) {
                    return tx;
                }
            } catch (error) {
                // Transaction not found yet
            }
            
            // Wait 2 seconds before next attempt
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error('Transaction confirmation timeout');
    }
};

console.log('Contract module loaded');