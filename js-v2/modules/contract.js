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
            const basePath = window.location.pathname.includes('/v2/') ? '' : 'js-v2/';

            // Check contract type from config
            const network = getCurrentNetwork();
            const isLiteContract = network?.contractType === 'lite';

            // Load appropriate ABI based on contract type
            const abiFile = isLiteContract ? 'js/lite-contract-abi.json' : 'js/v5-contract-abi.json';
            const response = await fetch(basePath + abiFile);

            if (response.ok) {
                this.abi = await response.json();
                console.log(isLiteContract ? 'Lite Contract ABI loaded' : 'V5 Enumerable Contract ABI loaded');
                console.log('Contract methods available:', this.abi.filter(item => item.type === 'function').map(f => f.name));
            } else {
                throw new Error('Failed to fetch ABI: ' + abiFile);
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

    // Check if using Lite contract
    isLiteContract() {
        const network = getCurrentNetwork();
        return network?.contractType === 'lite';
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
            // IMPORTANT: Make ABI globally available like v1 does
            window.CONTRACT_ABI = this.abi;
            
            // Create contract instance EXACTLY as v1 does
            this.instance = await this.tronWeb.contract(this.abi, this.address);
            
            // ALSO make it globally available like v1
            window.legalContract = this.instance;
            
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
            // Ensure metadata is always valid, handle unicode characters
            const metadataUri = metadata ?
                'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(metadata)))) :
                'data:application/json;base64,e30=';  // e30= is {} in base64
            
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

            // Check if using Lite contract
            const isLite = this.isLiteContract();
            console.log('Contract type:', isLite ? 'Lite' : 'V5');

            let tx;

            if (isLite) {
                // LITE CONTRACT: Uses serviceFee() and simpler serveNotice(recipient, metadataUri)
                const serviceFee = await this.instance.serviceFee().call();
                console.log('Lite contract service fee:', serviceFee.toString());

                console.log('Calling Lite serveNotice with parameters:', {
                    recipient: recipientAddress,
                    metadataUri: metadataUri.substring(0, 100) + '...'
                });

                tx = await this.instance.serveNotice(
                    recipientAddress,    // recipient address
                    metadataUri          // metadataURI with embedded Base64 metadata
                ).send({
                    feeLimit: 150000000,      // 150 TRX fee limit
                    callValue: serviceFee,    // Send the service fee
                    shouldPollResponse: true
                });

                console.log('Alert NFT created with Lite contract:', tx);
            } else {
                // V5 CONTRACT: Uses creationFee/sponsorshipFee and full serveNotice signature
                const creationFee = await this.instance.creationFee().call();
                const sponsorshipFee = data.sponsorFees ? await this.instance.sponsorshipFee().call() : 0;
                const totalFee = parseInt(creationFee) + parseInt(sponsorshipFee);

                console.log('Calling V5 serveNotice with parameters:', {
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

                tx = await this.instance.serveNotice(
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

                console.log('Alert NFT created with V5 contract:', tx);
            }

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
            
            // BALANCED APPROACH: Use a small pre-made thumbnail or generate a tiny one
            // Most wallets need a direct image URL or small base64 to display properly
            let imageData;
            
            // Option 1: Use a standard legal notice thumbnail (small, reusable)
            const DEFAULT_LEGAL_THUMBNAIL = 'https://blockserved.com/images/legal-notice-thumb.png';
            
            // Priority for image URL:
            // 1. IPFS URL if provided (best for decentralization)
            // 2. Backend URL as fallback
            // 3. Default image as last resort
            
            if (data.thumbnailUrl) {
                // If it's an IPFS URL, use it directly (wallets understand ipfs:// protocol)
                if (data.thumbnailUrl.startsWith('ipfs://')) {
                    imageData = data.thumbnailUrl;  // Keep ipfs:// protocol
                    console.log('Using IPFS URL for NFT image:', imageData);
                } 
                // If it's an IPFS hash, format it properly
                else if (data.thumbnailUrl.length === 46 && data.thumbnailUrl.startsWith('Qm')) {
                    imageData = `ipfs://${data.thumbnailUrl}`;
                    console.log('Using IPFS hash for NFT image:', imageData);
                }
                // Otherwise use the provided URL
                else {
                    imageData = data.thumbnailUrl;
                    console.log('Using provided URL for NFT image:', imageData);
                }
            }
            // Fallback to server endpoint
            else if (data.noticeId) {
                imageData = `https://nftserviceapp.onrender.com/api/thumbnail/${data.noticeId}`;
                console.log('Using backend URL for NFT image:', imageData);
            }
            // Last resort: default thumbnail
            else {
                imageData = DEFAULT_LEGAL_THUMBNAIL;
                console.log('Using default thumbnail');
            }
            
            // TRC-721 compliant metadata with comprehensive wallet description
            const metadata = {
                name: `${data.agency || 'Legal Notice'} - Case #${data.caseNumber}`,
                description: `⚖️ OFFICIAL LEGAL NOTICE ⚖️\n\n` +
                            `You have been served with an official legal document regarding Case #${data.caseNumber}.\n\n` +
                            `📋 WHAT THIS MEANS:\n` +
                            `This NFT represents legal service of process. You have been officially notified ` +
                            `of a legal matter that may require your response or appearance.\n\n` +
                            `🔓 TO ACCESS YOUR FULL DOCUMENT:\n` +
                            `1. Visit https://www.BlockServed.com\n` +
                            `2. Connect this wallet\n` +
                            `3. View and download your complete legal notice\n` +
                            `4. Follow the instructions provided in the document\n\n` +
                            `⏰ IMPORTANT: Legal notices often have deadlines. Failure to respond within ` +
                            `the required timeframe may result in default judgments or other legal consequences.\n\n` +
                            `📄 NOTICE PREVIEW:\n${data.noticeText ? data.noticeText.substring(0, 200) : 'Legal Notice'}...\n\n` +
                            `👥 SERVED TO: ${data.recipients.length} recipient(s)\n` +
                            `🏛️ ISSUING AGENCY: ${data.agency || 'Legal Services'}\n\n` +
                            `✅ This NFT serves as immutable proof of service on the blockchain.`,
                image: imageData,  // Direct URL that wallets can fetch
                external_url: `https://blockserved.com/notice/${data.noticeId}`,
                animation_url: data.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${data.ipfsHash}` : null, // Link to encrypted document
                attributes: [
                    { trait_type: "Case Number", value: data.caseNumber },
                    { trait_type: "Recipients", value: String(data.recipients.length) },
                    { trait_type: "Notice Type", value: data.noticeType || "Legal Notice" },
                    { trait_type: "Status", value: "Delivered" },
                    { trait_type: "Agency", value: data.agency || "Legal Services" },
                    { trait_type: "Service Date", value: new Date().toLocaleDateString() },
                    { trait_type: "Access Portal", value: "www.BlockServed.com" },
                    { trait_type: "Blockchain", value: "TRON" }
                ],
                properties: {
                    category: "legal",
                    issuing_agency: data.agency || "Legal Services",
                    encrypted: data.encrypted ? "true" : "false",
                    ipfs_document: data.ipfsHash || null,
                    server_id: data.serverId || null
                }
            };
            
            // SOLUTION: Upload complete notice data to IPFS and reference it
            let metadataUri;
            let noticeDataIpfsHash = null;
            
            // Upload the complete legal notice data to IPFS
            if (data.useIPFS !== false) {
                try {
                    console.log('Uploading complete notice data to IPFS for energy efficiency...');
                    
                    // Create SHARED notice data object (same for all recipients)
                    // This gets stored ONCE on IPFS and referenced by all NFTs
                    const sharedNoticeData = {
                        // TRC-721 Metadata for wallet display
                        name: metadata.name,
                        description: metadata.description,
                        image: metadata.image,
                        external_url: metadata.external_url,
                        attributes: metadata.attributes,
                        properties: metadata.properties,
                        
                        // Essential legal information
                        caseNumber: data.caseNumber,
                        issuingAgency: data.agency || 'Legal Services',
                        noticeType: data.noticeType || 'Legal Notice',
                        
                        // Full notice details (not limited)
                        noticeText: data.noticeText,
                        caseDetails: data.caseDetails || data.noticeText,
                        
                        // Legal rights and instructions
                        legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps',
                        portalUrl: 'https://www.BlockServed.com',
                        instructions: {
                            howToAccess: [
                                'Visit https://www.BlockServed.com',
                                'Connect this wallet',
                                'View and download your complete legal notice',
                                'Follow the instructions in the document'
                            ],
                            importantNotes: [
                                'Legal notices often have strict deadlines',
                                'Failure to respond may result in default judgment',
                                'This NFT is proof you were properly served',
                                'Keep this NFT for your records'
                            ]
                        },
                        
                        // Document references
                        encryptedDocumentIPFS: data.ipfsHash || null,
                        encryptionKey: data.encryptionKey || null,
                        thumbnailIPFS: data.thumbnailIpfsHash || null,
                        
                        // Service details
                        serverId: data.serverId,
                        timestamp: new Date().toISOString(),
                        serviceDate: new Date().toLocaleDateString(),
                        recipients: data.recipients.map(r => typeof r === 'string' ? r : r.address),
                        totalRecipients: data.recipients.length
                    };
                    
                    // Upload to IPFS
                    const noticeBlob = new Blob([JSON.stringify(sharedNoticeData)], { type: 'application/json' });
                    noticeDataIpfsHash = await window.documents.uploadToIPFS(noticeBlob, {
                        type: 'notice_data',
                        encrypt: false  // Public data
                    });
                    
                    if (noticeDataIpfsHash) {
                        metadataUri = `ipfs://${noticeDataIpfsHash}`;
                        console.log('✅ Notice data on IPFS, using hash as reference:', noticeDataIpfsHash);
                    }
                } catch (ipfsError) {
                    console.error('Failed to upload notice data to IPFS:', ipfsError);
                }
            }
            
            // Fallback to URL if IPFS fails
            if (!metadataUri) {
                metadataUri = data.noticeId ? 
                    `https://nftserviceapp.onrender.com/api/metadata/${data.noticeId}` :
                    '';
                console.log('Using backend URL for metadata:', metadataUri);
            }
            
            // Build batch notice array - try matching v1 exactly
            const batchNotices = data.recipients.map(recipient => {
                // Ensure recipient is a string address
                const recipientAddress = typeof recipient === 'object' ? 
                    (recipient.address || recipient.toString()) : 
                    recipient;
                
                // Use IPFS hash for permanent immutable storage
                // Fallback to disk URL if IPFS fails, then 'none' placeholder
                const ipfsHash = data.ipfsHash || '';
                const encryptionKey = data.encryptionKey || '';
                
                // MAXIMUM VISIBILITY: Balance on-chain visibility with energy costs
                // Put enough info on-chain for wallets/TronScan to show proof of service
                return {
                    recipient: recipientAddress,
                    encryptedIPFS: ipfsHash || '',                           // Full document IPFS
                    encryptionKey: encryptionKey ? 'SEALED' : '',            // Show it's encrypted
                    issuingAgency: data.agency || 'Legal Services',          // VISIBLE in wallet
                    noticeType: data.noticeType || 'Legal Notice',           // Use selected notice type from UI
                    caseNumber: data.caseNumber || '',                       // VISIBLE case reference
                    caseDetails: `${(data.noticeText || '').substring(0, 80)} SEE: BlockServed.com`,  // Preview + direction
                    legalRights: `SERVED ${new Date().toISOString().split('T')[0]} - View BlockServed.com`,  // Date + portal
                    sponsorFees: false,
                    metadataURI: noticeDataIpfsHash ? 
                        `ipfs://${noticeDataIpfsHash}` :                     // Use IPFS if available
                        `https://blockserved.com/notice/${data.noticeId}`    // Fallback to portal URL
                };
            });
            
            // Calculate total fees - check for exemptions
            const walletAddress = this.tronWeb.defaultAddress.base58;
            const isLite = this.isLiteContract();

            // Check if wallet is fee exempt using contract's calculateFee function
            let feePerRecipient;

            if (isLite) {
                // LITE CONTRACT: Simple serviceFee for all, check feeExempt
                const isExempt = await this.instance.feeExempt(walletAddress).call();
                if (isExempt) {
                    feePerRecipient = 0;
                    console.log('Wallet is fee exempt on Lite contract - no charges!');
                } else {
                    feePerRecipient = parseInt(await this.instance.serviceFee().call());
                    console.log('Lite contract service fee per recipient:', feePerRecipient / 1000000, 'TRX');
                }
            } else if (this.instance.calculateFee) {
                // V5 CONTRACT: Use contract's calculateFee which handles exemptions
                feePerRecipient = parseInt(await this.instance.calculateFee(walletAddress).call());
                console.log('Fee per recipient from contract (handles exemptions):', feePerRecipient / 1000000, 'TRX');
            } else {
                // V5 Fallback: manually check exemptions
                const isFullExempt = await this.instance.fullFeeExemptions(walletAddress).call();
                const isServiceExempt = await this.instance.serviceFeeExemptions(walletAddress).call();

                if (isFullExempt) {
                    feePerRecipient = 0;
                    console.log('Wallet is FULLY FEE EXEMPT - no charges!');
                } else if (isServiceExempt) {
                    const creationFee = await this.instance.creationFee().call();
                    feePerRecipient = parseInt(creationFee);
                    console.log('Wallet is service fee exempt - only creation fee:', feePerRecipient / 1000000, 'TRX');
                } else {
                    const creationFee = await this.instance.creationFee().call();
                    const serviceFee = await this.instance.serviceFee().call();
                    feePerRecipient = parseInt(creationFee) + parseInt(serviceFee);
                    console.log('Regular fees apply:', feePerRecipient / 1000000, 'TRX per recipient');
                }
            }
            
            const totalFee = feePerRecipient * data.recipients.length;
            console.log('Total fee for batch (', data.recipients.length, 'recipients):', totalFee / 1000000, 'TRX');
            
            // Check energy
            const account = await this.tronWeb.trx.getAccount(walletAddress);
            const energy = account.energy || 0;
            console.log('Available energy:', energy.toLocaleString());
            
            if (totalFee === 0 && energy > 2000000) {
                console.log('✅ Fee exempt with sufficient energy - transaction should be nearly free!');
            }
            
            console.log('Calling serveNoticeBatch with:', batchNotices.length, 'notices');
            console.log('First notice:', JSON.stringify(batchNotices[0], null, 2));
            
            // Check if serveNoticeBatch exists
            if (!this.instance.serveNoticeBatch) {
                console.error('serveNoticeBatch not found. Available methods:', Object.keys(this.instance));
                throw new Error('Batch minting not available in contract');
            }

            console.log('Contract address:', this.address);
            console.log('Batch size:', batchNotices.length);
            console.log('Contract type for batch:', isLite ? 'Lite' : 'V5');

            if (isLite) {
                // LITE CONTRACT: Simple serveNoticeBatch(address[] recipients, string[] metadataURIs)
                const recipients = batchNotices.map(n => n.recipient);
                const metadataURIs = batchNotices.map(n => n.metadataURI || '');

                console.log('Lite batch recipients:', recipients);
                console.log('Lite batch metadataURIs count:', metadataURIs.length);

                try {
                    const tx = await this.instance.serveNoticeBatch(
                        recipients,
                        metadataURIs
                    ).send({
                        feeLimit: 500000000,      // 500 TRX limit for batch
                        callValue: totalFee,
                        shouldPollResponse: true
                    });

                    console.log('Lite batch transaction successful!');
                    console.log('\n📊 ON-CHAIN DATA STORED (Lite):');
                    console.log('=' + '='.repeat(50));
                    batchNotices.forEach((notice, i) => {
                        console.log(`\nRecipient ${i + 1}: ${notice.recipient}`);
                        console.log(`  Metadata URI: ${notice.metadataURI}`);
                    });
                    console.log('=' + '='.repeat(50));
                    return { success: true, txId: tx, alertTx: tx, documentTx: tx };
                } catch (liteError) {
                    console.error('Lite batch failed:', liteError);
                    throw liteError;
                }
            }

            // V5 CONTRACT: Complex struct array approach
            // Prepare notice arrays (moved outside try block for scope)
            const noticeArrays = batchNotices.map(notice => [
                notice.recipient,
                notice.encryptedIPFS || '',
                notice.encryptionKey || '',
                notice.issuingAgency || '',
                notice.noticeType || '',
                notice.caseNumber || '',
                notice.caseDetails || '',
                notice.legalRights || '',
                notice.sponsorFees || false,
                notice.metadataURI || ''
            ]);

            // Try using triggerSmartContract directly to bypass encoding issues
            console.log('Attempting V5 batch transaction...');

            try {
                console.log('Sending batch of', noticeArrays.length, 'notices as pure value arrays');
                console.log('First notice array format:', noticeArrays[0]);

                // Pass the array directly, not wrapped in another array or object
                const tx = await this.instance.serveNoticeBatch(noticeArrays).send({
                    feeLimit: 2000000000,
                    callValue: totalFee,
                    shouldPollResponse: true
                });

                console.log('V5 batch transaction successful!');

                // Log the data that was sent on-chain for visibility
                console.log('\n📊 ON-CHAIN DATA STORED:');
                console.log('=' + '='.repeat(50));
                batchNotices.forEach((notice, i) => {
                    console.log(`\nRecipient ${i + 1}: ${notice.recipient}`);
                    console.log(`  Case Number: ${notice.caseNumber}`);
                    console.log(`  Issuing Agency: ${notice.issuingAgency}`);
                    console.log(`  Notice Type: ${notice.noticeType}`);
                    console.log(`  Case Details: ${notice.caseDetails}`);
                    console.log(`  Legal Rights: ${notice.legalRights}`);
                    console.log(`  IPFS Document: ${notice.encryptedIPFS}`);
                    console.log(`  Metadata URI: ${notice.metadataURI}`);
                });
                console.log('=' + '='.repeat(50));
                return { success: true, txId: tx, alertTx: tx, documentTx: tx };

            } catch (normalError) {
                console.error('Normal method failed, trying proper batch fix:', normalError.message);
                
                // Use the proper batch fix module that handles struct array encoding correctly
                if (window.properBatchFix) {
                    try {
                        console.log('Using properBatchFix module for batch minting...');
                        const result = await window.properBatchFix.executeBatchMint(
                            this.instance,
                            batchNotices,
                            totalFee
                        );
                        
                        if (result.success) {
                            return {
                                ...result,
                                recipientCount: data.recipients.length,
                                metadata
                            };
                        }
                    } catch (batchFixError) {
                        console.error('Proper batch fix also failed:', batchFixError);
                    }
                }
                
                // If batch fix module isn't available or fails, try direct encoding
                try {
                    console.log('Attempting direct raw transaction approach...');
                    
                    // Build the function selector
                    const functionSelector = 'serveNoticeBatch((address,string,string,string,string,string,string,string,bool,string)[])';
                    
                    // Create the parameter object for the struct array
                    // Key insight: Pass the array of arrays directly
                    const params = [{
                        type: 'tuple[]',
                        value: noticeArrays.map(noticeValues => ({
                            type: 'tuple',
                            components: [
                                { type: 'address', value: noticeValues[0] },
                                { type: 'string', value: noticeValues[1] },
                                { type: 'string', value: noticeValues[2] },
                                { type: 'string', value: noticeValues[3] },
                                { type: 'string', value: noticeValues[4] },
                                { type: 'string', value: noticeValues[5] },
                                { type: 'string', value: noticeValues[6] },
                                { type: 'string', value: noticeValues[7] },
                                { type: 'bool', value: noticeValues[8] },
                                { type: 'string', value: noticeValues[9] }
                            ]
                        }))
                    }];
                    
                    const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
                        this.address,
                        functionSelector,
                        {
                            feeLimit: 2000000000,
                            callValue: totalFee
                        },
                        params,
                        this.tronWeb.defaultAddress.base58
                    );
                
                    const signedTx = await this.tronWeb.trx.sign(transaction.transaction);
                    const result = await this.tronWeb.trx.sendRawTransaction(signedTx);
                    
                    console.log('Batch transaction successful with direct encoding!');
                    return {
                        success: true,
                        txId: result.txid,
                        alertTx: result.txid,
                        documentTx: result.txid,
                        recipientCount: data.recipients.length,
                        metadata
                    };
                } catch (directError) {
                    console.error('Direct encoding also failed:', directError);
                    
                    // Don't automatically fallback - let user decide
                    const error = new Error('Batch minting failed. You can try minting individually to specific addresses.');
                    error.batchMintingFailed = true;
                    error.recipients = data.recipients;
                    error.batchNotices = batchNotices;
                    throw error;
                }
            }
            
        } catch (error) {
            console.error('Failed to create batch notices:', error);
            throw error;
        }
    },
    
    // Selective individual minting - user chooses which addresses to mint to
    async mintToSelectedRecipients(recipients, originalData) {
        console.log('Minting to selected recipients:', recipients);
        const results = [];
        
        // Check fee exemptions
        const walletAddress = this.tronWeb.defaultAddress.base58;
        let feePerRecipient;
        
        if (this.instance.calculateFee) {
            feePerRecipient = parseInt(await this.instance.calculateFee(walletAddress).call());
        } else {
            const isFullExempt = await this.instance.fullFeeExemptions(walletAddress).call();
            if (isFullExempt) {
                feePerRecipient = 0;
            } else {
                const creationFee = await this.instance.creationFee().call();
                const serviceFee = await this.instance.serviceFee().call();
                feePerRecipient = parseInt(creationFee) + parseInt(serviceFee);
            }
        }
        
        console.log('Fee per recipient (with exemptions):', feePerRecipient / 1000000, 'TRX');
        
        for (const recipient of recipients) {
            try {
                console.log(`Minting for ${recipient}...`);
                
                // Find the notice data for this recipient
                const noticeData = originalData.batchNotices?.find(n => n.recipient === recipient) || {
                    recipient,
                    encryptedIPFS: originalData.ipfsHash || '',
                    encryptionKey: originalData.encryptionKey || '',
                    issuingAgency: originalData.agency || 'Legal Services',
                    noticeType: originalData.noticeType || 'legal_notice',
                    caseNumber: originalData.caseNumber || '',
                    caseDetails: originalData.caseDetails || originalData.noticeText || '',
                    legalRights: 'View full document at www.BlockServed.com for info on your rights and next steps',
                    sponsorFees: false,
                    metadataURI: originalData.metadataURI || ''
                };
                
                const tx = await this.instance.serveNotice(
                    noticeData.recipient,
                    noticeData.encryptedIPFS,
                    noticeData.encryptionKey,
                    noticeData.issuingAgency,
                    noticeData.noticeType,
                    noticeData.caseNumber,
                    noticeData.caseDetails,
                    noticeData.legalRights,
                    noticeData.sponsorFees,
                    noticeData.metadataURI
                ).send({
                    feeLimit: 500000000,
                    callValue: feePerRecipient, // Contract handles both Alert + Document in one fee
                    shouldPollResponse: true
                });
                
                results.push({
                    recipient,
                    txId: tx,
                    success: true
                });
                
                console.log(`✅ Successfully minted for ${recipient}`);
                
            } catch (error) {
                console.error(`Failed for ${recipient}:`, error);
                results.push({
                    recipient,
                    error: error.message,
                    success: false
                });
            }
        }
        
        return {
            success: results.some(r => r.success),
            results,
            successCount: results.filter(r => r.success).length,
            failedCount: results.filter(r => !r.success).length,
            message: `Minted for ${results.filter(r => r.success).length} of ${recipients.length} selected recipients`
        };
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
            
            // Ensure metadata is always valid
            const metadataUri = metadata ? 
                'data:application/json;base64,' + btoa(JSON.stringify(metadata)) :
                'data:application/json;base64,e30=';  // e30= is {} in base64
            
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