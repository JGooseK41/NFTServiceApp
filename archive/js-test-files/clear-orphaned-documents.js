/**
 * Clear Orphaned Documents from localStorage
 * Removes pending document uploads that don't have associated NFTs
 */

function clearOrphanedDocuments() {
    console.log('🧹 Clearing orphaned documents...');
    
    // Get all localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        // Look for orphaned document keys
        if (key && (
            key.includes('orphaned-') ||
            key.includes('pending_upload_') ||
            key.includes('document_pending_') ||
            key.includes('thumbnail_pending_')
        )) {
            keysToRemove.push(key);
        }
    }
    
    // Remove orphaned documents
    let removed = 0;
    keysToRemove.forEach(key => {
        console.log(`  Removing: ${key}`);
        localStorage.removeItem(key);
        removed++;
    });
    
    console.log(`✅ Cleared ${removed} orphaned document entries`);
    
    // Also clear from session storage if any
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.includes('orphaned-')) {
            sessionKeysToRemove.push(key);
        }
    }
    
    sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
    });
    
    if (sessionKeysToRemove.length > 0) {
        console.log(`✅ Also cleared ${sessionKeysToRemove.length} entries from session storage`);
    }
    
    return removed;
}

// Run on load if there are orphaned documents
document.addEventListener('DOMContentLoaded', function() {
    // Check if there are orphaned documents
    let hasOrphaned = false;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('orphaned-')) {
            hasOrphaned = true;
            break;
        }
    }
    
    if (hasOrphaned) {
        console.log('⚠️ Found orphaned documents from incomplete transactions');
        console.log('Run clearOrphanedDocuments() to clean them up');
    }
});

// Make it globally available
window.clearOrphanedDocuments = clearOrphanedDocuments;

console.log('🧹 Orphaned document cleaner loaded');
console.log('   Run clearOrphanedDocuments() to remove pending uploads');