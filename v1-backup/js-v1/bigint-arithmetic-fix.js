/**
 * BIGINT ARITHMETIC FIX
 * Fixes "Cannot mix BigInt and other types" errors throughout the application
 */

console.log('🔧 Loading BigInt Arithmetic Fix...');

// Override the ContractFixV001 calculateFees to handle BigInt properly
if (window.ContractFixV001) {
    const original = window.ContractFixV001.calculateFees;
    
    window.ContractFixV001.calculateFees = async function(sponsorFees = false) {
        console.log('📊 Calculating fees with BigInt safety...');
        
        let creationFee = 5_000_000; // Default 5 TRX
        let serviceFee = 20_000_000; // Default 20 TRX
        let sponsorshipFee = 0;
        
        try {
            // Get fees from contract (returns BigInt)
            if (window.legalContract) {
                const creation = await window.legalContract.creationFee().call();
                const service = await window.legalContract.serviceFee().call();
                
                // Convert BigInt to Number safely
                creationFee = typeof creation === 'bigint' ? Number(creation) : creation;
                serviceFee = typeof service === 'bigint' ? Number(service) : service;
                
                if (sponsorFees) {
                    const sponsorship = await window.legalContract.sponsorshipFee().call();
                    sponsorshipFee = typeof sponsorship === 'bigint' ? Number(sponsorship) : sponsorship;
                }
                
                console.log(`Fees: Creation=${creationFee/1e6} TRX, Service=${serviceFee/1e6} TRX, Sponsorship=${sponsorshipFee/1e6} TRX`);
            }
        } catch (error) {
            console.warn('Using default fees:', error);
        }
        
        // Return as regular numbers (not BigInt)
        return {
            total: creationFee + serviceFee + sponsorshipFee,
            creationFee: creationFee,
            serviceFee: serviceFee,
            sponsorshipFee: sponsorshipFee
        };
    };
    
    // Also fix the serveNotice override
    const originalServe = window.serveNotice;
    
    window.serveNotice = async function(noticeData) {
        console.log('🚀 Serving notice with BigInt safety...');
        
        try {
            // Generate metadata
            const metadataURI = await ContractFixV001.generateMetadata(noticeData);
            
            // Prepare encrypted IPFS data
            let encryptedIPFS = '';
            let encryptionKey = '';
            
            if (noticeData.documentHash) {
                encryptedIPFS = noticeData.documentHash;
                encryptionKey = 'key_' + Date.now();
            } else if (noticeData.document) {
                const stored = await ContractFixV001.storeDocument(noticeData.document);
                encryptedIPFS = stored.ipfsHash || '';
                encryptionKey = stored.encryptionKey || '';
            }
            
            // Map parameters
            const v5Params = {
                recipient: noticeData.recipient,
                encryptedIPFS: encryptedIPFS,
                encryptionKey: encryptionKey,
                issuingAgency: noticeData.lawFirm || noticeData.issuingAgency || 'Legal Department',
                noticeType: noticeData.noticeType || 'ALERT',
                caseNumber: noticeData.caseNumber,
                caseDetails: noticeData.courtName || noticeData.caseDetails || 'Legal Notice',
                legalRights: noticeData.recipientInfo || noticeData.legalRights || 'You have been served',
                sponsorFees: noticeData.sponsorFees || false,
                metadataURI: metadataURI
            };
            
            console.log('V5 Parameters:', v5Params);
            
            // Calculate fees with BigInt safety
            const fees = await ContractFixV001.calculateFees(v5Params.sponsorFees);
            console.log(`💰 Total fee: ${fees.total / 1_000_000} TRX`);
            
            // Ensure callValue is a regular number, not BigInt
            const callValueSafe = typeof fees.total === 'bigint' ? Number(fees.total) : fees.total;
            
            // Execute transaction
            const result = await window.legalContract.serveNotice(
                v5Params.recipient,
                v5Params.encryptedIPFS,
                v5Params.encryptionKey,
                v5Params.issuingAgency,
                v5Params.noticeType,
                v5Params.caseNumber,
                v5Params.caseDetails,
                v5Params.legalRights,
                v5Params.sponsorFees,
                v5Params.metadataURI
            ).send({
                callValue: callValueSafe, // Use safe number
                feeLimit: 2000_000_000
            });
            
            console.log('✅ Notice created successfully!');
            console.log('Transaction ID:', result);
            console.log('Metadata URI:', v5Params.metadataURI);
            
            // Log to backend
            ContractFixV001.logToBackend(noticeData, result, v5Params.metadataURI);
            
            // Show success
            if (window.uiManager?.showNotification) {
                window.uiManager.showNotification('success', 
                    `✅ Notice created with metadata! TX: ${result.substring(0, 8)}...`);
            }
            
            return { 
                success: true, 
                txId: result,
                metadataURI: v5Params.metadataURI
            };
            
        } catch (error) {
            console.error('Transaction failed:', error);
            
            // Save for recovery
            if (window.TransactionRecovery) {
                TransactionRecovery.markFailed(null, error);
            }
            
            if (window.uiManager?.showNotification) {
                window.uiManager.showNotification('error', 
                    `Transaction failed: ${error.message}`);
            }
            
            throw error;
        }
    };
}

// Global helper to convert any BigInt to safe number
window.toBigIntSafe = function(value) {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (typeof value === 'string' && value.match(/^\d+$/)) {
        return Number(value);
    }
    return Number(value) || 0;
};

// Override TronWeb toSun/fromSun if they cause issues
if (window.tronWeb) {
    const originalToSun = window.tronWeb.toSun;
    window.tronWeb.toSun = function(trx) {
        const result = originalToSun.call(this, trx);
        // If result is BigInt, convert to Number
        return typeof result === 'bigint' ? Number(result) : result;
    };
    
    const originalFromSun = window.tronWeb.fromSun;
    window.tronWeb.fromSun = function(sun) {
        // Ensure input is safe
        const safeSun = typeof sun === 'bigint' ? Number(sun) : sun;
        return originalFromSun.call(this, safeSun);
    };
}

console.log('✅ BigInt Arithmetic Fix loaded');
console.log('All contract fee calculations now handle BigInt safely');
console.log('Transaction callValue will always be a regular number');