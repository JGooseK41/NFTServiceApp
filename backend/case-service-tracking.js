/**
 * Case Service Tracking
 * Tracks multiple service instances for a single case
 */

const { Pool } = require('pg');

class CaseServiceTracking {
    constructor() {
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
        });
        
        this.initTable();
    }

    /**
     * Create service tracking table
     */
    async initTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS case_services (
                id SERIAL PRIMARY KEY,
                case_id VARCHAR(50) NOT NULL,
                recipient_address VARCHAR(100) NOT NULL,
                service_date TIMESTAMP DEFAULT NOW(),
                
                -- NFT Data
                alert_nft_id VARCHAR(100),
                document_nft_id VARCHAR(100),
                tx_hash VARCHAR(100),
                ipfs_hash VARCHAR(100),
                encryption_key VARCHAR(100),
                
                -- Service Details
                service_type VARCHAR(50) DEFAULT 'standard',
                service_method VARCHAR(50) DEFAULT 'blockchain',
                service_status VARCHAR(20) DEFAULT 'pending',
                
                -- Tracking
                viewed_at TIMESTAMP,
                signed_at TIMESTAMP,
                acknowledged BOOLEAN DEFAULT FALSE,
                
                -- Metadata
                notes TEXT,
                metadata JSONB,
                
                -- Indexes
                CONSTRAINT unique_case_recipient UNIQUE(case_id, recipient_address)
            );
            
            CREATE INDEX IF NOT EXISTS idx_case_services_case ON case_services(case_id);
            CREATE INDEX IF NOT EXISTS idx_case_services_recipient ON case_services(recipient_address);
            CREATE INDEX IF NOT EXISTS idx_case_services_date ON case_services(service_date DESC);
        `;
        
        try {
            await this.db.query(query);
            console.log('✅ Case services tracking table ready');
        } catch (error) {
            console.error('Failed to create case services table:', error);
        }
    }

    /**
     * Record a new service for a case
     */
    async recordService(caseId, recipientAddress, serviceData = {}) {
        const query = `
            INSERT INTO case_services (
                case_id, 
                recipient_address, 
                service_type,
                service_method,
                service_status,
                notes,
                metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (case_id, recipient_address) 
            DO UPDATE SET
                service_date = NOW(),
                service_status = EXCLUDED.service_status,
                notes = EXCLUDED.notes,
                metadata = EXCLUDED.metadata
            RETURNING *
        `;
        
        const values = [
            caseId,
            recipientAddress,
            serviceData.serviceType || 'standard',
            serviceData.serviceMethod || 'blockchain',
            'pending',
            serviceData.notes || null,
            JSON.stringify(serviceData.metadata || {})
        ];
        
        try {
            const result = await this.db.query(query, values);
            console.log(`📋 Recorded service for case ${caseId} to ${recipientAddress}`);
            return result.rows[0];
        } catch (error) {
            console.error('Failed to record service:', error);
            throw error;
        }
    }

    /**
     * Update service with blockchain transaction details
     */
    async updateServiceWithTransaction(caseId, recipientAddress, txData) {
        const query = `
            UPDATE case_services 
            SET 
                alert_nft_id = $3,
                document_nft_id = $4,
                tx_hash = $5,
                ipfs_hash = $6,
                encryption_key = $7,
                service_status = 'served',
                service_date = NOW()
            WHERE case_id = $1 AND recipient_address = $2
            RETURNING *
        `;
        
        const values = [
            caseId,
            recipientAddress,
            txData.alertNftId,
            txData.documentNftId,
            txData.txHash,
            txData.ipfsHash,
            txData.encryptionKey
        ];
        
        try {
            const result = await this.db.query(query, values);
            console.log(`✅ Updated service transaction for ${recipientAddress}`);
            return result.rows[0];
        } catch (error) {
            console.error('Failed to update service transaction:', error);
            throw error;
        }
    }

    /**
     * Get all services for a case
     */
    async getCaseServices(caseId) {
        const query = `
            SELECT * FROM case_services 
            WHERE case_id = $1 
            ORDER BY service_date DESC
        `;
        
        try {
            const result = await this.db.query(query, [caseId]);
            return result.rows;
        } catch (error) {
            console.error('Failed to get case services:', error);
            throw error;
        }
    }

    /**
     * Get service statistics for a case
     */
    async getCaseServiceStats(caseId) {
        const query = `
            SELECT 
                COUNT(*) as total_recipients,
                COUNT(CASE WHEN service_status = 'served' THEN 1 END) as served_count,
                COUNT(CASE WHEN service_status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN viewed_at IS NOT NULL THEN 1 END) as viewed_count,
                COUNT(CASE WHEN signed_at IS NOT NULL THEN 1 END) as signed_count,
                MIN(service_date) as first_service_date,
                MAX(service_date) as last_service_date
            FROM case_services 
            WHERE case_id = $1
        `;
        
        try {
            const result = await this.db.query(query, [caseId]);
            return result.rows[0];
        } catch (error) {
            console.error('Failed to get case stats:', error);
            return null;
        }
    }

    /**
     * Mark document as viewed
     */
    async markAsViewed(caseId, recipientAddress) {
        const query = `
            UPDATE case_services 
            SET viewed_at = NOW() 
            WHERE case_id = $1 AND recipient_address = $2 AND viewed_at IS NULL
            RETURNING *
        `;
        
        try {
            const result = await this.db.query(query, [caseId, recipientAddress]);
            if (result.rows.length > 0) {
                console.log(`👁️ Document viewed by ${recipientAddress}`);
            }
            return result.rows[0];
        } catch (error) {
            console.error('Failed to mark as viewed:', error);
        }
    }

    /**
     * Mark document as signed
     */
    async markAsSigned(caseId, recipientAddress) {
        const query = `
            UPDATE case_services 
            SET signed_at = NOW(), acknowledged = true 
            WHERE case_id = $1 AND recipient_address = $2 AND signed_at IS NULL
            RETURNING *
        `;
        
        try {
            const result = await this.db.query(query, [caseId, recipientAddress]);
            if (result.rows.length > 0) {
                console.log(`✍️ Document signed by ${recipientAddress}`);
            }
            return result.rows[0];
        } catch (error) {
            console.error('Failed to mark as signed:', error);
        }
    }

    /**
     * Get pending services (not yet served)
     */
    async getPendingServices(serverAddress = null) {
        let query = `
            SELECT cs.*, c.server_address, c.metadata as case_metadata
            FROM case_services cs
            JOIN cases c ON cs.case_id = c.id
            WHERE cs.service_status = 'pending'
        `;
        
        const values = [];
        if (serverAddress) {
            query += ' AND c.server_address = $1';
            values.push(serverAddress);
        }
        
        query += ' ORDER BY cs.service_date DESC';
        
        try {
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            console.error('Failed to get pending services:', error);
            return [];
        }
    }

    /**
     * Batch serve - prepare multiple recipients for one case
     */
    async prepareBatchService(caseId, recipients) {
        const services = [];
        
        for (const recipient of recipients) {
            const service = await this.recordService(caseId, recipient.address, {
                serviceType: recipient.serviceType || 'standard',
                notes: recipient.notes || '',
                metadata: recipient.metadata || {}
            });
            services.push(service);
        }
        
        console.log(`📦 Prepared batch service for ${recipients.length} recipients`);
        return services;
    }
}

module.exports = CaseServiceTracking;