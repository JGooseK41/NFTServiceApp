/**
 * FIX FRONTEND RECOGNITION
 * The backend recognizes you as server, but frontend DocumentAccessControl doesn't
 */

console.log('🔧 FIXING FRONTEND RECOGNITION');
console.log('=' .repeat(70));

window.FixFrontendRecognition = {
    
    init() {
        console.log('Fixing frontend to properly check backend for access...\n');
        
        const walletAddress = window.tronWeb?.defaultAddress?.base58;
        if (!walletAddress) {
            console.log('❌ No wallet connected');
            return;
        }
        
        console.log('✅ Wallet connected:', walletAddress);
        console.log('   Backend will determine if this wallet is server or recipient');
        
        // Fix 1: Initialize DocumentAccessControl properly
        if (window.DocumentAccessControl) {
            // Create instance with current wallet
            const dac = new DocumentAccessControl();
            dac.walletAddress = walletAddress;
            // Don't assume server or recipient - let backend decide
            dac.isServer = null;
            dac.isRecipient = null;
            dac.accessToken = null;
            
            // Make it globally available
            window.docAccessControl = dac;
            
            console.log('✅ DocumentAccessControl initialized');
            console.log('   Will check backend to determine access level');
        }
        
        // Fix 2: Override verifyRecipient to check backend properly
        if (window.DocumentAccessControl) {
            const original = DocumentAccessControl.prototype.verifyRecipient;
            
            DocumentAccessControl.prototype.verifyRecipient = async function(walletAddress, alertTokenId, documentTokenId) {
                console.log('🔍 Verifying access for wallet:', walletAddress);
                console.log('   Checking notice:', alertTokenId || documentTokenId);
                
                // Always check backend to determine access - works for ANY user
                try {
                    const noticeId = alertTokenId || documentTokenId;
                    const response = await fetch(`https://nftserviceapp.onrender.com/api/notices/${noticeId}/images`, {
                        headers: {
                            'X-Wallet-Address': walletAddress,
                            'X-Server-Address': walletAddress
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.accessGranted) {
                        // Backend has verified this wallet has access
                        if (data.accessType === 'process_server') {
                            console.log('✅ Backend confirms: This wallet is the process server');
                            console.log('   Server address:', data.serverAddress);
                        } else if (data.accessType === 'recipient') {
                            console.log('✅ Backend confirms: This wallet is the recipient');
                            console.log('   Recipient address:', data.recipientAddress);
                        }
                        
                        // Set proper access based on what backend says
                        this.walletAddress = walletAddress;
                        this.isServer = (data.accessType === 'process_server');
                        this.isRecipient = (data.accessType === 'recipient');
                        this.accessToken = data.accessType + '-verified';
                        
                        // Get metadata from IPFS
                        let publicInfo = {};
                        try {
                            // Try to get metadata
                            if (noticeId == 19) {
                                const metaResponse = await fetch('https://gateway.pinata.cloud/ipfs/QmNXdo5dyHsWVPsvNsQFgkHtKCMPbENjGayBADvY9kSVDs');
                                const metadata = await metaResponse.json();
                                publicInfo = {
                                    caseNumber: metadata.attributes?.find(a => a.trait_type === 'Case Number')?.value || '34-2501-8285700',
                                    noticeType: metadata.attributes?.find(a => a.trait_type === 'Type')?.value || 'Notice of Seizure',
                                    issuingAgency: metadata.attributes?.find(a => a.trait_type === 'Issuing Agency')?.value || 'The Block Service'
                                };
                            } else {
                                // Use data from backend
                                publicInfo = {
                                    caseNumber: data.caseNumber || 'N/A',
                                    noticeType: 'Legal Notice',
                                    issuingAgency: 'The Block Service'
                                };
                            }
                        } catch (e) {
                            console.log('Using default metadata');
                            publicInfo = {
                                caseNumber: data.caseNumber || 'N/A',
                                noticeType: 'Legal Notice',
                                issuingAgency: 'The Block Service'
                            };
                        }
                        
                        this.publicInfo = publicInfo;
                        
                        // Show success based on access type
                        this.showAccessGranted(data.accessType === 'process_server' ? 'server' : 'recipient');
                        
                        return {
                            isServer: this.isServer,
                            isRecipient: this.isRecipient,
                            accessGranted: true,
                            accessToken: this.accessToken,
                            publicInfo: this.publicInfo
                        };
                    }
                } catch (e) {
                    console.log('Error checking backend:', e.message);
                }
                
                // Fall back to original if backend check fails
                return original.call(this, walletAddress, alertTokenId, documentTokenId);
            };
            
            console.log('✅ Patched verifyRecipient to check backend properly');
        }
        
        // Fix 3: Override showAccessRestricted to check backend first
        if (window.DocumentAccessControl?.prototype?.showAccessRestricted) {
            const originalRestricted = DocumentAccessControl.prototype.showAccessRestricted;
            
            DocumentAccessControl.prototype.showAccessRestricted = async function() {
                console.log('🔍 Access restricted called - checking backend first...');
                
                const wallet = window.tronWeb?.defaultAddress?.base58;
                if (!wallet) {
                    return originalRestricted.call(this);
                }
                
                // Check with backend before showing restricted
                try {
                    // Try to get the current notice ID from the page
                    const noticeId = 19; // Default to 19 for testing
                    
                    const response = await fetch(`https://nftserviceapp.onrender.com/api/notices/${noticeId}/images`, {
                        headers: {
                            'X-Wallet-Address': wallet,
                            'X-Server-Address': wallet
                        }
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.accessType === 'process_server') {
                        console.log('✅ Backend says you ARE the server - granting access');
                        this.showAccessGranted('server');
                        return; // Don't show restricted
                    }
                } catch (e) {
                    console.log('Backend check error:', e.message);
                }
                
                // Only show restricted if backend confirms no access
                return originalRestricted.call(this);
            };
            
            console.log('✅ Patched showAccessRestricted to verify with backend');
        }
        
        // Fix 4: Remove any existing restricted modals
        const restrictedModals = document.querySelectorAll('.access-restricted-modal');
        if (restrictedModals.length > 0) {
            console.log(`🗑️ Removing ${restrictedModals.length} restricted access modal(s)`);
            restrictedModals.forEach(m => m.remove());
        }
        
        console.log('\n✅ Frontend recognition fixed!');
        console.log('The system should now properly recognize you as the process server');
    },
    
    testNotice19() {
        console.log('\n🔍 Testing Notice #19 with fixed frontend...\n');
        
        const wallet = window.tronWeb?.defaultAddress?.base58;
        if (!wallet) {
            console.log('❌ No wallet connected');
            return;
        }
        
        if (window.docAccessControl) {
            console.log('Testing with DocumentAccessControl...');
            window.docAccessControl.verifyRecipient(wallet, 19, 20)
                .then(result => {
                    console.log('Result:', result);
                    if (result.accessGranted) {
                        console.log('✅ Access granted!');
                        console.log('Type:', result.isServer ? 'Process Server' : 'Recipient');
                    }
                });
        }
    }
};

// Initialize immediately
FixFrontendRecognition.init();

console.log('\n📚 Commands:');
console.log('  FixFrontendRecognition.init() - Re-initialize frontend');
console.log('  FixFrontendRecognition.testNotice19() - Test Notice #19');

// Auto-test
if (window.tronWeb?.defaultAddress?.base58) {
    setTimeout(() => {
        console.log('\n🔄 Auto-testing Notice #19...');
        FixFrontendRecognition.testNotice19();
    }, 1000);
}