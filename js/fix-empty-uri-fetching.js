/**
 * FIX EMPTY URI FETCHING
 * Prevents errors when tokenURI is empty
 */

console.log('🔧 Fixing empty URI fetch attempts...');

// Store original fetch function if not already stored
if (!window.originalFetchMetadata) {
    window.originalFetchMetadata = window.fetchMetadata || window.fixedFetchMetadata;
}

// Enhanced fetch that handles empty URIs gracefully
window.fixedFetchMetadata = async function(uri, tokenId) {
    // Check for empty or invalid URI first
    if (!uri || uri === '' || uri === 'undefined' || uri === 'null') {
        console.log(`⚠️ Token #${tokenId} has empty URI - skipping fetch`);
        return {
            error: 'Empty URI',
            tokenId: tokenId,
            name: `Alert #${tokenId}`,
            description: 'No metadata available',
            image: null
        };
    }
    
    console.log(`📡 Fetching metadata for token #${tokenId}`);
    
    try {
        // Handle data URIs
        if (uri.startsWith('data:')) {
            const [header, data] = uri.split(',');
            if (header.includes('application/json')) {
                const metadata = JSON.parse(atob(data));
                console.log(`✅ Decoded data URI metadata for token #${tokenId}`);
                return metadata;
            }
        }
        
        // Handle IPFS URIs
        if (uri.startsWith('ipfs://')) {
            const ipfsHash = uri.replace('ipfs://', '');
            const ipfsGateway = 'https://gateway.pinata.cloud/ipfs/';
            const response = await fetch(ipfsGateway + ipfsHash, {
                signal: AbortSignal.timeout(10000)
            });
            
            if (response.ok) {
                const metadata = await response.json();
                console.log(`✅ Fetched IPFS metadata for token #${tokenId}`);
                return metadata;
            } else {
                throw new Error(`IPFS fetch failed: ${response.status}`);
            }
        }
        
        // Handle HTTP URIs
        if (uri.startsWith('http')) {
            const response = await fetch(uri, {
                signal: AbortSignal.timeout(10000)
            });
            
            if (response.ok) {
                const metadata = await response.json();
                console.log(`✅ Fetched HTTP metadata for token #${tokenId}`);
                return metadata;
            } else {
                throw new Error(`HTTP fetch failed: ${response.status}`);
            }
        }
        
        console.warn(`⚠️ Unknown URI format for token #${tokenId}: ${uri.substring(0, 50)}`);
        return {
            error: 'Unknown URI format',
            tokenId: tokenId,
            uri: uri
        };
        
    } catch (error) {
        console.error(`❌ Failed to fetch metadata for token #${tokenId}:`, error.message);
        return {
            error: error.message,
            tokenId: tokenId,
            name: `Alert #${tokenId}`,
            description: 'Metadata fetch failed',
            image: null
        };
    }
};

// Replace the global fetchMetadata if it exists
if (window.fetchMetadata) {
    window.fetchMetadata = window.fixedFetchMetadata;
}

// Also patch any other metadata fetching functions
if (window.UnifiedNoticeSystem && window.UnifiedNoticeSystem.fetchMetadata) {
    window.UnifiedNoticeSystem.fetchMetadata = window.fixedFetchMetadata;
}

if (window.NoticeWorkflow && window.NoticeWorkflow.fetchMetadata) {
    window.NoticeWorkflow.fetchMetadata = window.fixedFetchMetadata;
}

// Fix the recursive console.log issue
if (window.console && window.console.log.toString().includes('console.log')) {
    console.log('🔧 Fixing recursive console.log...');
    
    // Get the native console.log
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const nativeLog = iframe.contentWindow.console.log;
    document.body.removeChild(iframe);
    
    // Replace with native version
    console.log = nativeLog;
    console.warn = iframe.contentWindow.console.warn || console.warn;
    console.error = iframe.contentWindow.console.error || console.error;
}

console.log('✅ Empty URI handling fixed');
console.log('✅ Recursive console.log fixed');

// Now check for any notices with empty URIs
(async function checkEmptyURIs() {
    const notices = JSON.parse(localStorage.getItem('legalNotices') || '[]');
    const emptyURINotices = [];
    
    for (const notice of notices) {
        if (notice.alertId) {
            try {
                const uri = await window.legalContract.tokenURI(notice.alertId).call();
                if (!uri || uri === '') {
                    emptyURINotices.push(notice.alertId);
                }
            } catch (e) {
                // Token might not exist
            }
        }
    }
    
    if (emptyURINotices.length > 0) {
        console.log(`⚠️ Found ${emptyURINotices.length} alerts with empty URIs:`, emptyURINotices);
        console.log('These need to be updated with proper metadata');
    }
})();