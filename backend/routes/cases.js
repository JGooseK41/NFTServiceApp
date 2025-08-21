const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/cases/by-number/:caseNumber
 * Find a case by its case number
 */
router.get('/cases/by-number/:caseNumber', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const { serverAddress } = req.query;

        if (!caseNumber) {
            return res.status(400).json({ 
                error: 'Case number is required' 
            });
        }

        console.log(`Looking for case with number: ${caseNumber} for server: ${serverAddress}`);

        // Query to find case by case number
        const query = `
            SELECT 
                case_number,
                server_address,
                notice_type,
                issuing_agency,
                MIN(created_at) as created_at,
                MAX(updated_at) as updated_at,
                COUNT(DISTINCT recipient_address) as recipient_count,
                COUNT(*) as notice_count,
                array_agg(DISTINCT recipient_address) as recipients,
                array_agg(DISTINCT recipient_name) as recipient_names
            FROM served_notices
            WHERE case_number = $1 
            AND ($2::text IS NULL OR server_address = $2)
            GROUP BY case_number, server_address, notice_type, issuing_agency
            ORDER BY MIN(created_at) DESC
            LIMIT 1
        `;

        const result = await pool.query(query, [caseNumber, serverAddress || null]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Case not found',
                caseNumber 
            });
        }

        const caseData = result.rows[0];
        
        // Format as case object
        const formattedCase = {
            id: caseNumber, // Use case number as ID
            case_number: caseData.case_number,
            server_address: caseData.server_address,
            metadata: {
                noticeType: caseData.notice_type,
                issuingAgency: caseData.issuing_agency,
                recipientCount: caseData.recipient_count,
                noticeCount: caseData.notice_count,
                recipients: caseData.recipients,
                recipientNames: caseData.recipient_names
            },
            status: 'existing',
            created_at: caseData.created_at,
            updated_at: caseData.updated_at
        };

        console.log(`Found case ${caseNumber} with ${caseData.notice_count} notices`);

        res.json({ 
            success: true,
            case: formattedCase 
        });

    } catch (error) {
        console.error('Error finding case by number:', error);
        res.status(500).json({ 
            error: 'Failed to find case',
            message: error.message 
        });
    }
});

/**
 * Get all cases for a server address
 * Groups notices by case number, supporting multiple recipients per case
 */
router.get('/servers/:serverAddress/cases', async (req, res) => {
    try {
        const { serverAddress } = req.params;
        console.log(`Fetching cases for server: ${serverAddress}`);
        
        // Query to get all notices, then group by case in application logic
        const query = `
            SELECT 
                sn.case_number,
                sn.server_address,
                sn.recipient_address,
                sn.recipient_name,
                sn.notice_type,
                sn.issuing_agency,
                sn.created_at,
                sn.updated_at,
                sn.notice_id,
                sn.alert_id,
                sn.document_id,
                sn.page_count,
                sn.accepted,
                sn.accepted_at,
                
                -- View tracking
                COUNT(DISTINCT nv.id) as view_count,
                MAX(nv.viewed_at) as last_viewed_at
                
            FROM served_notices sn
            LEFT JOIN notice_views nv ON nv.notice_id = sn.notice_id
            WHERE LOWER(sn.server_address) = LOWER($1)
                AND sn.case_number IS NOT NULL
                AND sn.case_number != ''
                AND sn.case_number NOT LIKE '%TEST%'
            GROUP BY 
                sn.id,
                sn.case_number,
                sn.server_address,
                sn.recipient_address,
                sn.recipient_name,
                sn.notice_type,
                sn.issuing_agency,
                sn.created_at,
                sn.updated_at,
                sn.notice_id,
                sn.alert_id,
                sn.document_id,
                sn.page_count,
                sn.accepted,
                sn.accepted_at
            ORDER BY sn.case_number, sn.created_at DESC
        `;
        
        const result = await pool.query(query, [serverAddress]);
        
        // Group notices by case number to handle multiple recipients
        const caseMap = new Map();
        
        for (const row of result.rows) {
            const caseNumber = row.case_number;
            
            if (!caseMap.has(caseNumber)) {
                // Initialize case with first recipient
                caseMap.set(caseNumber, {
                    caseNumber: caseNumber,
                    serverAddress: row.server_address,
                    noticeType: row.notice_type,
                    issuingAgency: row.issuing_agency,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    
                    // Array of recipients for this case
                    recipients: [],
                    
                    // Aggregate tracking
                    totalViews: 0,
                    totalAccepted: 0,
                    lastViewedAt: null,
                    firstServedAt: row.created_at,
                    lastServedAt: row.created_at
                });
            }
            
            const caseData = caseMap.get(caseNumber);
            
            // Add recipient data
            caseData.recipients.push({
                recipientAddress: row.recipient_address,
                recipientName: row.recipient_name || '',
                noticeId: row.notice_id,
                
                // NFT pairing
                alertId: row.alert_id,
                documentId: row.document_id,
                
                // Status
                alertStatus: 'DELIVERED',
                documentStatus: row.accepted ? 'SIGNED' : 'AWAITING_SIGNATURE',
                
                // Tracking
                viewCount: parseInt(row.view_count) || 0,
                lastViewedAt: row.last_viewed_at,
                acceptedAt: row.accepted_at,
                servedAt: row.created_at,
                pageCount: row.page_count || 1
            });
            
            // Update aggregate data
            caseData.totalViews += parseInt(row.view_count) || 0;
            if (row.accepted) caseData.totalAccepted++;
            
            // Update timestamps
            if (!caseData.lastViewedAt || (row.last_viewed_at && row.last_viewed_at > caseData.lastViewedAt)) {
                caseData.lastViewedAt = row.last_viewed_at;
            }
            if (row.created_at < caseData.firstServedAt) {
                caseData.firstServedAt = row.created_at;
            }
            if (row.created_at > caseData.lastServedAt) {
                caseData.lastServedAt = row.created_at;
            }
        }
        
        // Convert map to array and add summary
        const cases = Array.from(caseMap.values()).map(caseData => ({
            ...caseData,
            recipientCount: caseData.recipients.length,
            allSigned: caseData.totalAccepted === caseData.recipients.length,
            partialSigned: caseData.totalAccepted > 0 && caseData.totalAccepted < caseData.recipients.length
        }));
        
        console.log(`Found ${cases.length} cases with ${result.rows.length} total notices for server ${serverAddress}`);
        
        res.json({
            success: true,
            cases,
            totalCases: cases.length,
            totalNotices: result.rows.length
        });
        
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch cases' 
        });
    }
});

