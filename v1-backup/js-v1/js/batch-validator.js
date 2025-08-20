/**
 * Batch Operation Validator
 * Ensures data integrity for batch operations
 */

class BatchValidator {
    constructor() {
        this.maxBatchSize = 10;
        this.maxRetries = 3;
        this.validationRules = {
            address: /^T[A-Za-z1-9]{33}$/,
            caseNumber: /^[\w\-\/]+$/,
            noticeType: /^[\w\s]+$/
        };
    }

    /**
     * Validate batch operation before sending
     */
    validateBatch(batchData) {
        const errors = [];
        const warnings = [];

        // Check batch size
        if (!batchData.recipients || !Array.isArray(batchData.recipients)) {
            errors.push('Recipients must be an array');
            return { valid: false, errors, warnings };
        }

        if (batchData.recipients.length === 0) {
            errors.push('At least one recipient is required');
        }

        if (batchData.recipients.length > this.maxBatchSize) {
            errors.push(`Maximum batch size is ${this.maxBatchSize} recipients`);
        }

        // Validate each recipient
        const uniqueRecipients = new Set();
        batchData.recipients.forEach((recipient, index) => {
            // Check for valid TRON address
            if (!this.isValidTronAddress(recipient)) {
                errors.push(`Recipient ${index + 1}: Invalid TRON address format`);
            }

            // Check for duplicates
            if (uniqueRecipients.has(recipient)) {
                warnings.push(`Recipient ${index + 1}: Duplicate address ${recipient}`);
            }
            uniqueRecipients.add(recipient);
        });

        // Validate required fields
        if (!batchData.caseNumber || batchData.caseNumber.trim() === '') {
            errors.push('Case number is required');
        } else if (!this.validationRules.caseNumber.test(batchData.caseNumber)) {
            warnings.push('Case number contains special characters');
        }

        // Validate document data
        if (batchData.hasDocument) {
            if (!batchData.documentData) {
                errors.push('Document data is missing');
            } else {
                const docSize = this.getDataSize(batchData.documentData);
                if (docSize > 10 * 1024 * 1024) { // 10MB limit
                    errors.push(`Document size (${(docSize / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`);
                }
            }
        }

        // Validate IDs if present
        if (batchData.noticeId && window.idManager) {
            if (!window.idManager.isValidIntegerId(batchData.noticeId)) {
                warnings.push(`Notice ID ${batchData.noticeId} may cause database issues`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            summary: {
                recipientCount: batchData.recipients.length,
                uniqueCount: uniqueRecipients.size,
                hasDocument: batchData.hasDocument,
                estimatedCost: this.estimateCost(batchData)
            }
        };
    }

    /**
     * Validate single recipient
     */
    validateRecipient(address) {
        if (!address || typeof address !== 'string') {
            return { valid: false, error: 'Address must be a string' };
        }

        const trimmed = address.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: 'Address cannot be empty' };
        }

        if (!this.isValidTronAddress(trimmed)) {
            return { valid: false, error: 'Invalid TRON address format' };
        }

        return { valid: true, address: trimmed };
    }

    /**
     * Check if address is valid TRON format
     */
    isValidTronAddress(address) {
        // TRON addresses start with T and are 34 characters
        return /^T[A-Za-z1-9]{33}$/.test(address);
    }

    /**
     * Get size of data in bytes
     */
    getDataSize(data) {
        if (typeof data === 'string') {
            return new Blob([data]).size;
        }
        return 0;
    }

    /**
     * Estimate transaction cost
     */
    estimateCost(batchData) {
        const baseFee = 20; // TRX per notice
        const energyFee = 2; // TRX for energy
        const recipientCount = batchData.recipients ? batchData.recipients.length : 1;
        
        return {
            baseFee: baseFee * recipientCount,
            energyFee: energyFee * recipientCount,
            total: (baseFee + energyFee) * recipientCount,
            currency: 'TRX'
        };
    }

    /**
     * Prepare batch for submission
     */
    prepareBatchData(rawData) {
        // Clean and validate all data
        const prepared = {
            ...rawData,
            recipients: rawData.recipients.map(r => r.trim()).filter(r => r.length > 0),
            caseNumber: (rawData.caseNumber || '').trim(),
            noticeType: (rawData.noticeType || 'Legal Notice').trim(),
            timestamp: Date.now()
        };

        // Generate batch ID
        if (window.idManager) {
            prepared.batchId = window.idManager.generateBatchId();
        } else {
            prepared.batchId = `BATCH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        }

        return prepared;
    }

    /**
     * Split large batch into smaller chunks
     */
    splitBatch(recipients, chunkSize = 10) {
        const chunks = [];
        for (let i = 0; i < recipients.length; i += chunkSize) {
            chunks.push(recipients.slice(i, i + chunkSize));
        }
        return chunks;
    }
}

// Create singleton instance
window.batchValidator = new BatchValidator();

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchValidator;
}