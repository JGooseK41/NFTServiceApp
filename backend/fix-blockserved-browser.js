/**
 * Fix BlockServed - Browser Console Script
 * Run this in the browser console on BlockServed.com to make it work
 */

// Override the fetchNotices function to get data from localStorage and backend
window.fetchNotices = async function() {
    console.log('🔍 Fetching notices for wallet:', walletAddress);
    
    // First, try the backend with correct endpoint
    try {
        const backendUrl = 'https://nftserviceapp.onrender.com';
        const response = await fetch(`${backendUrl}/api/cases?status=served`);
        
        if (response.ok) {
            const data = await response.json();
            const cases = data.cases || [];
            
            // Filter for cases where this wallet is a recipient
            const myNotices = [];
            
            for (const caseData of cases) {
                const recipients = caseData.recipients || [];
                
                // Check if current wallet is in recipients
                if (recipients.some(r => r.toLowerCase() === walletAddress.toLowerCase())) {
                    myNotices.push({
                        notice_id: `NFT-${caseData.alert_token_id || caseData.alertTokenId || 'pending'}`,
                        alert_token_id: caseData.alert_token_id || caseData.alertTokenId,
                        document_token_id: caseData.document_token_id || caseData.documentTokenId,
                        case_number: caseData.case_number || caseData.caseNumber,
                        notice_type: caseData.noticeType || 'Legal Notice',
                        issuing_agency: caseData.agency || caseData.metadata?.agency || caseData.metadata?.issuingAgency || 'Legal Services',
                        created_at: caseData.served_at || caseData.servedAt || new Date().toISOString(),
                        ipfs_document: caseData.ipfs_hash || caseData.ipfsHash || caseData.metadata?.ipfsHash,
                        encryption_key: caseData.encryption_key || caseData.encryptionKey,
                        has_document: true,
                        accepted: false,
                        transaction_hash: caseData.transaction_hash || caseData.transactionHash
                    });
                }
            }
            
            if (myNotices.length > 0) {
                console.log('✅ Found notices from backend:', myNotices);
                window.notices = myNotices;
                displayNotices();
                return;
            }
        }
    } catch (error) {
        console.log('Backend fetch error:', error);
    }
    
    // Fallback: Check localStorage on theblockservice.com
    const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
    const myLocalNotices = [];
    
    for (const caseData of localCases) {
        const recipients = caseData.recipients || [];
        
        if (recipients.some(r => r.toLowerCase() === walletAddress.toLowerCase())) {
            myLocalNotices.push({
                notice_id: `NFT-${caseData.alertTokenId || 'pending'}`,
                alert_token_id: caseData.alertTokenId,
                document_token_id: caseData.documentTokenId,
                case_number: caseData.caseNumber || caseData.case_number,
                notice_type: caseData.noticeType || 'Legal Notice',
                issuing_agency: caseData.agency || caseData.issuingAgency || 'Legal Services',
                created_at: caseData.servedAt || caseData.served_at || new Date().toISOString(),
                ipfs_document: caseData.ipfsHash || caseData.ipfsDocument,
                encryption_key: caseData.encryptionKey || caseData.encryption_key,
                has_document: true,
                accepted: false,
                transaction_hash: caseData.transactionHash
            });
        }
    }
    
    if (myLocalNotices.length > 0) {
        console.log('✅ Found notices from localStorage:', myLocalNotices);
        window.notices = myLocalNotices;
    } else {
        console.log('❌ No notices found for this wallet');
        window.notices = [];
    }
    
    displayNotices();
};

// Override viewDocument to handle IPFS decryption
window.viewDocument = async function(ipfsHash, encryptionKey) {
    if (!ipfsHash) {
        alert('No document available for this notice');
        return;
    }
    
    console.log('📄 Viewing document:', ipfsHash);
    
    // Show loading
    const viewer = document.getElementById('documentViewer');
    if (viewer) {
        viewer.style.display = 'block';
        viewer.innerHTML = `
            <div class="text-center" style="padding: 50px;">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="text-white mt-3">Loading document from IPFS...</p>
                <button class="btn btn-secondary mt-3" onclick="document.getElementById('documentViewer').style.display='none'">Cancel</button>
            </div>
        `;
    }
    
    try {
        // Try to fetch from IPFS
        const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        const response = await fetch(ipfsUrl);
        
        if (!response.ok) {
            throw new Error('Failed to fetch from IPFS');
        }
        
        const encryptedData = await response.arrayBuffer();
        
        // If we have an encryption key, decrypt
        if (encryptionKey) {
            console.log('🔐 Decrypting document...');
            
            // Decrypt using Web Crypto API (AES-256-GCM)
            const decrypted = await decryptDocument(encryptedData, encryptionKey);
            
            // Create blob and show
            const blob = new Blob([decrypted], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            viewer.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column;">
                    <div style="padding: 10px; background: white; display: flex; justify-content: space-between;">
                        <h5>Legal Document</h5>
                        <button class="btn btn-danger" onclick="document.getElementById('documentViewer').style.display='none'">
                            <i class="bi bi-x-circle"></i> Close
                        </button>
                    </div>
                    <iframe src="${url}" style="flex: 1; width: 100%; border: none;"></iframe>
                </div>
            `;
        } else {
            // No encryption, show directly
            const blob = new Blob([encryptedData], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            viewer.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column;">
                    <div style="padding: 10px; background: white; display: flex; justify-content: space-between;">
                        <h5>Legal Document</h5>
                        <button class="btn btn-danger" onclick="document.getElementById('documentViewer').style.display='none'">
                            <i class="bi bi-x-circle"></i> Close
                        </button>
                    </div>
                    <iframe src="${url}" style="flex: 1; width: 100%; border: none;"></iframe>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading document:', error);
        viewer.innerHTML = `
            <div class="text-center" style="padding: 50px;">
                <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                <p class="text-white mt-3">Failed to load document: ${error.message}</p>
                <button class="btn btn-secondary mt-3" onclick="document.getElementById('documentViewer').style.display='none'">Close</button>
            </div>
        `;
    }
};

// Decryption helper
async function decryptDocument(encryptedBuffer, keyHex) {
    try {
        const IV_LENGTH = 16;
        const TAG_LENGTH = 16;
        
        const encrypted = new Uint8Array(encryptedBuffer);
        const iv = encrypted.slice(0, IV_LENGTH);
        const authTag = encrypted.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const ciphertext = encrypted.slice(IV_LENGTH + TAG_LENGTH);
        
        // Combine ciphertext and auth tag for Web Crypto API
        const dataWithTag = new Uint8Array(ciphertext.length + authTag.length);
        dataWithTag.set(ciphertext);
        dataWithTag.set(authTag, ciphertext.length);
        
        // Convert hex key to buffer
        const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        
        // Import the key
        const key = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        
        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            dataWithTag
        );
        
        return decrypted;
        
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt document');
    }
}

// Auto-refresh notices
console.log('==================================');
console.log('🔧 BlockServed Fix Applied!');
console.log('==================================');
console.log('Refreshing notices...');
fetchNotices();

console.log('\n💡 If you see no notices, make sure:');
console.log('1. You are connected with the correct recipient wallet');
console.log('2. The wallet address was included as a recipient when the notice was served');
console.log('3. Try these test wallets that have notices:');
console.log('   - TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE');
console.log('   - TAr8S97Xw3xhrGkZSghXQ85SFuP5XDU4cF');