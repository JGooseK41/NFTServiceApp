/**
 * ID Management Utility
 * Provides consistent ID generation and validation across the application
 */

class IDManager {
    constructor() {
        this.idCache = new Map();
        this.sequenceCounter = 0;
    }

    /**
     * Generate a safe ID that works with PostgreSQL INTEGER type
     * Max value: 2,147,483,647
     */
    generateSafeIntegerId() {
        // Use timestamp seconds (10 digits) but truncate to fit
        const timestamp = Math.floor(Date.now() / 1000);
        const timestampStr = timestamp.toString();
        
        // Take last 7 digits of timestamp
        const truncatedTimestamp = timestampStr.slice(-7);
        
        // Add 2-digit sequence counter (00-99)
        this.sequenceCounter = (this.sequenceCounter + 1) % 100;
        const sequence = this.sequenceCounter.toString().padStart(2, '0');
        
        const id = parseInt(truncatedTimestamp + sequence);
        
        // Ensure it's within INTEGER range
        if (id > 2147483647) {
            return Math.floor(Math.random() * 1000000000); // Fallback to random 9-digit
        }
        
        return id;
    }

    /**
     * Generate a text-based ID (for future backend compatibility)
     */
    generateTextId(prefix = 'N') {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${prefix}${timestamp}${random}`;
    }

    /**
     * Generate a UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Validate if an ID is safe for PostgreSQL INTEGER
     */
    isValidIntegerId(id) {
        const numId = parseInt(id);
        return !isNaN(numId) && numId > 0 && numId <= 2147483647;
    }

    /**
     * Convert any ID to a safe integer ID
     */
    toSafeIntegerId(id) {
        // If already valid, return it
        if (this.isValidIntegerId(id)) {
            return parseInt(id);
        }

        // Check cache
        if (this.idCache.has(id)) {
            return this.idCache.get(id);
        }

        // Generate new safe ID and cache the mapping
        const safeId = this.generateSafeIntegerId();
        this.idCache.set(id, safeId);
        
        // Store reverse mapping
        this.idCache.set(safeId.toString(), id);
        
        return safeId;
    }

    /**
     * Get original ID from safe ID (if mapped)
     */
    getOriginalId(safeId) {
        return this.idCache.get(safeId.toString()) || safeId;
    }

    /**
     * Generate batch ID
     */
    generateBatchId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `BATCH_${timestamp}_${random}`;
    }

    /**
     * Extract components from batch ID
     */
    parseBatchId(batchId) {
        const match = batchId.match(/BATCH_(\d+)_(\d+)/);
        if (match) {
            return {
                timestamp: parseInt(match[1]),
                sequence: parseInt(match[2]),
                date: new Date(parseInt(match[1]))
            };
        }
        return null;
    }
}

// Create singleton instance
window.idManager = new IDManager();

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IDManager;
}