/**
 * DEBUG ACCESS DENIAL
 * Investigates why access is being denied and fixes metadata display
 */

console.log('🔍 DEBUGGING ACCESS DENIAL AND METADATA ISSUES');
console.log('=' .repeat(70));

window.DebugAccess = {
    
    async checkCurrentWallet() {
        const wallet = window.tronWeb?.defaultAddress?.base58;
        if (!wallet) {
            console.log('❌ No wallet connected');
            return null;
        }
        
        console.log(`\n📱 Current wallet: ${wallet}`);
        return wallet;
    },
    
    async checkNotice19() {
        console.log('\n🔍 Checking Notice #19 specifically...\n');
        
        const wallet = await this.checkCurrentWallet();
        if (!wallet) return;
        
        // First, check IPFS metadata
        console.log('1️⃣ Fetching IPFS metadata...');
        try {
            const response = await fetch('https://gateway.pinata.cloud/ipfs/QmNXdo5dyHsWVPsvNsQFgkHtKCMPbENjGayBADvY9kSVDs');
            const metadata = await response.json();
            
            console.log('✅ IPFS Metadata:');
            console.log('  Case Number:', metadata.attributes?.find(a => a.trait_type === 'Case Number')?.value);
            console.log('  Type:', metadata.attributes?.find(a => a.trait_type === 'Type')?.value);
            console.log('  Issuing Agency:', metadata.attributes?.find(a => a.trait_type === 'Issuing Agency')?.value);
            console.log('  Status:', metadata.attributes?.find(a => a.trait_type === 'Status')?.value);
            
            // Store this for fixing the display
            window.notice19Metadata = metadata;
        } catch (e) {
            console.log('❌ Error fetching IPFS:', e.message);
        }
        
        // Check backend access
        console.log('\n2️⃣ Checking backend access control...');
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/notices/19/images', {
                headers: {
                    'X-Wallet-Address': wallet,
                    'X-Server-Address': wallet
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('✅ Backend Access GRANTED');
                console.log('  You are the:', data.accessType);
                console.log('  Server address:', data.serverAddress);
                console.log('  Recipient address:', data.recipientAddress);
                console.log('  Your wallet:', wallet);
            } else if (response.status === 403) {
                console.log('❌ Backend Access DENIED');
                console.log('  Notice server:', data.serverAddress || 'unknown');
                console.log('  Notice recipient:', data.recipientAddress || 'unknown');
                console.log('  Your wallet:', wallet);
                console.log('\n⚠️ You are neither the server nor recipient of this notice');
            } else if (response.status === 404) {
                console.log('⚠️ Notice #19 not found in backend database');
                console.log('This notice may not have been saved to backend yet');
            }
        } catch (e) {
            console.log('❌ Backend error:', e.message);
        }
        
        // Check who owns the NFTs
        console.log('\n3️⃣ Checking NFT ownership on blockchain...');
        try {
            const alertContract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
            const documentContract = await window.tronWeb.contract().at('TJn49f8VpGEV4d9KJN58rxPL2FdCzLXRmR');
            
            // Alert #19 owner
            const alertOwner = await alertContract.ownerOf(19).call();
            console.log(`  Alert #19 owner: ${alertOwner}`);
            console.log(`  Is you: ${alertOwner?.toLowerCase() === wallet.toLowerCase()}`);
            
            // Document #20 owner (even number for document)
            const docOwner = await documentContract.ownerOf(20).call();
            console.log(`  Document #20 owner: ${docOwner}`);
            console.log(`  Is you: ${docOwner?.toLowerCase() === wallet.toLowerCase()}`);
            
        } catch (e) {
            console.log('❌ Error checking NFT ownership:', e.message);
        }
    },
    
    async fixMetadataDisplay() {
        console.log('\n🔧 Fixing metadata display in restricted access modal...');
        
        // Fix the DocumentAccessControl to properly fetch and display metadata
        if (window.DocumentAccessControl) {
            const originalVerifyRecipient = window.DocumentAccessControl.prototype.verifyRecipient;
            
            window.DocumentAccessControl.prototype.verifyRecipient = async function(walletAddress, alertTokenId, documentTokenId) {
                // First fetch public info from IPFS if available
                try {
                    // Try to get metadata from blockchain
                    const alertContract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
                    const tokenURI = await alertContract.tokenURI(alertTokenId).call();
                    
                    if (tokenURI && tokenURI.includes('ipfs')) {
                        const ipfsHash = tokenURI.replace('ipfs://', '');
                        const metadataResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
                        const metadata = await metadataResponse.json();
                        
                        // Extract public info from metadata
                        this.publicInfo = {
                            caseNumber: metadata.attributes?.find(a => a.trait_type === 'Case Number')?.value || 'N/A',
                            noticeType: metadata.attributes?.find(a => a.trait_type === 'Type')?.value || 'Legal Notice',
                            issuingAgency: metadata.attributes?.find(a => a.trait_type === 'Issuing Agency')?.value || 'N/A',
                            status: metadata.attributes?.find(a => a.trait_type === 'Status')?.value || 'Pending'
                        };
                        
                        console.log('📋 Extracted public info:', this.publicInfo);
                    }
                } catch (e) {
                    console.log('Could not fetch IPFS metadata:', e.message);
                }
                
                // Call original function
                return originalVerifyRecipient.call(this, walletAddress, alertTokenId, documentTokenId);
            };
            
            console.log('✅ DocumentAccessControl patched to fetch IPFS metadata');
        }
        
        // Also create a global function to manually trigger the modal with correct data
        window.showNotice19Access = function() {
            const modal = document.createElement('div');
            modal.className = 'access-info-modal';
            
            const metadata = window.notice19Metadata || {};
            const attrs = metadata.attributes || [];
            
            modal.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                            background: rgba(0,0,0,0.8); z-index: 10000; 
                            display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 30px; border-radius: 12px; 
                                max-width: 500px; text-align: center;">
                        <h2 style="color: #2196F3; margin-bottom: 20px;">
                            📄 Notice #19 Information
                        </h2>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; 
                                    text-align: left; margin-bottom: 20px;">
                            <h3 style="margin-bottom: 10px; color: #333;">
                                Public Information:
                            </h3>
                            <ul style="color: #666; margin: 0; padding-left: 20px; list-style: none;">
                                <li>📋 Case Number: <strong>${attrs.find(a => a.trait_type === 'Case Number')?.value || 'N/A'}</strong></li>
                                <li>📑 Type: <strong>${attrs.find(a => a.trait_type === 'Type')?.value || 'N/A'}</strong></li>
                                <li>🏛️ Issuing Agency: <strong>${attrs.find(a => a.trait_type === 'Issuing Agency')?.value || 'N/A'}</strong></li>
                                <li>✅ Status: <strong>${attrs.find(a => a.trait_type === 'Status')?.value || 'N/A'}</strong></li>
                                <li>📅 Date Issued: <strong>${attrs.find(a => a.trait_type === 'Date Issued')?.value || 'N/A'}</strong></li>
                            </ul>
                        </div>
                        
                        <p style="color: #666; margin-bottom: 20px;">
                            To view the full document, you must be either the process server who sent this notice 
                            or the recipient it was sent to.
                        </p>
                        
                        <button onclick="this.closest('.access-info-modal').remove()" 
                                style="background: #2196F3; color: white; border: none; 
                                       padding: 12px 30px; border-radius: 6px; cursor: pointer; 
                                       font-size: 16px;">
                            Close
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        };
        
        console.log('✅ Created showNotice19Access() function');
    },
    
    async checkAllNotices() {
        console.log('\n📊 Checking all your notices...\n');
        
        const wallet = await this.checkCurrentWallet();
        if (!wallet) return;
        
        // Check served notices
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/notices/my-served', {
                headers: {
                    'X-Wallet-Address': wallet,
                    'X-Server-Address': wallet
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ You have served ${data.totalNotices} notices`);
                
                if (data.notices?.length > 0) {
                    console.log('\nYour served notices:');
                    data.notices.forEach(n => {
                        console.log(`  - Notice #${n.notice_id || n.alert_id} to ${n.recipient_address?.substring(0, 10)}...`);
                    });
                }
            }
        } catch (e) {
            console.log('Error checking served notices:', e.message);
        }
        
        // Check received notices
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/notices/my-received', {
                headers: {
                    'X-Wallet-Address': wallet
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`\n✅ You have received ${data.totalNotices} notices`);
                
                if (data.notices?.length > 0) {
                    console.log('\nYour received notices:');
                    data.notices.forEach(n => {
                        console.log(`  - Notice #${n.notice_id || n.alert_id} from ${n.server_address?.substring(0, 10)}...`);
                    });
                }
            }
        } catch (e) {
            console.log('Error checking received notices:', e.message);
        }
    }
};

// Auto-run checks
console.log('\n🚀 Running automatic checks...');
DebugAccess.checkNotice19();
DebugAccess.fixMetadataDisplay();

console.log('\n📚 Available commands:');
console.log('  DebugAccess.checkNotice19() - Check why Notice #19 access is denied');
console.log('  DebugAccess.checkAllNotices() - See all your served/received notices');
console.log('  DebugAccess.fixMetadataDisplay() - Fix undefined metadata in modal');
console.log('  showNotice19Access() - Show Notice #19 info with correct metadata');