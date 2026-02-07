const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection with proper pooling and error handling
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
});

// Handle pool errors
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle database client', err);
});

/**
 * Simple endpoint to get cases without joins
 */
router.get('/servers/:serverAddress/simple-cases', async (req, res) => {
    let client;
    
    try {
        const { serverAddress } = req.params;
        
        // Validate server address format
        if (!serverAddress || !/^T[A-Za-z0-9]{33}$/.test(serverAddress)) {
            return res.status(400).json({ 
                error: 'Invalid server address format',
                success: false 
            });
        }
        
        console.log(`Simple fetch for server: ${serverAddress}`);
        
        // Get a client from the pool
        client = await pool.connect();
        
        // Query to get cases from cases table with case_service_records for service data
        // Primary source: cases table + case_service_records
        // Fallback: served_notices for backwards compatibility
        const query = `
            -- Get all cases from cases table with their service records
            SELECT
                c.id::text as case_number,
                c.server_address,
                c.status as case_status,
                COALESCE(c.metadata->>'noticeType', 'Legal Notice') as notice_type,
                COALESCE(c.metadata->>'issuingAgency', 'The Block Audit') as issuing_agency,
                c.created_at,
                c.metadata as case_metadata,
                csr.transaction_hash,
                csr.alert_token_id,
                csr.recipients as csr_recipients,
                csr.served_at,
                CASE WHEN c.status = 'served' THEN 'served' ELSE 'draft' END as source
            FROM cases c
            LEFT JOIN case_service_records csr ON c.id::text = csr.case_number
            WHERE LOWER(c.server_address) = LOWER($1)

            UNION ALL

            -- Fallback: Get cases from served_notices that aren't in cases table
            SELECT
                sn.case_number,
                sn.server_address,
                'served' as case_status,
                sn.notice_type,
                sn.issuing_agency,
                sn.created_at,
                NULL as case_metadata,
                NULL as transaction_hash,
                sn.alert_id as alert_token_id,
                NULL as csr_recipients,
                sn.created_at as served_at,
                'served' as source
            FROM served_notices sn
            WHERE LOWER(sn.server_address) = LOWER($1)
                AND sn.case_number IS NOT NULL
                AND sn.case_number != ''
                AND NOT EXISTS (
                    SELECT 1 FROM cases c
                    WHERE c.id::text = sn.case_number
                )

            ORDER BY created_at DESC
        `;
        
        const result = await client.query(query, [serverAddress]);

        // Helper to extract recipients from various sources
        const extractRecipients = (row) => {
            let recipients = [];

            // Try case_service_records recipients first
            if (row.csr_recipients) {
                try {
                    const parsed = typeof row.csr_recipients === 'string'
                        ? JSON.parse(row.csr_recipients)
                        : row.csr_recipients;
                    if (Array.isArray(parsed)) {
                        recipients = parsed.map(r => typeof r === 'string' ? r : r.address || r);
                    }
                } catch (e) { /* ignore */ }
            }

            // Fall back to case metadata recipients
            if (recipients.length === 0 && row.case_metadata) {
                try {
                    const metadata = typeof row.case_metadata === 'string'
                        ? JSON.parse(row.case_metadata)
                        : row.case_metadata;
                    if (metadata.recipients && Array.isArray(metadata.recipients)) {
                        recipients = metadata.recipients.map(r => typeof r === 'string' ? r : r.address || r);
                    }
                } catch (e) { /* ignore */ }
            }

            return recipients;
        };

        // Group by case number
        const caseMap = new Map();

        for (const row of result.rows) {
            const caseNumber = row.case_number;

            if (!caseMap.has(caseNumber)) {
                const recipients = extractRecipients(row);

                caseMap.set(caseNumber, {
                    caseNumber: caseNumber,
                    serverAddress: row.server_address,
                    status: row.case_status || row.source,
                    noticeType: row.notice_type,
                    issuingAgency: row.issuing_agency || 'The Block Audit',
                    createdAt: row.created_at,
                    servedAt: row.served_at,
                    transactionHash: row.transaction_hash,
                    alertTokenId: row.alert_token_id,
                    recipients: recipients
                });
            } else {
                // Update with service data if available
                const caseData = caseMap.get(caseNumber);
                if (!caseData.transactionHash && row.transaction_hash) {
                    caseData.transactionHash = row.transaction_hash;
                }
                if (!caseData.alertTokenId && row.alert_token_id) {
                    caseData.alertTokenId = row.alert_token_id;
                }
                if (!caseData.servedAt && row.served_at) {
                    caseData.servedAt = row.served_at;
                }
            }
        }

        // Convert to array
        const cases = Array.from(caseMap.values()).map(caseData => {
            const isServed = caseData.status === 'served';
            const recipientCount = caseData.recipients ? caseData.recipients.length : 0;

            return {
                caseNumber: caseData.caseNumber,
                serverAddress: caseData.serverAddress,
                status: caseData.status,
                noticeType: caseData.noticeType,
                issuingAgency: caseData.issuingAgency,
                createdAt: caseData.createdAt,
                servedAt: caseData.servedAt,
                transactionHash: caseData.transactionHash,
                alertTokenId: caseData.alertTokenId,
                recipients: caseData.recipients,
                recipientCount: recipientCount,
                isServed: isServed
            };
        });
        
        res.json({
            success: true,
            cases: cases,
            total: cases.length
        });
        
    } catch (error) {
        console.error('Error fetching simple cases:', error);

        // Temporarily expose error for debugging
        res.status(500).json({
            error: 'Database error',
            message: error.message,
            stack: error.stack,
            success: false
        });
    } finally {
        // Always release the client back to the pool
        if (client) {
            client.release();
        }
    }
});

module.exports = router;