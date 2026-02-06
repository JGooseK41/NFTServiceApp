// Contract Module - Handles all smart contract interactions
window.contract = {
    instance: null,
    tronWeb: null,
    address: null,
    abi: null,
    contractType: null, // 'v5' or 'lite'

    // Initialize contract module
    async init() {
        console.log('Initializing contract module...');

        // Get contract type from network config
        this.contractType = getCurrentNetwork().contractType || 'v5';
        console.log('Contract type:', this.contractType);

        // Load ABI from existing app
        await this.loadABI();
    },

    // Load contract ABI based on contract type
    async loadABI() {
        try {
            // Load appropriate ABI based on contract type
            const abiFile = this.contractType === 'lite'
                ? 'js/lite-contract-abi.json'
                : 'js/v5-contract-abi.json';

            const response = await fetch(abiFile);
            if (response.ok) {
                this.abi = await response.json();
                console.log(`${this.contractType.toUpperCase()} Contract ABI loaded`);
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
                console.error('Please run a local web server to load the ABI properly');
            }
        }
    },

    // Check if using Lite contract
    isLiteContract() {
        return this.contractType === 'lite';
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

            if (this.isLiteContract()) {
                // Lite contract uses isAdmin mapping
                const isAdmin = await this.instance.isAdmin(userAddress).call();
                console.log('User is admin (Lite):', isAdmin);
                return isAdmin;
            } else {
                // V5 contract uses hasRole with DEFAULT_ADMIN_ROLE
                const adminRole = getConfig('contract.roles.DEFAULT_ADMIN_ROLE');
                const hasRole = await this.instance.hasRole(adminRole, userAddress).call();
                console.log('User has admin role (V5):', hasRole);
                return hasRole;
            }
        } catch (error) {
            console.error('Failed to check admin role:', error);
            return false;
        }
    },

    // Check if current user is a server (Lite contract)
    async checkServerRole() {
        try {
            const userAddress = this.tronWeb.defaultAddress.base58;

            if (this.isLiteContract()) {
                const isServer = await this.instance.isServer(userAddress).call();
                console.log('User is server (Lite):', isServer);
                return isServer;
            } else {
                // V5 contract uses hasRole
                const serverRole = getConfig('contract.roles.PROCESS_SERVER_ROLE');
                const hasRole = await this.instance.hasRole(serverRole, userAddress).call();
                console.log('User has server role (V5):', hasRole);
                return hasRole;
            }
        } catch (error) {
            console.error('Failed to check server role:', error);
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

            if (this.isLiteContract()) {
                const tx = await this.instance.setFee(feeInSun).send({
                    feeLimit: 50000000
                });
                console.log('Service fee updated (Lite):', tx);
                return { success: true, txId: tx };
            } else {
                const tx = await this.instance.updateCreationFee(feeInSun).send();
                console.log('Service fee updated (V5):', tx);
                return { success: true, txId: tx };
            }
        } catch (error) {
            console.error('Failed to update service fee:', error);
            throw error;
        }
    },

    // Update sponsorship fee (V5 only)
    async updateSponsorshipFee(newFee) {
        try {
            if (this.isLiteContract()) {
                throw new Error('Sponsorship fee not available on Lite contract');
            }
            const feeInSun = this.tronWeb.toSun(newFee);
            const tx = await this.instance.updateSponsorshipFee(feeInSun).send();
            console.log('Sponsorship fee updated:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to update sponsorship fee:', error);
            throw error;
        }
    },

    // Grant server role (Lite: setServer, V5: grantRole)
    async grantServerRole(address) {
        try {
            if (this.isLiteContract()) {
                const tx = await this.instance.setServer(address, true).send({
                    feeLimit: 50000000
                });
                console.log('Server authorized (Lite):', tx);
                return { success: true, txId: tx };
            } else {
                const role = getConfig('contract.roles.PROCESS_SERVER_ROLE');
                const tx = await this.instance.grantRole(role, address).send();
                console.log('Server role granted (V5):', tx);
                return { success: true, txId: tx };
            }
        } catch (error) {
            console.error('Failed to grant server role:', error);
            throw error;
        }
    },

    // Revoke server role (Lite: setServer false, V5: revokeRole)
    async revokeServerRole(address) {
        try {
            if (this.isLiteContract()) {
                const tx = await this.instance.setServer(address, false).send({
                    feeLimit: 50000000
                });
                console.log('Server revoked (Lite):', tx);
                return { success: true, txId: tx };
            } else {
                const role = getConfig('contract.roles.PROCESS_SERVER_ROLE');
                const tx = await this.instance.revokeRole(role, address).send();
                console.log('Server role revoked (V5):', tx);
                return { success: true, txId: tx };
            }
        } catch (error) {
            console.error('Failed to revoke server role:', error);
            throw error;
        }
    },

    // Grant admin role (Lite: setAdmin, V5: grantRole)
    async grantAdminRole(address) {
        try {
            if (this.isLiteContract()) {
                const tx = await this.instance.setAdmin(address, true).send({
                    feeLimit: 50000000
                });
                console.log('Admin authorized (Lite):', tx);
                return { success: true, txId: tx };
            } else {
                const role = getConfig('contract.roles.DEFAULT_ADMIN_ROLE');
                const tx = await this.instance.grantRole(role, address).send();
                console.log('Admin role granted (V5):', tx);
                return { success: true, txId: tx };
            }
        } catch (error) {
            console.error('Failed to grant admin role:', error);
            throw error;
        }
    },

    // Revoke admin role
    async revokeAdminRole(address) {
        try {
            if (this.isLiteContract()) {
                const tx = await this.instance.setAdmin(address, false).send({
                    feeLimit: 50000000
                });
                console.log('Admin revoked (Lite):', tx);
                return { success: true, txId: tx };
            } else {
                const role = getConfig('contract.roles.DEFAULT_ADMIN_ROLE');
                const tx = await this.instance.revokeRole(role, address).send();
                console.log('Admin role revoked (V5):', tx);
                return { success: true, txId: tx };
            }
        } catch (error) {
            console.error('Failed to revoke admin role:', error);
            throw error;
        }
    },

    // Legacy grantRole/revokeRole for V5 compatibility
    async grantRole(role, address) {
        try {
            if (this.isLiteContract()) {
                throw new Error('Use grantServerRole or grantAdminRole for Lite contract');
            }
            const tx = await this.instance.grantRole(role, address).send();
            console.log('Role granted:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to grant role:', error);
            throw error;
        }
    },

    async revokeRole(role, address) {
        try {
            if (this.isLiteContract()) {
                throw new Error('Use revokeServerRole or revokeAdminRole for Lite contract');
            }
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
            if (this.isLiteContract()) {
                const tx = await this.instance.setFeeCollector(newAddress).send({
                    feeLimit: 50000000
                });
                console.log('Fee collector updated (Lite):', tx);
                return { success: true, txId: tx };
            } else {
                const tx = await this.instance.updateFeeCollector(newAddress).send();
                console.log('Fee collector updated (V5):', tx);
                return { success: true, txId: tx };
            }
        } catch (error) {
            console.error('Failed to update fee collector:', error);
            throw error;
        }
    },

    // Set fee exempt status (Lite only)
    async setFeeExempt(address, exempt) {
        try {
            if (!this.isLiteContract()) {
                throw new Error('Fee exempt only available on Lite contract');
            }
            const tx = await this.instance.setFeeExempt(address, exempt).send({
                feeLimit: 50000000
            });
            console.log('Fee exempt updated:', tx);
            return { success: true, txId: tx };
        } catch (error) {
            console.error('Failed to set fee exempt:', error);
            throw error;
        }
    },

    // Get list of authorized servers (Lite only)
    async getServers() {
        try {
            if (!this.isLiteContract()) {
                throw new Error('getServers only available on Lite contract');
            }
            const servers = await this.instance.getServers().call();
            return servers;
        } catch (error) {
            console.error('Failed to get servers:', error);
            throw error;
        }
    },
    
    // ====================
    // NOTICE FUNCTIONS
    // ====================

    // Create/Serve Notice NFT
    async createAlertNFT(data) {
        try {
            // Prepare metadata with Base64 image and access info
            const metadata = {
                name: `Legal Notice - ${data.caseNumber}`,
                description: data.noticeText || 'You have been served with a legal notice. Visit blockserved.com to view the full document.',
                image: data.thumbnail, // Base64 data URI of first page
                external_url: `https://blockserved.com/notice/${data.noticeId}`,
                attributes: [
                    { trait_type: "Type", value: "Legal Notice" },
                    { trait_type: "Case Number", value: data.caseNumber },
                    { trait_type: "Server ID", value: data.serverId },
                    { trait_type: "Timestamp", value: new Date().toISOString() },
                    { trait_type: "Status", value: "Delivered" },
                    { trait_type: "Document Access", value: "BlockServed Portal" }
                ],
                // Critical info for recipient
                access_info: {
                    portal: "https://blockserved.com",
                    notice_id: data.noticeId,
                    case_number: data.caseNumber,
                    instructions: "Visit blockserved.com and connect your wallet to view and sign this legal document"
                }
            };

            // Convert metadata to Base64 data URI
            const metadataUri = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(metadata))));

            if (this.isLiteContract()) {
                // Lite contract: simple serveNotice(recipient, metadataURI)
                const serviceFee = await this.instance.serviceFee().call();

                const tx = await this.instance.serveNotice(
                    data.recipient,
                    metadataUri
                ).send({
                    feeLimit: 150000000,
                    callValue: serviceFee.toString(),
                    shouldPollResponse: true
                });

                console.log('Notice served with Lite contract:', tx);
                return { success: true, txId: tx, metadata };

            } else {
                // V5 contract: full serveNotice with all parameters
                const creationFee = await this.instance.creationFee().call();
                const sponsorshipFee = data.sponsorFees ? await this.instance.sponsorshipFee().call() : 0;
                const totalFee = parseInt(creationFee) + parseInt(sponsorshipFee);

                const tx = await this.instance.serveNotice(
                    data.recipient,
                    data.ipfsHash || '',
                    data.encryptionKey || '',
                    data.agency || 'Legal Services',
                    'alert',
                    data.caseNumber,
                    data.caseDetails || data.noticeText,
                    data.legalRights || 'You have the right to respond within the specified deadline',
                    data.sponsorFees || false,
                    metadataUri
                ).send({
                    feeLimit: 150000000,
                    callValue: totalFee,
                    shouldPollResponse: true
                });

                console.log('Alert NFT created with V5 contract:', tx);
                return { success: true, txId: tx, metadata };
            }

        } catch (error) {
            console.error('Failed to create Alert NFT:', error);
            throw error;
        }
    },
    
    // Create batch notices for multiple recipients
    async createBatchNotices(data) {
        try {
            console.log('Creating batch notices for recipients:', data.recipients);

            if (this.isLiteContract()) {
                // Lite contract: serveNoticeBatch(recipients[], metadataURIs[])
                const metadataURIs = data.recipients.map((recipient, i) => {
                    const metadata = {
                        name: `Legal Notice - ${data.caseNumber}`,
                        description: data.noticeText || 'You have been served with a legal notice.',
                        image: data.thumbnail,
                        external_url: `https://blockserved.com/notice/${data.noticeId}`,
                        attributes: [
                            { trait_type: "Type", value: "Legal Notice" },
                            { trait_type: "Case Number", value: data.caseNumber },
                            { trait_type: "Recipient", value: i + 1 },
                            { trait_type: "Timestamp", value: new Date().toISOString() },
                            { trait_type: "Status", value: "Delivered" }
                        ],
                        access_info: {
                            portal: "https://blockserved.com",
                            notice_id: data.noticeId,
                            case_number: data.caseNumber,
                            instructions: "Visit blockserved.com and connect your wallet to view and sign this legal document"
                        }
                    };
                    return 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(metadata))));
                });

                const serviceFee = await this.instance.serviceFee().call();
                const totalFee = BigInt(serviceFee.toString()) * BigInt(data.recipients.length);

                const tx = await this.instance.serveNoticeBatch(
                    data.recipients,
                    metadataURIs
                ).send({
                    feeLimit: 500000000,
                    callValue: totalFee.toString(),
                    shouldPollResponse: true
                });

                console.log('Batch notices served with Lite contract:', tx);
                return {
                    success: true,
                    txId: tx,
                    alertTx: tx,
                    recipientCount: data.recipients.length
                };

            } else {
                // V5 contract: original batch format
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

                const creationFee = await this.instance.creationFee().call();
                const totalFee = parseInt(creationFee) * data.recipients.length * 2;

                const tx = await this.instance.serveNoticeBatch(batchNotices).send({
                    feeLimit: 300000000,
                    callValue: totalFee,
                    shouldPollResponse: true
                });

                console.log('Batch notices created with V5:', tx);
                return {
                    success: true,
                    txId: tx,
                    alertTx: tx,
                    documentTx: tx,
                    recipientCount: data.recipients.length,
                    metadata
                };
            }

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
            if (this.isLiteContract()) {
                const serviceFee = await this.instance.serviceFee().call();
                return {
                    creation: this.tronWeb.fromSun(serviceFee),
                    service: this.tronWeb.fromSun(serviceFee),
                    sponsorship: '0' // Not available on Lite
                };
            } else {
                const creationFee = await this.instance.creationFee().call();
                const sponsorshipFee = await this.instance.sponsorshipFee().call();
                return {
                    creation: this.tronWeb.fromSun(creationFee),
                    service: this.tronWeb.fromSun(creationFee),
                    sponsorship: this.tronWeb.fromSun(sponsorshipFee)
                };
            }
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