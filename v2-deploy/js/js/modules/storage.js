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
    
    // Set item in storage
    set(key, value) {
        const fullKey = getConfig('storage.keys.' + key) || key;
        const data = typeof value === 'object' ? JSON.stringify(value) : value;
        localStorage.setItem(fullKey, data);
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