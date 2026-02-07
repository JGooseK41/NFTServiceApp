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
        
        // Query to get cases from cases table with case_service_records for recipient details
        // Primary source: cases table + case_service_records
        // Fallback: served_notices for backwards compatibility
        const query = `
            -- Get all cases from cases table with their service records
            SELECT
                c.id::text as case_number,
                c.server_address,
                c.status as case_status,
                csr.recipient_address,
                csr.recipient_name,
                COALESCE(csr.notice_type, c.metadata->>'noticeType', 'Legal Notice') as notice_type,
                COALESCE(c.metadata->>'issuingAgency', 'The Block Audit') as issuing_agency,
                c.created_at,
                csr.token_id as alert_id,
                NULL as document_id,
                csr.transaction_hash,
                false as accepted,
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
                sn.recipient_address,
                sn.recipient_name,
                sn.notice_type,
                sn.issuing_agency,
                sn.created_at,
                sn.alert_id,
                sn.document_id,
                NULL as transaction_hash,
                sn.accepted,
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
        
        // Group by case number and aggregate recipient data
        const caseMap = new Map();

        for (const row of result.rows) {
            const caseNumber = row.case_number;

            if (!caseMap.has(caseNumber)) {
                caseMap.set(caseNumber, {
                    caseNumber: caseNumber,
                    serverAddress: row.server_address,
                    status: row.case_status || row.source, // Use case_status from cases table
                    noticeType: row.notice_type,
                    issuingAgency: row.issuing_agency || 'The Block Audit',
                    createdAt: row.created_at,
                    transactionHash: row.transaction_hash,
                    recipients: new Map() // Use Map to group by recipient
                });
            }

            const caseData = caseMap.get(caseNumber);

            // Update transaction hash if not set but row has one
            if (!caseData.transactionHash && row.transaction_hash) {
                caseData.transactionHash = row.transaction_hash;
            }

            // Only add recipient if we have recipient data
            if (row.recipient_address) {
                if (!caseData.recipients.has(row.recipient_address)) {
                    // Create a new service event for this recipient
                    caseData.recipients.set(row.recipient_address, {
                        recipientAddress: row.recipient_address,
                        recipientName: row.recipient_name,
                        alertId: row.alert_id,
                        documentId: row.document_id,
                        pageCount: 1, // Default to 1 since page_count is in notice_components
                        documentStatus: row.accepted ? 'SIGNED' : 'AWAITING_SIGNATURE',
                        isPaired: !!(row.alert_id && row.document_id) // Set isPaired if both IDs exist
                    });
                } else {
                    // This recipient already has a notice, merge Alert and Document IDs
                    const existing = caseData.recipients.get(row.recipient_address);
                    if (row.alert_id && !existing.alertId) {
                        existing.alertId = row.alert_id;
                    }
                    if (row.document_id && !existing.documentId) {
                        existing.documentId = row.document_id;
                        existing.pageCount = row.page_count || existing.pageCount;
                    }
                    // Mark as paired if we have both Alert and Document
                    if (existing.alertId && existing.documentId) {
                        existing.isPaired = true;
                    }
                    // Update status if newer notice is accepted
                    if (row.accepted) {
                        existing.documentStatus = 'SIGNED';
                    }
                }
            }
        }
        
        // Convert to array and add computed fields
        const cases = Array.from(caseMap.values()).map(caseData => {
            // Convert recipients Map to array
            const recipientsArray = Array.from(caseData.recipients.values());
            const totalAccepted = recipientsArray.filter(r => r.documentStatus === 'SIGNED').length;
            const isServed = caseData.status === 'served';

            return {
                caseNumber: caseData.caseNumber,
                serverAddress: caseData.serverAddress,
                status: caseData.status, // Include case status (draft/served)
                noticeType: caseData.noticeType,
                issuingAgency: caseData.issuingAgency,
                createdAt: caseData.createdAt,
                transactionHash: caseData.transactionHash, // Include transaction hash
                recipients: recipientsArray, // Convert Map back to array
                recipientCount: recipientsArray.length, // Count unique recipients (service events)
                totalAccepted: totalAccepted,
                allSigned: totalAccepted === recipientsArray.length && recipientsArray.length > 0,
                partialSigned: totalAccepted > 0 && totalAccepted < recipientsArray.length,
                isServed: isServed, // Explicit served flag
                totalViews: 0,
                // Include a count of actual individual notices for debugging
                totalNotices: recipientsArray.reduce((count, r) => {
                    // Count 1 for single notice, 2 for paired Alert+Document
                    return count + (r.isPaired ? 2 : 1);
                }, 0)
            };
        });
        
        res.json({
            success: true,
            cases: cases,
            total: cases.length
        });
        
    } catch (error) {
        console.error('Error fetching simple cases:', error);
        
        // Don't expose internal error details to client
        const message = process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while fetching cases';
        
        res.status(500).json({ 
            error: 'Database error', 
            message: message,
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