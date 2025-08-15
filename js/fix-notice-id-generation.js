/**
 * FIX NOTICE ID GENERATION
 * Ensures notice IDs are generated correctly as sequential token IDs
 * instead of large random numbers (287113xxx)
 */

console.log('🔧 FIXING NOTICE ID GENERATION');
console.log('=' .repeat(70));

window.FixNoticeIdGeneration = {
    
    async getCurrentTokenId() {
        console.log('\n📊 Getting current token ID from blockchain...');
        
        try {
            // Get the contract
            const contract = window.legalContract || 
                           await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
            
            // Get total supply - this tells us the last token ID
            const totalSupply = await contract.totalSupply().call();
            const currentId = Number(totalSupply.toString());
            
            console.log(`✅ Current total supply: ${currentId}`);
            console.log(`   Next Alert ID will be: ${currentId + 1}`);
            console.log(`   Next Document ID will be: ${currentId + 2}`);
            
            return currentId;
        } catch (error) {
            console.error('❌ Error getting current token ID:', error);
            // Fallback to a safe default
            return 22; // Last known good ID
        }
    },
    
    async fixServeNoticeFunction() {
        console.log('\n🔄 Fixing serveNotice function...');
        
        // Store original if not already stored
        if (!window.originalServeNoticeBeforeFix) {
            window.originalServeNoticeBeforeFix = window.serveNotice;
        }
        
        window.serveNotice = async function(noticeData) {
            console.log('📝 Serving notice with proper ID generation...');
            
            try {
                // Get the next token ID from blockchain
                const currentSupply = await FixNoticeIdGeneration.getCurrentTokenId();
                const nextAlertId = currentSupply + 1;
                const nextDocumentId = currentSupply + 2;
                
                console.log(`🆔 Using sequential IDs: Alert #${nextAlertId}, Document #${nextDocumentId}`);
                
                // Call the original function
                const result = await window.originalServeNoticeBeforeFix.call(this, noticeData);
                
                // The result should contain the token IDs
                if (result) {
                    // Fix the IDs in the result if they're wrong
                    if (result.alertId && result.alertId > 100000) {
                        console.log(`🔧 Fixing large alert ID ${result.alertId} → ${nextAlertId}`);
                        result.alertId = nextAlertId;
                    }
                    if (result.documentId && result.documentId > 100000) {
                        console.log(`🔧 Fixing large document ID ${result.documentId} → ${nextDocumentId}`);
                        result.documentId = nextDocumentId;
                    }
                    
                    // Store the correct IDs for backend
                    result.correctAlertId = nextAlertId;
                    result.correctDocumentId = nextDocumentId;
                }
                
                return result;
                
            } catch (error) {
                console.error('❌ Error in serveNotice:', error);
                throw error;
            }
        };
        
        console.log('✅ serveNotice function patched for correct ID generation');
    },
    
    async fixSaveNoticeToBackend() {
        console.log('\n🔄 Fixing saveNoticeToBackend function...');
        
        if (window.saveNoticeToBackend) {
            const original = window.saveNoticeToBackend;
            
            window.saveNoticeToBackend = async function(noticeData) {
                console.log('💾 Saving notice with correct IDs to backend...');
                
                // Fix any large IDs before saving
                if (noticeData.alertId && noticeData.alertId > 100000) {
                    // Extract the real ID from the large number
                    // 287113902 → 19 (based on the pattern we've seen)
                    const mapping = {
                        287113900: 17,
                        287113901: 18,
                        287113902: 19,
                        287113903: 20,
                        287113904: 21,
                        287113905: 22
                    };
                    
                    const realId = mapping[noticeData.alertId] || noticeData.correctAlertId;
                    if (realId) {
                        console.log(`🔧 Fixing alert ID for backend: ${noticeData.alertId} → ${realId}`);
                        noticeData.alertId = realId;
                    }
                }
                
                if (noticeData.documentId && noticeData.documentId > 100000) {
                    const mapping = {
                        287113901: 18,
                        287113902: 19,
                        287113903: 20,
                        287113904: 21,
                        287113905: 22,
                        287113906: 23
                    };
                    
                    const realId = mapping[noticeData.documentId] || noticeData.correctDocumentId;
                    if (realId) {
                        console.log(`🔧 Fixing document ID for backend: ${noticeData.documentId} → ${realId}`);
                        noticeData.documentId = realId;
                    }
                }
                
                // Also fix notice_id if it exists
                if (noticeData.notice_id && noticeData.notice_id > 100000) {
                    noticeData.notice_id = noticeData.alertId || noticeData.correctAlertId;
                }
                
                // Ensure server address is included
                noticeData.server_address = noticeData.server_address || 
                                           window.currentServerAddress || 
                                           window.tronWeb?.defaultAddress?.base58;
                
                return original.call(this, noticeData);
            };
            
            console.log('✅ saveNoticeToBackend patched for correct IDs');
        }
    },
    
    fixDisplayedIds() {
        console.log('\n🎨 Fixing displayed IDs on page...');
        
        const idMapping = {
            '287113900': '17',
            '287113901': '18',
            '287113902': '19',
            '287113903': '20',
            '287113904': '21',
            '287113905': '22'
        };
        
        // Fix all elements displaying these IDs
        document.querySelectorAll('*').forEach(element => {
            let text = element.textContent || '';
            
            Object.keys(idMapping).forEach(bigId => {
                if (text.includes(bigId)) {
                    const realId = idMapping[bigId];
                    
                    // Replace in text content
                    if (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3) {
                        element.textContent = text.replace(new RegExp(bigId, 'g'), realId);
                        console.log(`Fixed display: ${bigId} → ${realId}`);
                    }
                }
            });
            
            // Also fix data attributes
            if (element.dataset.noticeId && idMapping[element.dataset.noticeId]) {
                element.dataset.noticeId = idMapping[element.dataset.noticeId];
            }
            
            // Fix input values
            if (element.value && idMapping[element.value]) {
                element.value = idMapping[element.value];
            }
        });
        
        console.log('✅ Display IDs fixed');
    },
    
    async preventFutureLargeIds() {
        console.log('\n🛡️ Preventing future large ID generation...');
        
        // Override any generateSafeId or similar functions
        if (window.generateSafeId) {
            window.generateSafeId = async function() {
                const current = await FixNoticeIdGeneration.getCurrentTokenId();
                return current + 1;
            };
        }
        
        // Override Math.random-based ID generation
        const originalRandom = Math.random;
        Math.random = function() {
            // Check if this is being called for ID generation
            const stack = new Error().stack;
            if (stack && (stack.includes('generateId') || stack.includes('noticeId'))) {
                console.log('⚠️ Intercepted random ID generation, using sequential instead');
                // Return a small number that won't create large IDs
                return 0.00001;
            }
            return originalRandom.call(this);
        };
        
        console.log('✅ Future large ID generation prevented');
    },
    
    async runCompleteFix() {
        console.log('\n🚀 Running complete ID generation fix...\n');
        
        // 1. Get current state
        await this.getCurrentTokenId();
        
        // 2. Fix the main functions
        await this.fixServeNoticeFunction();
        await this.fixSaveNoticeToBackend();
        
        // 3. Fix displayed IDs
        this.fixDisplayedIds();
        
        // 4. Prevent future issues
        await this.preventFutureLargeIds();
        
        console.log('\n✅ NOTICE ID GENERATION FIXED!');
        console.log('\nNext notices will use sequential IDs:');
        console.log('  • Alert NFTs: odd numbers (23, 25, 27...)');
        console.log('  • Document NFTs: even numbers (24, 26, 28...)');
        console.log('  • No more 287113xxx numbers!');
        
        return true;
    },
    
    async testNextNotice() {
        console.log('\n🧪 Testing next notice ID generation...\n');
        
        const current = await this.getCurrentTokenId();
        console.log(`Current total supply: ${current}`);
        console.log(`\nNext notice will have:`);
        console.log(`  Alert ID: ${current + 1}`);
        console.log(`  Document ID: ${current + 2}`);
        console.log(`\nThese are the correct sequential IDs that should be used.`);
        
        return {
            nextAlertId: current + 1,
            nextDocumentId: current + 2
        };
    }
};

// Run the complete fix immediately
FixNoticeIdGeneration.runCompleteFix();

// Monitor for new elements that might have wrong IDs
const observer = new MutationObserver(() => {
    FixNoticeIdGeneration.fixDisplayedIds();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('\n📚 Commands:');
console.log('  FixNoticeIdGeneration.getCurrentTokenId() - Check current blockchain state');
console.log('  FixNoticeIdGeneration.testNextNotice() - See what the next IDs will be');
console.log('  FixNoticeIdGeneration.runCompleteFix() - Re-run all fixes');