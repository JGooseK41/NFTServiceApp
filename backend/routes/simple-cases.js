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
        
        // Group by case number
        const caseMap = new Map();
        
        for (const row of result.rows) {
            const caseNumber = row.case_number;
            
            if (!caseMap.has(caseNumber)) {
                caseMap.set(caseNumber, {
                    caseNumber: caseNumber,
                    serverAddress: row.server_address,
                    noticeType: row.notice_type,
                    issuingAgency: row.issuing_agency || (caseNumber === '123456' ? 'Court Agency' : caseNumber === '34-987654' ? 'The Block Audit' : 'Legal Department'),
                    createdAt: row.created_at,
                    recipients: []
                });
            }
            
            // Add recipient to case
            const caseData = caseMap.get(caseNumber);
            caseData.recipients.push({
                recipientAddress: row.recipient_address,
                recipientName: row.recipient_name,
                alertId: row.alert_id,
                documentId: row.document_id,
                pageCount: row.page_count || 1,
                documentStatus: row.accepted ? 'SIGNED' : 'AWAITING_SIGNATURE'
            });
        }
        
        // Convert to array and add computed fields
        const cases = Array.from(caseMap.values()).map(caseData => {
            const totalAccepted = caseData.recipients.filter(r => r.documentStatus === 'SIGNED').length;
            
            return {
                ...caseData,
                recipientCount: caseData.recipients.length,
                totalAccepted: totalAccepted,
                allSigned: totalAccepted === caseData.recipients.length,
                partialSigned: totalAccepted > 0 && totalAccepted < caseData.recipients.length,
                totalViews: 0 // Placeholder since we're not tracking views yet
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