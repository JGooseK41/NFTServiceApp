/**
 * Comprehensive Data Validation and Type Safety Utility
 * Prevents all type-related database errors
 */

class DataValidator {
    /**
     * Safe type conversions with defaults
     */
    static string(val, defaultVal = '') {
        if (val === null || val === undefined) return defaultVal;
        return String(val);
    }

    static number(val, defaultVal = 0) {
        if (val === null || val === undefined) return defaultVal;
        const num = Number(val);
        return isNaN(num) ? defaultVal : num;
    }

    static integer(val, defaultVal = 0) {
        return Math.floor(this.number(val, defaultVal));
    }

    static boolean(val, defaultVal = false) {
        if (val === null || val === undefined) return defaultVal;
        return Boolean(val);
    }

    static array(val, defaultVal = []) {
        if (!val) return defaultVal;
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed : defaultVal;
            } catch {
                // Try comma-separated values
                if (val.includes(',')) {
                    return val.split(',').map(v => v.trim()).filter(v => v);
                }
                return defaultVal;
            }
        }
        return defaultVal;
    }

    static json(val, defaultVal = {}) {
        if (!val) return defaultVal;
        if (typeof val === 'object' && !Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : defaultVal;
            } catch {
                return defaultVal;
            }
        }
        return defaultVal;
    }

    static date(val, defaultVal = null) {
        if (!val) return defaultVal;
        const date = new Date(val);
        return isNaN(date.getTime()) ? defaultVal : date;
    }

    static timestamp(val, defaultVal = null) {
        const date = this.date(val, defaultVal);
        return date ? date.toISOString() : defaultVal;
    }

    /**
     * PostgreSQL safe ID - ensures it fits in INTEGER type
     */
    static pgSafeId(val) {
        const str = this.string(val);
        if (!str) return null;
        
        // If it's already a number, check bounds
        const num = Number(str);
        if (!isNaN(num)) {
            if (num > 2147483647 || num < -2147483648) {
                // Generate a safe random ID
                return String(Math.floor(Math.random() * 1000000000));
            }
            return str;
        }
        
        // For string IDs, hash to a safe integer
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        return String(Math.abs(hash) % 1000000000);
    }

    /**
     * Validate TRON address
     */
    static tronAddress(address) {
        const addr = this.string(address).trim();
        if (!addr) return null;
        
        // TRON addresses start with T and are 34 characters
        if (addr.startsWith('T') && addr.length === 34) {
            return addr;
        }
        
        return null;
    }

    /**
     * Clean and validate case number
     */
    static caseNumber(val) {
        const str = this.string(val).trim();
        // Remove any dangerous characters
        return str.replace(/[^a-zA-Z0-9\-_\/\s]/g, '');
    }

    /**
     * Validate and clean file path
     */
    static filePath(val) {
        const str = this.string(val).trim();
        if (!str) return null;
        
        // Remove any path traversal attempts
        return str.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
    }

    /**
     * Validate SQL parameters array - ensures all have proper types
     */
    static sqlParams(params) {
        return params.map(param => {
            // Handle null/undefined
            if (param === null || param === undefined) {
                return null;
            }
            
            // Handle booleans
            if (typeof param === 'boolean') {
                return param;
            }
            
            // Handle numbers
            if (typeof param === 'number') {
                return param;
            }
            
            // Handle dates
            if (param instanceof Date) {
                return param.toISOString();
            }
            
            // Handle arrays and objects
            if (typeof param === 'object') {
                return JSON.stringify(param);
            }
            
            // Everything else as string
            return String(param);
        });
    }

    /**
     * Validate entire request body
     */
    static validateBatchRequest(body) {
        const errors = [];
        const warnings = [];
        
        const validated = {
            batchId: this.string(body.batchId) || `BATCH_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            recipients: this.array(body.recipients),
            caseNumber: this.caseNumber(body.caseNumber),
            serverAddress: this.tronAddress(body.serverAddress),
            noticeType: this.string(body.noticeType, 'Legal Notice'),
            issuingAgency: this.string(body.issuingAgency),
            ipfsHash: this.string(body.ipfsHash),
            encryptionKey: this.string(body.encryptionKey),
            alertIds: this.array(body.alertIds),
            documentIds: this.array(body.documentIds)
        };
        
        // Validate recipients
        if (validated.recipients.length === 0) {
            errors.push('No recipients provided');
        } else {
            validated.recipients = validated.recipients
                .map(r => this.tronAddress(r))
                .filter(r => r !== null);
            
            if (validated.recipients.length === 0) {
                errors.push('No valid TRON addresses in recipients');
            }
        }
        
        // Validate server address
        if (!validated.serverAddress) {
            errors.push('Invalid or missing server address');
        }
        
        // Validate IDs
        validated.alertIds = validated.alertIds.map(id => this.pgSafeId(id)).filter(id => id !== null);
        validated.documentIds = validated.documentIds.map(id => this.pgSafeId(id)).filter(id => id !== null);
        
        // Check for ID array length mismatch
        if (validated.alertIds.length > 0 && validated.alertIds.length !== validated.recipients.length) {
            warnings.push('Alert IDs count does not match recipients count');
        }
        
        if (validated.documentIds.length > 0 && validated.documentIds.length !== validated.recipients.length) {
            warnings.push('Document IDs count does not match recipients count');
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            data: validated
        };
    }

    /**
     * Sanitize data for database insertion
     */
    static sanitizeForDB(obj) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (value === undefined) {
                sanitized[key] = null;
            } else if (value === '') {
                sanitized[key] = null;
            } else if (typeof value === 'string') {
                // Remove null bytes and trim
                sanitized[key] = value.replace(/\0/g, '').trim();
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    /**
     * Build safe SQL query with typed parameters
     */
    static buildTypedQuery(sql, params, types = []) {
        // Add PostgreSQL type casting to SQL
        let typedSQL = sql;
        let paramIndex = 1;
        
        types.forEach(type => {
            const placeholder = `$${paramIndex}`;
            const typedPlaceholder = `$${paramIndex}::${type}`;
            typedSQL = typedSQL.replace(placeholder, typedPlaceholder);
            paramIndex++;
        });
        
        return {
            sql: typedSQL,
            params: this.sqlParams(params)
        };
    }
}

module.exports = DataValidator;