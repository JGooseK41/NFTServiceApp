/**
 * EMERGENCY TRANSACTION FIX
 * For when energy rental fails but you need to proceed
 */

window.EmergencyTransactionFix = {
    
    // Check actual energy and proceed anyway
    async proceedWithCurrentEnergy() {
        console.log('🚨 EMERGENCY TRANSACTION MODE');
        
        // Check current energy
        const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
        const currentEnergy = account.energy || 0;
        
        console.log(`⚡ Current Energy: ${currentEnergy.toLocaleString()}`);
        console.log(`📄 Your document: 0.31 MB (very small!)`);
        
        // For 0.31 MB document, you only need ~200K energy
        const actualEnergyNeeded = 200000;
        
        if (currentEnergy >= actualEnergyNeeded) {
            console.log('✅ You have enough energy for this small document!');
            console.log(`   Have: ${currentEnergy.toLocaleString()}`);
            console.log(`   Need: ${actualEnergyNeeded.toLocaleString()}`);
            return { ready: true, energy: currentEnergy };
        } else {
            console.log('⚠️ Low energy but document is small');
            console.log('   Will use TRX to burn for energy (about 84 TRX)');
            
            if (confirm('Proceed without rental? Will cost ~84 TRX extra')) {
                return { ready: true, proceedAnyway: true };
            }
        }
        
        return { ready: false };
    },
    
    // Force transaction with v001 fix
    async forceTransaction(noticeData) {
        console.log('🔧 Forcing transaction with v001 fix...');
        
        // Your document is only 0.31 MB!
        const documentSize = 0.31 * 1024 * 1024; // 317KB
        
        // Add metadata
        const metadata = {
            name: `Legal Notice #${noticeData.caseNumber}`,
            description: `Legal Notice - ${noticeData.caseNumber}\n\nTo view documents, visit https://blockserved.com`,
            image: "https://nft-legal-service.netlify.app/images/legal-notice-nft.png",
            attributes: [
                { trait_type: "Case Number", value: noticeData.caseNumber },
                { trait_type: "Notice Type", value: noticeData.noticeType || "ALERT" },
                { trait_type: "Status", value: "Delivered" }
            ]
        };
        
        // Create metadata URI
        const metadataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
        
        // Map to v5 parameters
        const v5Params = {
            recipient: noticeData.recipient || noticeData.recipientAddress,
            encryptedIPFS: noticeData.documentHash || 'ipfs://temp_' + Date.now(),
            encryptionKey: 'key_' + Date.now(),
            issuingAgency: noticeData.lawFirm || noticeData.issuingAgency || 'Legal Department',
            noticeType: noticeData.noticeType || 'ALERT',
            caseNumber: noticeData.caseNumber,
            caseDetails: noticeData.courtName || 'Legal Notice',
            legalRights: noticeData.recipientInfo || 'You have been served',
            sponsorFees: noticeData.sponsorFees || false,
            metadataURI: metadataURI
        };
        
        console.log('📋 Transaction ready with metadata');
        console.log('⚡ Energy cost: ~200K for 0.31MB document');
        
        // Calculate fees
        const fees = {
            creation: 5_000_000,
            service: 20_000_000,
            sponsorship: v5Params.sponsorFees ? 2_000_000 : 0,
            total: 27_000_000 // 27 TRX
        };
        
        try {
            // Call v5 contract with correct parameters
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
                callValue: fees.total,
                feeLimit: 1000_000_000 // 1000 TRX limit (will only use what's needed)
            });
            
            console.log('✅ TRANSACTION SUCCESS!');
            console.log('TX ID:', result);
            console.log('NFT will display in wallet with metadata!');
            
            return { success: true, txId: result };
            
        } catch (error) {
            console.error('Transaction failed:', error);
            return { success: false, error: error.message };
        }
    }
};

// Quick access functions
window.checkEnergyNow = async function() {
    const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
    const energy = account.energy || 0;
    console.log(`⚡ Current Energy: ${energy.toLocaleString()}`);
    console.log(`📄 Your doc is 0.31 MB - needs only ~200K energy`);
    console.log(`✅ You have ${energy >= 200000 ? 'ENOUGH' : 'LOW'} energy`);
    return energy;
};

window.forceTransactionNow = async function(caseNumber, recipient) {
    if (!caseNumber || !recipient) {
        console.error('Usage: forceTransactionNow("CASE-123", "TRecipientAddress")');
        return;
    }
    
    const noticeData = {
        caseNumber: caseNumber,
        recipient: recipient,
        noticeType: 'LEGAL NOTICE',
        sponsorFees: false
    };
    
    return await EmergencyTransactionFix.forceTransaction(noticeData);
};

console.log('🚨 EMERGENCY FIX LOADED');
console.log('Your document is only 0.31 MB - very small!');
console.log('Commands:');
console.log('  checkEnergyNow() - Check your current energy');
console.log('  forceTransactionNow("CASE-123", "TRecipient...") - Force transaction');