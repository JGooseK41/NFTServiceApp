const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * Simple endpoint to get cases without joins
 */
router.get('/servers/:serverAddress/simple-cases', async (req, res) => {
    try {
        const { serverAddress } = req.params;
        console.log(`Simple fetch for server: ${serverAddress}`);
        
        // Simple query without joins
        const query = `
            SELECT 
                case_number,
                server_address,
                recipient_address,
                recipient_name,
                notice_type,
                issuing_agency,
                created_at,
                notice_id,
                alert_id,
                document_id,
                page_count,
                accepted
            FROM served_notices
            WHERE LOWER(server_address) = LOWER($1)
                AND case_number IS NOT NULL
                AND case_number != ''
            ORDER BY created_at DESC
        `;
        
        const result = await pool.query(query, [serverAddress]);
        
        // Group by case number and pair Alert+Document notices per recipient
        const caseMap = new Map();
        const recipientNotices = new Map(); // Track notices by recipient to pair Alert+Document
        
        for (const row of result.rows) {
            const caseNumber = row.case_number;
            
            if (!caseMap.has(caseNumber)) {
                caseMap.set(caseNumber, {
                    caseNumber: caseNumber,
                    serverAddress: row.server_address,
                    noticeType: row.notice_type,
                    issuingAgency: row.issuing_agency || 'The Block Audit',
                    createdAt: row.created_at,
                    recipients: new Map() // Use Map to group by recipient
                });
            }
            
            const caseData = caseMap.get(caseNumber);
            const recipientKey = `${caseNumber}_${row.recipient_address}`;
            
            // Check if we already have a notice for this recipient in this case
            if (!caseData.recipients.has(row.recipient_address)) {
                // Create a new service event for this recipient
                caseData.recipients.set(row.recipient_address, {
                    recipientAddress: row.recipient_address,
                    recipientName: row.recipient_name,
                    alertId: row.alert_id,
                    documentId: row.document_id,
                    pageCount: row.page_count || 1,
                    documentStatus: row.accepted ? 'SIGNED' : 'AWAITING_SIGNATURE',
                    isPaired: false // Track if this is a paired Alert+Document
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
        
        // Convert to array and add computed fields
        const cases = Array.from(caseMap.values()).map(caseData => {
            // Convert recipients Map to array
            const recipientsArray = Array.from(caseData.recipients.values());
            const totalAccepted = recipientsArray.filter(r => r.documentStatus === 'SIGNED').length;
            
            return {
                ...caseData,
                recipients: recipientsArray, // Convert Map back to array
                recipientCount: recipientsArray.length, // Count unique recipients (service events)
                totalAccepted: totalAccepted,
                allSigned: totalAccepted === recipientsArray.length,
                partialSigned: totalAccepted > 0 && totalAccepted < recipientsArray.length,
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
        res.status(500).json({ 
            error: 'Database error', 
            message: error.message 
        });
    }
});

module.exports = router;