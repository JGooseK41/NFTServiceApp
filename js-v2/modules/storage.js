// Storage Module - Handles local and backend data persistence
window.storage = {
    
    // Initialize module
    async init() {
        console.log('Initializing storage module...');
        this.migrate();
    },
    
    // Migrate old data if exists
    migrate() {
        // Check for old app data and migrate if needed
        const oldData = {
            serverId: localStorage.getItem('processServerId'),
            cases: localStorage.getItem('legal_cases'),
            receipts: localStorage.getItem('service_receipts')
        };
        
        if (oldData.serverId && !this.get('serverId')) {
            this.set('serverId', oldData.serverId);
            console.log('Migrated server ID from old app');
        }
    },
    
    // Get item from storage
    get(key) {
        const fullKey = getConfig('storage.keys.' + key) || key;
        const data = localStorage.getItem(fullKey);
        
        try {
            return JSON.parse(data);
        } catch {
            return data;
        }
    },
    
    // Set item in storage with quota handling
    set(key, value) {
        const fullKey = getConfig('storage.keys.' + key) || key;
        const data = typeof value === 'object' ? JSON.stringify(value) : value;
        try {
            localStorage.setItem(fullKey, data);
        } catch (error) {
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                console.warn('LocalStorage quota exceeded, attempting cleanup...');
                this.cleanup();
                try {
                    localStorage.setItem(fullKey, data);
                } catch (retryError) {
                    console.error('LocalStorage still full after cleanup:', retryError);
                }
            } else {
                console.error('LocalStorage error:', error);
            }
        }
    },

    // Clean up old/unnecessary data to free localStorage space
    cleanup() {
        console.log('Cleaning up localStorage...');

        // Remove old pending transactions (keep only last 24h)
        const transactions = this.get('pendingTransactions') || [];
        const recentTx = transactions.filter(tx =>
            Date.now() - tx.timestamp < 24 * 60 * 60 * 1000
        );
        if (recentTx.length < transactions.length) {
            try {
                localStorage.setItem(
                    getConfig('storage.keys.pendingTransactions') || 'pendingTransactions',
                    JSON.stringify(recentTx)
                );
                console.log(`Cleaned up ${transactions.length - recentTx.length} old transactions`);
            } catch (e) { /* ignore */ }
        }

        // Limit receipts to 50 (reduce from 100)
        const receipts = this.get('receipts') || [];
        if (receipts.length > 50) {
            receipts.length = 50;
            try {
                localStorage.setItem(
                    getConfig('storage.keys.receipts') || 'receipts',
                    JSON.stringify(receipts)
                );
                console.log('Reduced receipts to 50');
            } catch (e) { /* ignore */ }
        }

        // Clean legalnotice_receipts
        try {
            const lnReceipts = JSON.parse(localStorage.getItem('legalnotice_receipts') || '[]');
            if (lnReceipts.length > 50) {
                lnReceipts.length = 50;
                localStorage.setItem('legalnotice_receipts', JSON.stringify(lnReceipts));
                console.log('Reduced legalnotice_receipts to 50');
            }
        } catch (e) { /* ignore */ }

        // Remove any debug/test keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('debug_') || key.startsWith('test_'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        if (keysToRemove.length > 0) {
            console.log(`Removed ${keysToRemove.length} debug/test keys`);
        }
    },
    
    // Remove item from storage
    remove(key) {
        const fullKey = getConfig('storage.keys.' + key) || key;
        localStorage.removeItem(fullKey);
    },
    
    // Clear all app storage
    clear() {
        const keys = Object.values(getConfig('storage.keys'));
        keys.forEach(key => localStorage.removeItem(key));
    },
    
    // Save case data
    saveCase(caseData) {
        const cases = this.get('cases') || [];
        const existingIndex = cases.findIndex(c => c.caseNumber === caseData.caseNumber);
        
        if (existingIndex >= 0) {
            cases[existingIndex] = { ...cases[existingIndex], ...caseData };
        } else {
            cases.push(caseData);
        }
        
        this.set('cases', cases);
    },
    
    // Get case by number
    getCase(caseNumber) {
        const cases = this.get('cases') || [];
        return cases.find(c => c.caseNumber === caseNumber);
    },
    
    // Save receipt
    saveReceipt(receipt) {
        const receipts = this.get('receipts') || [];
        receipts.unshift(receipt); // Add to beginning
        
        // Keep only last 100 receipts
        if (receipts.length > 100) {
            receipts.length = 100;
        }
        
        this.set('receipts', receipts);
    },
    
    // Get receipts
    getReceipts() {
        return this.get('receipts') || [];
    },
    
    // Save transaction for recovery
    saveTransaction(tx) {
        const transactions = this.get('pendingTransactions') || [];
        transactions.push({
            ...tx,
            timestamp: Date.now()
        });
        this.set('pendingTransactions', transactions);
    },
    
    // Remove completed transaction
    removeTransaction(txId) {
        const transactions = this.get('pendingTransactions') || [];
        const filtered = transactions.filter(tx => tx.txId !== txId);
        this.set('pendingTransactions', filtered);
    },
    
    // Get pending transactions
    getPendingTransactions() {
        const transactions = this.get('pendingTransactions') || [];
        // Remove transactions older than 24 hours
        const recent = transactions.filter(tx => 
            Date.now() - tx.timestamp < 24 * 60 * 60 * 1000
        );
        this.set('pendingTransactions', recent);
        return recent;
    }
};

console.log('Storage module loaded');