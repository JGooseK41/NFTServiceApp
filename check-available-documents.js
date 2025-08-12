/**
 * Script to check what documents might still be available locally
 */

console.log('🔍 Checking for available documents...\n');

// Check window.uploadedImage
if (window.uploadedImage) {
    console.log('✅ Found uploadedImage in window:');
    console.log('  - Has thumbnail:', !!window.uploadedImage.thumbnail);
    console.log('  - Has fullDocument:', !!window.uploadedImage.fullDocument);
    if (window.uploadedImage.thumbnail) {
        console.log('  - Thumbnail size:', window.uploadedImage.thumbnail.length, 'chars');
    }
    if (window.uploadedImage.fullDocument) {
        console.log('  - Document size:', window.uploadedImage.fullDocument.length, 'chars');
    }
} else {
    console.log('❌ No uploadedImage in window object');
}

// Check localStorage
console.log('\n📦 Checking localStorage...');
let localStorageCount = 0;
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.includes('notice') || key.includes('document') || key.includes('image')) {
        const value = localStorage.getItem(key);
        console.log(`  - ${key}: ${value.length} chars`);
        localStorageCount++;
        
        // Try to parse if it's JSON
        try {
            const parsed = JSON.parse(value);
            if (parsed.thumbnail || parsed.document || parsed.images) {
                console.log('    ✅ Contains document data');
            }
        } catch (e) {
            // Not JSON, might be base64
            if (value.startsWith('data:image')) {
                console.log('    ✅ Is base64 image data');
            }
        }
    }
}
if (localStorageCount === 0) {
    console.log('  ❌ No document-related items found');
}

// Check sessionStorage
console.log('\n📦 Checking sessionStorage...');
let sessionStorageCount = 0;
for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key.includes('notice') || key.includes('document') || key.includes('image')) {
        const value = sessionStorage.getItem(key);
        console.log(`  - ${key}: ${value.length} chars`);
        sessionStorageCount++;
        
        // Try to parse if it's JSON
        try {
            const parsed = JSON.parse(value);
            if (parsed.thumbnail || parsed.document || parsed.images) {
                console.log('    ✅ Contains document data');
            }
        } catch (e) {
            // Not JSON, might be base64
            if (value.startsWith('data:image')) {
                console.log('    ✅ Is base64 image data');
            }
        }
    }
}
if (sessionStorageCount === 0) {
    console.log('  ❌ No document-related items found');
}

// Check IndexedDB
console.log('\n🗄️ Checking IndexedDB...');
if (window.indexedDB) {
    const request = indexedDB.open('NFTServiceDB', 1);
    
    request.onsuccess = (event) => {
        const db = event.target.result;
        console.log('  ✅ NFTServiceDB exists');
        
        // List all object stores
        const storeNames = Array.from(db.objectStoreNames);
        console.log('  Object stores:', storeNames);
        
        if (storeNames.includes('notices')) {
            const transaction = db.transaction(['notices'], 'readonly');
            const store = transaction.objectStore('notices');
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
                console.log(`  - notices store has ${countRequest.result} entries`);
                
                // Get all entries
                const getAllRequest = store.getAll();
                getAllRequest.onsuccess = () => {
                    const notices = getAllRequest.result;
                    let withImages = 0;
                    notices.forEach(notice => {
                        if (notice.images || notice.thumbnail || notice.document) {
                            withImages++;
                        }
                    });
                    if (withImages > 0) {
                        console.log(`    ✅ ${withImages} notices have image data`);
                    } else {
                        console.log('    ❌ No notices with image data');
                    }
                };
            };
        }
        
        db.close();
    };
    
    request.onerror = () => {
        console.log('  ❌ Could not open IndexedDB');
    };
} else {
    console.log('  ❌ IndexedDB not supported');
}

// Check unified system cases
console.log('\n📋 Checking unified system cases...');
if (window.unifiedSystem && window.unifiedSystem.cases) {
    const cases = window.unifiedSystem.cases;
    console.log(`  Found ${cases.size} cases`);
    
    let casesWithImages = 0;
    cases.forEach((caseData, caseNumber) => {
        let hasImages = false;
        
        // Check if any recipient has image data
        (caseData.recipients || []).forEach(recipient => {
            if (recipient.thumbnailUrl || recipient.documentUrl || 
                recipient.alertThumbnailUrl || recipient.documentUnencryptedUrl) {
                hasImages = true;
            }
        });
        
        if (hasImages) {
            casesWithImages++;
            console.log(`  - Case ${caseNumber}: Has image URLs (may be broken)`);
        }
    });
    
    if (casesWithImages === 0) {
        console.log('  ❌ No cases with image data');
    }
} else {
    console.log('  ❌ Unified system not loaded or no cases');
}

// Summary
console.log('\n📊 SUMMARY:');
console.log('Most uploaded documents are likely LOST due to Render\'s ephemeral storage.');
console.log('Only documents still in browser memory/cache might be recoverable.');
console.log('The new database storage solution will prevent this from happening again.');

// Attempt recovery function
window.attemptDocumentRecovery = async function() {
    console.log('\n🔧 Attempting to recover and re-upload any available documents...');
    
    if (!window.unifiedSystem) {
        console.error('Unified system not available');
        return;
    }
    
    // Try to re-upload from window.uploadedImage if available
    if (window.uploadedImage && (window.uploadedImage.thumbnail || window.uploadedImage.fullDocument)) {
        console.log('Found documents in window.uploadedImage, attempting re-upload...');
        
        // Store in localStorage for persistence
        const timestamp = Date.now();
        localStorage.setItem(`recovered_docs_${timestamp}`, JSON.stringify({
            thumbnail: window.uploadedImage.thumbnail,
            document: window.uploadedImage.fullDocument,
            timestamp: timestamp,
            recovered: true
        }));
        
        console.log('✅ Saved to localStorage as backup');
        
        // You would need to manually re-upload these to specific notice IDs
        console.log('To re-upload these, you need to:');
        console.log('1. Identify which notice IDs need these documents');
        console.log('2. Use the manual upload interface in the notice viewer');
        console.log('3. Or run: unifiedSystem.reuploadAllMissingImages()');
    }
    
    return 'Recovery attempt complete. Check console for details.';
};

console.log('\n💡 To attempt recovery, run: attemptDocumentRecovery()');