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
            // Create contract instance EXACTLY as v1 does
            this.instance = await this.tronWeb.contract(this.abi, this.address);
            console.log('Contract initialized at:', this.address);
            
            // Verify serveNoticeBatch is available
            if (this.instance.serveNoticeBatch) {
                console.log('✓ serveNoticeBatch method found on contract instance');
                // Check the method signature
                const methodSig = this.instance.serveNoticeBatch.toString();
                console.log('Method signature:', methodSig.substring(0, 100) + '...');
            } else {
                console.error('✗ serveNoticeBatch method NOT found on contract instance');
            }
            
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
            console.log('Checking admin for wallet:', userAddress);
            
            // Check if this is the owner wallet (hardcoded fallback)
            const ownerWallets = [
                'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
                'tgdd34rr3rzfuozoqlze9d4tzfbigl4jay'
            ];
            const isOwnerWallet = ownerWallets.includes(userAddress) || 
                                  ownerWallets.includes(userAddress.toLowerCase());
            
            console.log('Is owner wallet check:', isOwnerWallet, 'for address:', userAddress);
            
            if (isOwnerWallet) {
                console.log('Owner wallet detected - granting admin access');
                return true;
            }
            
            // Check DEFAULT_ADMIN_ROLE (0x000...)
            const defaultAdminRole = '0x0000000000000000000000000000000000000000000000000000000000000000';
            const hasDefaultAdminRole = await this.instance.hasRole(defaultAdminRole, userAddress).call();
            
            // Check ADMIN_ROLE (keccak256("ADMIN_ROLE"))
            const adminRole = '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775';
            const hasAdminRole = await this.instance.hasRole(adminRole, userAddress).call();
            
            const isAdmin = hasDefaultAdminRole || hasAdminRole || isOwnerWallet;
            
            console.log('Has DEFAULT_ADMIN_ROLE:', hasDefaultAdminRole);
            console.log('Has ADMIN_ROLE:', hasAdminRole);
            console.log('Is owner wallet:', isOwnerWallet);
            console.log('User has admin role:', isAdmin);
            
            return isAdmin;
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
            // Prepare TRC-721 compliant metadata with enhanced wallet compatibility
            const metadata = {
                // Required TRC-721 fields for maximum wallet compatibility
                name: `Legal Notice Alert - Case #${data.caseNumber}`,
                
                // Comprehensive description that shows in wallet "About" section
                description: `LEGAL NOTICE: ${data.noticeText}\n\n` +
                            `You have been served with legal documents requiring your attention.\n\n` +
                            `TO VIEW AND SIGN: Visit https://blockserved.com and connect your wallet.\n\n` +
                            `CASE NUMBER: ${data.caseNumber}\n` +
                            `ISSUING AGENCY: ${data.agency || 'Legal Services'}\n` +
                            `RESPONSE DEADLINE: ${data.deadline || '30 days from service'}\n\n` +
                            `IMPORTANT: This is an official legal notice. Failure to respond may result in default judgment.\n\n` +
                            `For assistance, contact the issuing agency listed above.`,
                
                // Image - Base64 data URI (required for wallet display)
                image: data.thumbnail,
                
                // External URL for "View on Web" button in wallets
                external_url: `https://blockserved.com?notice=${data.noticeId}`,
                
                // Standard TRC-721 attributes for wallet display
                attributes: [
                    { 
                        trait_type: "Notice Type", 
                        value: "Legal Service Alert"
                    },
                    { 
                        trait_type: "Case Number", 
                        value: data.caseNumber
                    },
                    { 
                        trait_type: "Status", 
                        value: "✓ Delivered"
                    },
                    { 
                        trait_type: "Service Date", 
                        value: new Date().toLocaleDateString()
                    },
                    { 
                        trait_type: "Server ID", 
                        value: data.serverId
                    },
                    { 
                        trait_type: "Issuing Agency", 
                        value: data.agency || "Legal Services"
                    },
                    { 
                        trait_type: "Response Deadline", 
                        value: data.deadline || "30 days"
                    },
                    { 
                        trait_type: "Document Status", 
                        value: data.encrypted ? "🔒 Encrypted - Signature Required" : "📄 Available"
                    },
                    {
                        trait_type: "View Portal",
                        value: "blockserved.com"
                    }
                ],
                
                // Optional: Enhanced properties for advanced wallets
                properties: {
                    category: "legal_notice",
                    files: data.ipfsHash ? [{
                        uri: `ipfs://${data.ipfsHash}`,
                        type: "application/pdf"
                    }] : [],
                    creators: [{
                        address: data.serverId,
                        share: 100
                    }]
                }
            };
            
            // Convert metadata to Base64 data URI
            const metadataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            
            // Validate recipient address
            if (!data.recipient) {
                throw new Error('Recipient address is required');
            }
            
            // Ensure recipient is a string, not an object
            const recipientAddress = typeof data.recipient === 'object' ? 
                (data.recipient.address || data.recipient.toString()) : 
                data.recipient;
            
            console.log('Creating Alert NFT for recipient:', recipientAddress);
            console.log('Data object:', data);
            
            // Check if contract instance is initialized
            if (!this.instance) {
                throw new Error('Contract not initialized. Please connect wallet first.');
            }
            
            // Check if serveNotice method exists
            if (!this.instance.serveNotice) {
                console.error('Available contract methods:', Object.keys(this.instance));
                throw new Error('serveNotice method not found in contract');
            }
            
            // Calculate fees
            const creationFee = await this.instance.creationFee().call();
            const sponsorshipFee = data.sponsorFees ? await this.instance.sponsorshipFee().call() : 0;
            const totalFee = parseInt(creationFee) + parseInt(sponsorshipFee);
            
            console.log('Calling serveNotice with parameters:', {
                recipient: recipientAddress,
                ipfsHash: data.ipfsHash || '',
                encryptionKey: data.encryptionKey || '',
                agency: data.agency || 'Legal Services',
                noticeType: 'alert',
                caseNumber: data.caseNumber,
                caseDetails: data.caseDetails || data.noticeText,
                legalRights: data.legalRights || 'You have the right to respond within the specified deadline',
                sponsorFees: data.sponsorFees || false,
                metadataUri: metadataUri.substring(0, 100) + '...'
            });
            
            // Use v5 serveNotice function
            const tx = await this.instance.serveNotice(
                recipientAddress,                  // recipient address (string)
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
            
            // Build batch notice array - try matching v1 exactly
            const batchNotices = data.recipients.map(recipient => {
                // Ensure recipient is a string address
                const recipientAddress = typeof recipient === 'object' ? 
                    (recipient.address || recipient.toString()) : 
                    recipient;
                
                // Match v1 structure exactly
                return {
                    recipient: recipientAddress,
                    encryptedIPFS: data.ipfsHash || '',
                    encryptionKey: data.encryptionKey || '',
                    issuingAgency: data.agency || 'Legal Services',
                    noticeType: 'alert',
                    caseNumber: data.caseNumber,
                    caseDetails: data.noticeText,
                    legalRights: data.legalRights || 'You have the right to respond',
                    sponsorFees: data.sponsorFees || false,
                    metadataURI: metadataUri
                };
            });
            
            // Calculate total fees
            const creationFee = await this.instance.creationFee().call();
            const totalFee = parseInt(creationFee) * data.recipients.length * 2; // x2 for Alert + Document
            
            console.log('Calling serveNoticeBatch with:', batchNotices.length, 'notices');
            console.log('First notice:', JSON.stringify(batchNotices[0], null, 2));
            
            // Check if serveNoticeBatch exists
            if (!this.instance.serveNoticeBatch) {
                console.error('serveNoticeBatch not found. Available methods:', Object.keys(this.instance));
                
                // Fallback: Create individual notices instead of batch
                console.log('Falling back to individual notice creation...');
                const results = [];
                for (const notice of batchNotices) {
                    try {
                        const tx = await this.instance.serveNotice(
                            notice.recipient,
                            notice.encryptedIPFS,
                            notice.encryptionKey,
                            notice.issuingAgency,
                            notice.noticeType,
                            notice.caseNumber,
                            notice.caseDetails,
                            notice.legalRights,
                            notice.sponsorFees,
                            notice.metadataURI
                        ).send({
                            feeLimit: 150000000,
                            callValue: parseInt(creationFee) + (notice.sponsorFees ? parseInt(await this.instance.sponsorshipFee().call()) : 0),
                            shouldPollResponse: true
                        });
                        results.push(tx);
                    } catch (error) {
                        console.error('Failed to create notice for recipient:', notice.recipient, error);
                        throw error;
                    }
                }
                
                return {
                    success: true,
                    txId: results[0],
                    alertTx: results[0],
                    documentTx: results[0],
                    recipientCount: data.recipients.length,
                    metadata,
                    allTransactions: results
                };
            }
            
            // Call batch function exactly as v1 did
            console.log('Calling serveNoticeBatch with', batchNotices.length, 'notices');
            console.log('First notice structure:', JSON.stringify(batchNotices[0], null, 2));
            
            // Verify the contract has the batch method
            if (!this.instance.serveNoticeBatch) {
                throw new Error('serveNoticeBatch method not found in contract instance');
            }
            
            // The issue is TronWeb is passing the array incorrectly
            // In v1 it works, so the contract and method are fine
            // The problem is likely with how TronWeb encodes the struct array
            
            // Try calling exactly as v1 does - direct call with array
            console.log('Attempting batch transaction...');
            console.log('TronWeb version:', this.tronWeb.version);
            console.log('Contract address:', this.address);
            
            // Log exactly what we're sending
            console.log('Batch array being sent:', batchNotices);
            console.log('Total fee:', totalFee);
            
            const tx = await this.instance.serveNoticeBatch(batchNotices).send({
                feeLimit: 2000000000,  // Use same high limit as v1
                callValue: totalFee,
                shouldPollResponse: true
            });
            
            console.log('Batch transaction result:', tx);
            
            // Extract alert and document IDs from result
            let alertIds = [];
            let documentIds = [];
            
            if (tx && Array.isArray(tx)) {
                // Contract returns [alertIds[], documentIds[]]
                if (tx.length >= 2 && Array.isArray(tx[0]) && Array.isArray(tx[1])) {
                    alertIds = tx[0].map(id => id.toString());
                    documentIds = tx[1].map(id => id.toString());
                }
            }
            
            return {
                success: true,
                txId: tx,
                alertTx: tx,
                documentTx: tx,
                alertIds,
                documentIds,
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
            // TRC-721 compliant metadata for Document NFT
            const metadata = {
                // Required fields
                name: `Legal Document - Case #${data.caseNumber}`,
                
                // Comprehensive description for wallet display
                description: `LEGAL DOCUMENT REQUIRING SIGNATURE\n\n` +
                            `${data.noticeText}\n\n` +
                            `This document requires your electronic signature to acknowledge receipt.\n\n` +
                            `TO SIGN: Visit https://blockserved.com and connect your wallet.\n\n` +
                            `CASE NUMBER: ${data.caseNumber}\n` +
                            `DOCUMENT TYPE: Legal Notice Requiring Signature\n` +
                            `PAGE COUNT: ${data.pageCount || 1} pages\n` +
                            `ISSUING AGENCY: ${data.agency || 'Legal Services'}\n` +
                            `SIGNATURE DEADLINE: ${data.deadline || '30 days from service'}\n\n` +
                            `STATUS: ${data.encrypted ? '🔒 ENCRYPTED - Awaiting Signature' : '📝 Awaiting Signature'}\n\n` +
                            `After signing, you will receive the decryption key to access the full document.`,
                
                // Image preview
                image: data.thumbnail,
                
                // External URL
                external_url: `https://blockserved.com?document=${data.noticeId}`,
                
                // TRC-721 attributes
                attributes: [
                    { 
                        trait_type: "Document Type", 
                        value: "Legal Notice"
                    },
                    { 
                        trait_type: "Case Number", 
                        value: data.caseNumber
                    },
                    { 
                        trait_type: "Status", 
                        value: "📝 Awaiting Signature"
                    },
                    { 
                        trait_type: "Service Date", 
                        value: new Date().toLocaleDateString()
                    },
                    { 
                        trait_type: "Page Count", 
                        value: String(data.pageCount || 1)
                    },
                    { 
                        trait_type: "Server ID", 
                        value: data.serverId
                    },
                    { 
                        trait_type: "Issuing Agency", 
                        value: data.agency || "Legal Services"
                    },
                    { 
                        trait_type: "Signature Deadline", 
                        value: data.deadline || "30 days"
                    },
                    { 
                        trait_type: "Encryption", 
                        value: data.encrypted ? "🔒 Encrypted" : "📄 Standard"
                    },
                    {
                        trait_type: "Sign Portal",
                        value: "blockserved.com"
                    }
                ],
                
                // Enhanced properties
                properties: {
                    category: "legal_document",
                    signature_required: true,
                    files: data.ipfsHash ? [{
                        uri: `ipfs://${data.ipfsHash}`,
                        type: "application/pdf",
                        encrypted: data.encrypted
                    }] : [],
                    creators: [{
                        address: data.serverId,
                        share: 100
                    }]
                }
            };
            
            const metadataUri = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
            
            // Validate recipient address
            if (!data.recipient) {
                throw new Error('Recipient address is required for Document NFT');
            }
            
            // Ensure recipient is a string, not an object
            const recipientAddress = typeof data.recipient === 'object' ? 
                (data.recipient.address || data.recipient.toString()) : 
                data.recipient;
            
            console.log('Creating Document NFT for recipient:', recipientAddress);
            
            // Calculate fees
            const creationFee = await this.instance.creationFee().call();
            const sponsorshipFee = data.sponsorFees ? await this.instance.sponsorshipFee().call() : 0;
            const totalFee = parseInt(creationFee) + parseInt(sponsorshipFee);
            
            // Use v5 serveNotice function for documents too
            const tx = await this.instance.serveNotice(
                recipientAddress,                  // recipient address (string)
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