/**
 * Create a new notice (properly tracks server address)
 */
router.post('/notices/create', async (req, res) => {
    try {
        const {
            caseNumber,
            serverAddress, // This should be the actual server, not null
            recipientAddress,
            recipientName,
            noticeType,
            issuingAgency,
            alertDescription,
            documentDescription,
            pageCount
        } = req.body;
        
        console.log('Creating notice with server address:', serverAddress);
        
        // Start transaction
        await pool.query('BEGIN');
        
        try {
            // Create the main notice record
            const noticeQuery = `
                INSERT INTO served_notices (
                    notice_id,
                    case_number,
                    server_address,
                    recipient_address,
                    recipient_name,
                    notice_type,
                    issuing_agency,
                    page_count,
                    status,
                    created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
                ) RETURNING *
            `;
            
            const noticeId = `notice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const values = [
                noticeId,
                caseNumber,
                serverAddress, // Actual server address
                recipientAddress,
                recipientName,
                noticeType,
                issuingAgency,
                pageCount || 1,
                'PENDING_BLOCKCHAIN'
            ];
            
            const result = await pool.query(noticeQuery, values);
            
            await pool.query('COMMIT');
            
            res.json({
                success: true,
                id: result.rows[0].id,
                noticeId: noticeId,
                message: 'Notice created successfully'
            });
            
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('Error creating notice:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create notice' 
        });
    }
});

/**
 * Update notice with blockchain data
 */
router.put('/notices/:noticeId/blockchain', async (req, res) => {
    try {
        const { noticeId } = req.params;
        const {
            alertId,
            documentId,
            transactionHash,
            blockNumber
        } = req.body;
        
        const query = `
            UPDATE served_notices
            SET 
                alert_id = $2,
                document_id = $3,
                transaction_hash = $4,
                block_number = $5,
                status = 'ON_BLOCKCHAIN',
                updated_at = NOW()
            WHERE notice_id = $1
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            noticeId,
            alertId,
            documentId,
            transactionHash,
            blockNumber
        ]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Notice not found'
            });
        }
        
        res.json({
            success: true,
            notice: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error updating notice:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update notice'
        });
    }
});

/**
 * Get audit trail for a case
 */
router.get('/cases/:caseNumber/audit', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        // Get all views for this case
        const viewsQuery = `
            SELECT 
                nv.*,
                sn.case_number
            FROM notice_views nv
            JOIN served_notices sn ON sn.notice_id = nv.notice_id
            WHERE sn.case_number = $1
            ORDER BY nv.viewed_at DESC
        `;
        
        const viewsResult = await pool.query(viewsQuery, [caseNumber]);
        
        // Get acceptance data
        const acceptanceQuery = `
            SELECT 
                na.*,
                sn.case_number
            FROM notice_acceptances na
            JOIN served_notices sn ON sn.notice_id = na.notice_id
            WHERE sn.case_number = $1
        `;
        
        const acceptanceResult = await pool.query(acceptanceQuery, [caseNumber]);
        
        res.json({
            success: true,
            caseNumber,
            views: viewsResult.rows,
            acceptances: acceptanceResult.rows,
            summary: {
                totalViews: viewsResult.rows.length,
                uniqueViewers: [...new Set(viewsResult.rows.map(v => v.viewer_address))].length,
                accepted: acceptanceResult.rows.length > 0,
                firstViewed: viewsResult.rows[viewsResult.rows.length - 1]?.viewed_at,
                lastViewed: viewsResult.rows[0]?.viewed_at,
                acceptedAt: acceptanceResult.rows[0]?.accepted_at
            }
        });
        
    } catch (error) {
        console.error('Error fetching audit trail:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit trail'
        });
    }
});

/**
 * Clear test data (for development)
 */
router.delete('/test-data', async (req, res) => {
    try {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                success: false,
                error: 'Cannot clear data in production'
            });
        }
        
        await pool.query(`
            DELETE FROM served_notices 
            WHERE case_number LIKE '%TEST%'
        `);
        
        res.json({
            success: true,
            message: 'Test data cleared'
        });
        
    } catch (error) {
        console.error('Error clearing test data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear test data'
        });
    }
});

module.exports = router;