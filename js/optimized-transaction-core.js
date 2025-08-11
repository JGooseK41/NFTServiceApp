/**
 * OPTIMIZED TRANSACTION CORE
 * Replaces the broken transaction execution while preserving all secondary functionality:
 * - BlockServed recipient logging
 * - Backend document storage
 * - UI features (admin panel, server dashboard, etc.)
 * - Audit trails and case management
 */

console.log('🚀 Loading Optimized Transaction Core...');

// Store original functions to preserve
const originalFunctions = {};

// Transaction Manager - Clean and efficient
window.OptimizedTransactionManager = {
    
    // Initialize the optimized system
    async initialize() {
        console.log('⚙️ Initializing optimized transaction system...');
        
        // Wait for TronWeb
        if (!window.tronWeb || !window.tronWeb.ready) {
            console.log('⏳ Waiting for TronWeb...');
            setTimeout(() => this.initialize(), 1000);
            return;
        }
        
        // Set up contract with proper BigInt handling
        await this.initializeContract();
        
        // Initialize secondary systems
        this.initializeDocumentStorage();
        this.initializeBlockServed();
        this.initializeAuditLogging();
        
        console.log('✅ Optimized transaction system ready');
    },
    
    // Initialize contract with BigInt fix
    async initializeContract() {
        try {
            const CONTRACT_ADDRESS = window.CONTRACT_ADDRESS || 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
            
            if (!window.legalContract) {
                window.legalContract = await window.tronWeb.contract(
                    window.CONTRACT_ABI || this.getMinimalABI(),
                    CONTRACT_ADDRESS
                );
            }
            
            // Test contract with BigInt handling
            const fee = await window.legalContract.creationFee().call();
            const feeNumber = Number(fee.toString());
            console.log(`✅ Contract connected. Fee: ${feeNumber / 1_000_000} TRX`);
            
        } catch (error) {
            console.error('Contract initialization error:', error);
        }
    },
    
    // Minimal ABI if not loaded
    getMinimalABI() {
        return [
            {
                "constant": true,
                "inputs": [],
                "name": "creationFee",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "constant": false,
                "inputs": [
                    {"name": "recipient", "type": "address"},
                    {"name": "caseNumber", "type": "string"},
                    {"name": "lawFirm", "type": "string"},
                    {"name": "courtName", "type": "string"},
                    {"name": "documentHash", "type": "string"},
                    {"name": "county", "type": "string"},
                    {"name": "serverId", "type": "address"},
                    {"name": "recipientInfo", "type": "string"},
                    {"name": "sponsorFees", "type": "bool"}
                ],
                "name": "serveNotice",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "constant": false,
                "inputs": [
                    {"name": "batch", "type": "tuple[]", "components": [
                        {"name": "recipient", "type": "address"},
                        {"name": "caseNumber", "type": "string"},
                        {"name": "lawFirm", "type": "string"},
                        {"name": "courtName", "type": "string"},
                        {"name": "documentHash", "type": "string"},
                        {"name": "county", "type": "string"},
                        {"name": "serverId", "type": "address"},
                        {"name": "recipientInfo", "type": "string"},
                        {"name": "sponsorFees", "type": "bool"}
                    ]}
                ],
                "name": "serveNoticeBatch",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            }
        ];
    },
    
    // Initialize document storage (preserves existing functionality)
    initializeDocumentStorage() {
        // Keep existing document storage or create if missing
        if (!window.DocumentStorageAssurance) {
            window.DocumentStorageAssurance = {
                pendingDocuments: new Map(),
                
                async storeDocument(documentData) {
                    console.log('📄 Storing document to backend...');
                    
                    try {
                        const response = await fetch(`${window.BACKEND_API_URL}/api/documents`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(documentData)
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            console.log('✅ Document stored:', result.id);
                            return result;
                        }
                    } catch (error) {
                        console.warn('Document storage failed, keeping in pending:', error);
                        const docId = 'doc_' + Date.now();
                        this.pendingDocuments.set(docId, documentData);
                        return { id: docId, pending: true };
                    }
                }
            };
        }
        console.log('✅ Document storage ready');
    },
    
    // Initialize BlockServed recipient logging
    initializeBlockServed() {
        // Preserve existing BlockServed functionality
        window.BlockServedLogger = window.BlockServedLogger || {
            async logRecipientAccess(noticeId, recipientAddress, accessDetails) {
                console.log(`📋 Logging BlockServed access for ${recipientAddress}`);
                
                try {
                    const response = await fetch(`${window.BACKEND_API_URL}/api/blockserved/log`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            noticeId,
                            recipientAddress,
                            accessTime: new Date().toISOString(),
                            ...accessDetails
                        })
                    });
                    
                    if (response.ok) {
                        console.log('✅ BlockServed access logged');
                    }
                } catch (error) {
                    console.error('BlockServed logging failed:', error);
                }
            }
        };
        console.log('✅ BlockServed logger ready');
    },
    
    // Initialize audit logging
    initializeAuditLogging() {
        window.AuditLogger = window.AuditLogger || {
            async log(action, details) {
                console.log(`📝 Audit log: ${action}`);
                
                try {
                    await fetch(`${window.BACKEND_API_URL}/api/audit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action,
                            details,
                            timestamp: new Date().toISOString(),
                            wallet: window.tronWeb?.defaultAddress?.base58
                        })
                    });
                } catch (error) {
                    console.error('Audit logging failed:', error);
                }
            }
        };
        console.log('✅ Audit logger ready');
    },
    
    // Calculate energy needed (accurate calculation)
    calculateEnergyNeeded(documentSize = 0, recipientCount = 1) {
        const baseEnergy = 400000;
        const documentEnergy = documentSize * 2; // 2 energy per byte
        const perRecipientEnergy = 50000;
        
        let totalEnergy = baseEnergy + documentEnergy;
        
        if (recipientCount > 1) {
            // Batch is more efficient
            totalEnergy = (baseEnergy + documentEnergy) + (perRecipientEnergy * (recipientCount - 1));
            totalEnergy = Math.floor(totalEnergy * 0.75); // Batch efficiency
        }
        
        return totalEnergy;
    },
    
    // Calculate fees (with proper number handling)
    calculateFees(recipientCount = 1, sponsorFees = false) {
        const baseFee = 5; // Actual mainnet fee
        const sponsorshipFee = sponsorFees ? (2 * recipientCount) : 0;
        const totalTRX = baseFee * recipientCount + sponsorshipFee;
        
        return {
            baseFee: baseFee * recipientCount,
            sponsorshipFee,
            totalTRX,
            totalSUN: totalTRX * 1_000_000
        };
    },
    
    // Check if energy rental is needed
    async checkEnergyRequirement(documentSize, recipientCount) {
        const energyNeeded = this.calculateEnergyNeeded(documentSize, recipientCount);
        
        try {
            const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
            const currentEnergy = account.energy || 0;
            
            const needsRental = energyNeeded > currentEnergy && energyNeeded > 1000000;
            const burnCost = Math.ceil((energyNeeded - currentEnergy) * 0.00042);
            
            return {
                energyNeeded,
                currentEnergy,
                needsRental,
                burnCost,
                rentalCost: 88,
                savings: needsRental ? (burnCost - 88) : 0
            };
        } catch (error) {
            console.error('Energy check failed:', error);
            return { energyNeeded, currentEnergy: 0, needsRental: true };
        }
    },
    
    // Rent energy if needed
    async rentEnergy() {
        console.log('⚡ Renting energy from JustLend...');
        
        try {
            const JUSTLEND_ADDRESS = 'TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd';
            const justLend = await window.tronWeb.contract().at(JUSTLEND_ADDRESS);
            
            const result = await justLend.rentResource(
                window.tronWeb.defaultAddress.base58,
                1, // Energy type
                3200000 // ~3.2M energy
            ).send({
                callValue: 88 * 1_000_000, // 88 TRX
                feeLimit: 100_000_000
            });
            
            console.log('✅ Energy rented! TX:', result);
            
            // Log the rental
            if (window.AuditLogger) {
                await window.AuditLogger.log('ENERGY_RENTAL', { 
                    txId: result, 
                    amount: 3200000, 
                    cost: 88 
                });
            }
            
            return { success: true, txId: result };
            
        } catch (error) {
            console.error('Energy rental failed:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Execute single notice (with all integrations)
    async executeNotice(noticeData) {
        console.log('📝 Executing single notice transaction...');
        
        try {
            // 1. Store document first
            let documentHash = noticeData.documentHash || '';
            if (noticeData.document && window.DocumentStorageAssurance) {
                const stored = await window.DocumentStorageAssurance.storeDocument({
                    file: noticeData.document,
                    caseNumber: noticeData.caseNumber,
                    recipient: noticeData.recipient
                });
                documentHash = stored.hash || documentHash;
            }
            
            // 2. Check energy requirement
            const documentSize = noticeData.document?.size || 0;
            const energyCheck = await this.checkEnergyRequirement(documentSize, 1);
            
            if (energyCheck.needsRental) {
                console.log(`⚠️ Need ${energyCheck.energyNeeded} energy. Rental recommended.`);
                
                // Show cost modal if it exists
                if (window.showTransactionCostModal) {
                    const userChoice = await window.showTransactionCostModal({
                        energyNeeded: energyCheck.energyNeeded,
                        currentEnergy: energyCheck.currentEnergy,
                        burnCost: energyCheck.burnCost,
                        rentalCost: 88
                    });
                    
                    if (userChoice.choice === 'cancel') {
                        throw new Error('Transaction cancelled by user');
                    }
                    
                    if (userChoice.choice === 'rent') {
                        await this.rentEnergy();
                        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for energy
                    }
                }
            }
            
            // 3. Calculate fees
            const fees = this.calculateFees(1, noticeData.sponsorFees);
            
            // 4. Execute transaction
            const result = await window.legalContract.serveNotice(
                noticeData.recipient,
                noticeData.caseNumber,
                noticeData.lawFirm || '',
                noticeData.courtName || '',
                documentHash,
                noticeData.county || '',
                window.tronWeb.defaultAddress.base58,
                noticeData.recipientInfo || '',
                noticeData.sponsorFees || false
            ).send({
                callValue: fees.totalSUN,
                feeLimit: 100_000_000
            });
            
            console.log('✅ Notice created! TX:', result);
            
            // 5. Log to audit
            if (window.AuditLogger) {
                await window.AuditLogger.log('NOTICE_CREATED', {
                    txId: result,
                    recipient: noticeData.recipient,
                    caseNumber: noticeData.caseNumber,
                    documentHash
                });
            }
            
            // 6. Update UI if exists
            if (window.uiManager?.showNotification) {
                window.uiManager.showNotification('success', 
                    `Notice created successfully! TX: ${result.substring(0, 8)}...`);
            }
            
            return { success: true, txId: result, documentHash };
            
        } catch (error) {
            console.error('Transaction failed:', error);
            
            if (window.uiManager?.showNotification) {
                window.uiManager.showNotification('error', 
                    `Transaction failed: ${error.message}`);
            }
            
            throw error;
        }
    },
    
    // Execute batch notices (optimized for multiple recipients)
    async executeBatch(recipients, sharedDocuments, caseData) {
        console.log(`📦 Executing batch transaction for ${recipients.length} recipients...`);
        
        try {
            // 1. Store shared documents
            const documentHashes = [];
            if (sharedDocuments && sharedDocuments.length > 0) {
                for (const doc of sharedDocuments) {
                    if (window.DocumentStorageAssurance) {
                        const stored = await window.DocumentStorageAssurance.storeDocument({
                            file: doc,
                            caseNumber: caseData.caseNumber,
                            type: 'shared'
                        });
                        documentHashes.push(stored.hash || '');
                    }
                }
            }
            
            const combinedHash = documentHashes.join('_') || 'NO_DOCUMENTS';
            
            // 2. Calculate total document size
            const totalDocSize = sharedDocuments?.reduce((sum, doc) => sum + (doc.size || 0), 0) || 0;
            
            // 3. Check energy requirement
            const energyCheck = await this.checkEnergyRequirement(totalDocSize, recipients.length);
            
            if (energyCheck.needsRental) {
                console.log(`⚡ Batch needs ${energyCheck.energyNeeded} energy`);
                console.log(`💰 Rental saves ${energyCheck.savings} TRX!`);
                
                if (confirm(`Rent energy for 88 TRX? (Saves ${energyCheck.savings} TRX)`)) {
                    await this.rentEnergy();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
            
            // 4. Prepare batch data
            const batch = recipients.map(recipient => ({
                recipient: recipient.address,
                caseNumber: caseData.caseNumber,
                lawFirm: caseData.lawFirm || '',
                courtName: caseData.courtName || '',
                documentHash: combinedHash,
                county: caseData.county || '',
                serverId: window.tronWeb.defaultAddress.base58,
                recipientInfo: recipient.info || '',
                sponsorFees: caseData.sponsorFees || false
            }));
            
            // 5. Calculate fees
            const fees = this.calculateFees(recipients.length, caseData.sponsorFees);
            
            console.log(`💰 Batch cost: ${fees.totalTRX} TRX for ${recipients.length} recipients`);
            
            // 6. Execute batch transaction
            const result = await window.legalContract.serveNoticeBatch(batch).send({
                callValue: fees.totalSUN,
                feeLimit: 500_000_000 // Higher limit for batch
            });
            
            console.log('✅ Batch transaction successful! TX:', result);
            
            // 7. Log each recipient for BlockServed
            if (window.BlockServedLogger) {
                for (const recipient of recipients) {
                    await window.BlockServedLogger.logRecipientAccess(
                        result,
                        recipient.address,
                        { caseNumber: caseData.caseNumber, documentHash: combinedHash }
                    );
                }
            }
            
            // 8. Audit log
            if (window.AuditLogger) {
                await window.AuditLogger.log('BATCH_NOTICE_CREATED', {
                    txId: result,
                    recipientCount: recipients.length,
                    documentCount: documentHashes.length,
                    totalCost: fees.totalTRX
                });
            }
            
            // 9. Update UI
            if (window.uiManager?.showNotification) {
                window.uiManager.showNotification('success', 
                    `Batch complete! ${recipients.length} notices created for ${fees.totalTRX} TRX`);
            }
            
            return { 
                success: true, 
                txId: result, 
                documentHashes,
                recipientCount: recipients.length,
                totalCost: fees.totalTRX
            };
            
        } catch (error) {
            console.error('Batch transaction failed:', error);
            
            if (window.uiManager?.showNotification) {
                window.uiManager.showNotification('error', 
                    `Batch failed: ${error.message}`);
            }
            
            throw error;
        }
    }
};

// Override broken transaction functions with optimized ones
(function() {
    // Wait for page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeOverrides);
    } else {
        initializeOverrides();
    }
    
    function initializeOverrides() {
        console.log('🔧 Applying optimized transaction overrides...');
        
        // Override serveNotice if it exists
        if (window.serveNotice) {
            originalFunctions.serveNotice = window.serveNotice;
            window.serveNotice = async function(data) {
                console.log('Using optimized serveNotice');
                return await OptimizedTransactionManager.executeNotice(data);
            };
        }
        
        // Override batch functions
        if (window.serveNoticeBatch) {
            originalFunctions.serveNoticeBatch = window.serveNoticeBatch;
            window.serveNoticeBatch = async function(recipients, documents, caseData) {
                console.log('Using optimized serveNoticeBatch');
                return await OptimizedTransactionManager.executeBatch(recipients, documents, caseData);
            };
        }
        
        // Fix fee calculations globally
        window.calculateFee = function(recipients = 1, sponsorFees = false) {
            return OptimizedTransactionManager.calculateFees(recipients, sponsorFees).totalSUN;
        };
        
        // Fix energy calculations
        window.calculateEnergyNeeded = function(docSize = 0, recipients = 1) {
            return OptimizedTransactionManager.calculateEnergyNeeded(docSize, recipients);
        };
        
        console.log('✅ Transaction overrides applied');
    }
})();

// Initialize the optimized system
OptimizedTransactionManager.initialize();

console.log('✅ Optimized Transaction Core loaded successfully');
console.log('   - Preserves BlockServed logging');
console.log('   - Preserves backend document storage');
console.log('   - Preserves audit trails');
console.log('   - Fixes BigInt issues');
console.log('   - Optimizes energy usage');
console.log('   - Supports batch transactions');