/**
 * PATCH ALL METADATA FETCHING
 * Comprehensive fix for all metadata fetching functions
 */

console.log('🔧 PATCHING ALL METADATA FETCHING FUNCTIONS...');

// Helper to check if URI is valid
function isValidURI(uri) {
    return uri && uri !== '' && uri !== 'undefined' && uri !== 'null' && uri.length > 0;
}

// Create safe metadata fetcher
const safeMetadataFetch = async function(uri, tokenId) {
    if (!isValidURI(uri)) {
        console.log(`⚠️ Token #${tokenId} has empty/invalid URI - skipping`);
        return null;
    }
    
    try {
        if (uri.startsWith('data:')) {
            const [header, data] = uri.split(',');
            if (header.includes('application/json')) {
                return JSON.parse(atob(data));
            }
        } else if (uri.startsWith('ipfs://')) {
            const ipfsHash = uri.replace('ipfs://', '');
            const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`, {
                signal: AbortSignal.timeout(10000)
            });
            if (response.ok) {
                return await response.json();
            }
        } else if (uri.startsWith('http')) {
            const response = await fetch(uri, { signal: AbortSignal.timeout(10000) });
            if (response.ok) {
                return await response.json();
            }
        }
    } catch (error) {
        console.error(`Failed to fetch metadata for token #${tokenId}:`, error.message);
    }
    return null;
};

// Find and patch all metadata fetching functions
const patchTargets = [
    'fetchMetadata',
    'fetchTokenMetadata', 
    'getMetadata',
    'loadMetadata',
    'retrieveMetadata'
];

// Patch window level functions
patchTargets.forEach(name => {
    if (window[name]) {
        console.log(`Patching window.${name}`);
        const original = window[name];
        window[name] = function(uri, ...args) {
            if (!isValidURI(uri)) {
                console.log(`Blocked empty URI in ${name}`);
                return Promise.resolve(null);
            }
            return original.call(this, uri, ...args);
        };
    }
});

// Patch object methods
const objects = [
    'NoticeWorkflow',
    'UnifiedNoticeSystem',
    'CompleteReceiptFix',
    'FixMetadataFetch'
];

objects.forEach(objName => {
    if (window[objName]) {
        patchTargets.forEach(methodName => {
            if (window[objName][methodName]) {
                console.log(`Patching ${objName}.${methodName}`);
                const original = window[objName][methodName];
                window[objName][methodName] = function(uri, ...args) {
                    if (!isValidURI(uri)) {
                        console.log(`Blocked empty URI in ${objName}.${methodName}`);
                        return Promise.resolve(null);
                    }
                    return original.call(this, uri, ...args);
                };
            }
        });
    }
});

// Specifically patch the notice workflow fetch
if (window.NoticeWorkflow && window.NoticeWorkflow.fetchNoticeBatch) {
    console.log('Patching NoticeWorkflow.fetchNoticeBatch');
    const originalFetchBatch = window.NoticeWorkflow.fetchNoticeBatch;
    
    window.NoticeWorkflow.fetchNoticeBatch = async function(startId, endId) {
        console.log(`Fetching batch ${startId}-${endId} with URI validation`);
        const notices = [];
        
        for (let i = startId; i <= endId; i++) {
            try {
                const alertId = i * 2 - 1;
                const documentId = i * 2;
                
                // Check if tokens exist before getting URI
                try {
                    await window.legalContract.ownerOf(alertId).call();
                    const alertURI = await window.legalContract.tokenURI(alertId).call();
                    
                    if (isValidURI(alertURI)) {
                        const metadata = await safeMetadataFetch(alertURI, alertId);
                        if (metadata) {
                            notices.push({ id: i, alertId, metadata });
                        }
                    } else {
                        console.log(`Alert #${alertId} has empty URI`);
                    }
                } catch (e) {
                    // Token doesn't exist
                }
                
            } catch (error) {
                console.error(`Error fetching notice ${i}:`, error);
            }
        }
        
        return notices;
    };
}

// Stop the console.log recursion if it exists
if (console.log.toString().includes('console.log')) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    console.log = iframe.contentWindow.console.log;
    console.warn = iframe.contentWindow.console.warn;
    console.error = iframe.contentWindow.console.error;
    document.body.removeChild(iframe);
    console.log('✅ Fixed recursive console.log');
}

console.log('✅ All metadata fetching functions patched');

// Now run a quick check
console.log('\n🔍 Running quick URI check...');
(async () => {
    const alertIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
    let emptyCount = 0;
    let validCount = 0;
    
    for (const id of alertIds) {
        try {
            await window.legalContract.ownerOf(id).call();
            const uri = await window.legalContract.tokenURI(id).call();
            if (isValidURI(uri)) {
                validCount++;
            } else {
                emptyCount++;
                console.log(`Alert #${id}: EMPTY URI`);
            }
        } catch (e) {
            // Token not minted
        }
    }
    
    console.log(`\n📊 URI Status: ${validCount} valid, ${emptyCount} empty`);
    
    if (emptyCount > 0) {
        console.log('⚠️ Empty URIs need to be updated with proper base64 metadata');
    }
})();