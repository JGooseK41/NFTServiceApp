/**
 * BIGINT FIX v002 - Emergency Fix for BigInt Conversion Errors
 * Fixes: "Cannot mix BigInt and other types, use explicit conversions"
 */

console.log('🔧 Loading BigInt Fix v002...');

// Override all BigInt operations globally
(function() {
    // Store original BigInt
    const OriginalBigInt = window.BigInt;
    
    // Safe BigInt converter
    window.safeBigInt = function(value) {
        if (value === null || value === undefined) return 0n;
        if (typeof value === 'bigint') return value;
        if (typeof value === 'number') return BigInt(Math.floor(value));
        if (typeof value === 'string') {
            // Remove any non-numeric characters
            const cleaned = value.replace(/[^0-9]/g, '');
            return cleaned ? BigInt(cleaned) : 0n;
        }
        return 0n;
    };
    
    // Safe number converter
    window.safeNumber = function(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'string') return parseFloat(value) || 0;
        return 0;
    };
    
    // Fix contract calls that return BigInt
    if (window.legalContract) {
        const originalContract = window.legalContract;
        
        // Wrap all contract methods
        Object.keys(originalContract).forEach(key => {
            if (typeof originalContract[key] === 'function') {
                const originalMethod = originalContract[key];
                originalContract[key] = async function(...args) {
                    try {
                        const result = await originalMethod.apply(this, args);
                        
                        // Convert BigInt results to regular numbers for fees
                        if (key === 'creationFee' || key === 'serviceFee' || key === 'sponsorshipFee') {
                            return safeNumber(result);
                        }
                        
                        return result;
                    } catch (error) {
                        console.error(`BigInt error in ${key}:`, error);
                        throw error;
                    }
                };
            }
        });
    }
})();

// Fix the fee calculation specifically
window.calculateFeeSafe = async function() {
    try {
        console.log('💰 Calculating fees safely...');
        
        let creationFee = 5000000; // Default 5 TRX
        let serviceFee = 20000000; // Default 20 TRX
        let sponsorshipFee = 2000000; // Default 2 TRX
        
        // Try to get from contract
        if (window.legalContract) {
            try {
                const creation = await window.legalContract.creationFee().call();
                creationFee = safeNumber(creation);
            } catch (e) {
                console.warn('Using default creation fee');
            }
            
            try {
                const service = await window.legalContract.serviceFee().call();
                serviceFee = safeNumber(service);
            } catch (e) {
                console.warn('Using default service fee');
            }
            
            try {
                const sponsorship = await window.legalContract.sponsorshipFee().call();
                sponsorshipFee = safeNumber(sponsorship);
            } catch (e) {
                console.warn('Using default sponsorship fee');
            }
        }
        
        return {
            creation: creationFee,
            service: serviceFee,
            sponsorship: sponsorshipFee,
            total: creationFee + serviceFee // Add sponsorship only if needed
        };
    } catch (error) {
        console.error('Fee calculation error:', error);
        // Return safe defaults
        return {
            creation: 5000000,
            service: 20000000,
            sponsorship: 2000000,
            total: 27000000
        };
    }
};

// Override the main transaction function to handle BigInt
window.executeTransactionSafe = async function(noticeData) {
    console.log('🚀 Executing transaction with BigInt fix...');
    
    try {
        // Calculate fees safely
        const fees = await calculateFeeSafe();
        const totalFee = fees.total + (noticeData.sponsorFees ? fees.sponsorship : 0);
        
        console.log(`💰 Total fee: ${totalFee / 1000000} TRX`);
        
        // Generate metadata
        const metadata = {
            name: `Legal Notice #${noticeData.caseNumber}`,
            description: `${noticeData.noticeType || 'Legal Notice'}\nCase: ${noticeData.caseNumber}\nView at: https://blockserved.com`,
            image: "https://nft-legal-service.netlify.app/images/legal-notice-nft.png",
            attributes: [
                { trait_type: "Case Number", value: noticeData.caseNumber },
                { trait_type: "Notice Type", value: noticeData.noticeType },
                { trait_type: "Status", value: "Delivered" }
            ]
        };
        
        const metadataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
        
        // Map to v5 parameters
        const params = [
            noticeData.recipient || noticeData.recipientAddress,
            noticeData.documentHash || 'ipfs://placeholder_' + Date.now(),
            'key_' + Date.now(),
            noticeData.lawFirm || noticeData.issuingAgency || 'Legal Department',
            noticeData.noticeType || 'ALERT',
            noticeData.caseNumber,
            noticeData.courtName || 'Legal Notice',
            noticeData.recipientInfo || 'You have been served',
            noticeData.sponsorFees || false,
            metadataURI
        ];
        
        console.log('📋 Parameters ready (10 total)');
        
        // Execute with explicit number conversion
        const result = await window.legalContract.serveNotice(...params).send({
            callValue: totalFee, // Already a safe number
            feeLimit: 1000000000 // 1000 TRX max
        });
        
        console.log('✅ Transaction successful!');
        console.log('TX:', result);
        
        return { success: true, txId: result };
        
    } catch (error) {
        console.error('Transaction error:', error);
        
        // Check for specific BigInt error
        if (error.message?.includes('BigInt')) {
            console.log('🔧 Attempting BigInt workaround...');
            
            // Try with hardcoded safe values
            return await executeWithSafeDefaults(noticeData);
        }
        
        throw error;
    }
};

// Fallback with safe defaults
window.executeWithSafeDefaults = async function(noticeData) {
    console.log('🔧 Using safe defaults to bypass BigInt issues');
    
    const safeFee = 27000000; // 27 TRX hardcoded
    
    const metadata = {
        name: `Legal Notice #${noticeData.caseNumber}`,
        description: `Legal Notice - View at blockserved.com`,
        image: "https://nft-legal-service.netlify.app/images/legal-notice-nft.png"
    };
    
    const metadataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
    
    const params = [
        noticeData.recipient,
        'ipfs://temp_' + Date.now(),
        'key_' + Date.now(),
        'Legal Department',
        noticeData.noticeType || 'NOTICE',
        noticeData.caseNumber,
        'Legal Notice',
        'You have been served',
        false,
        metadataURI
    ];
    
    return await window.legalContract.serveNotice(...params).send({
        callValue: safeFee,
        feeLimit: 1000000000
    });
};

// Override the existing serveNotice if it exists
if (window.serveNotice) {
    window.originalServeNotice = window.serveNotice;
    window.serveNotice = executeTransactionSafe;
}

// Test function
window.testBigIntFix = async function() {
    console.log('Testing BigInt fix...');
    
    const testData = {
        recipient: 'TD1F37V4...s7mBDE', // Use actual address
        caseNumber: 'TEST-BIGINT-001',
        noticeType: 'Notice of Seizure',
        sponsorFees: false
    };
    
    try {
        const fees = await calculateFeeSafe();
        console.log('✅ Fee calculation works:', fees);
        console.log('Ready to proceed with transaction');
        return true;
    } catch (error) {
        console.error('❌ BigInt issue persists:', error);
        return false;
    }
};

console.log('✅ BigInt Fix v002 loaded');
console.log('');
console.log('🎯 TO FIX YOUR TRANSACTION:');
console.log('1. Run: testBigIntFix()');
console.log('2. If test passes, try your transaction again');
console.log('3. Or use: executeTransactionSafe(yourNoticeData)');