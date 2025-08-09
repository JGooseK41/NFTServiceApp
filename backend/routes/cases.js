const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * Get all cases for a server address
 * Groups notices by case number with paired Alert/Document NFTs
 */
router.get('/servers/:serverAddress/cases', async (req, res) => {
    try {
        const { serverAddress } = req.params;
        console.log(`Fetching cases for server: ${serverAddress}`);
        
        // Query to get all notices grouped by case number
        const query = `
            SELECT 
                case_number,
                server_address,
                recipient_address,
                recipient_name,
                notice_type,
                issuing_agency,
                MIN(created_at) as created_at,
                MAX(updated_at) as updated_at,
                
                -- Alert NFT data
                MAX(CASE WHEN alert_id IS NOT NULL THEN alert_id END) as alert_id,
                MAX(CASE WHEN alert_id IS NOT NULL THEN notice_id END) as alert_notice_id,
                
                -- Document NFT data  
                MAX(CASE WHEN document_id IS NOT NULL THEN document_id END) as document_id,
                MAX(CASE WHEN document_id IS NOT NULL THEN notice_id END) as document_notice_id,
                MAX(CASE WHEN document_id IS NOT NULL THEN page_count END) as page_count,
                
                -- Status tracking
                BOOL_OR(accepted) as has_acceptance,
                MAX(accepted_at) as accepted_at,
                
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
                case_number,
                server_address,
                recipient_address,
                recipient_name,
                notice_type,
                issuing_agency
            ORDER BY created_at DESC
        `;
        
        const result = await pool.query(query, [serverAddress]);
        
        // Transform into structured case data
        const cases = result.rows.map(row => ({
            caseNumber: row.case_number,
            serverAddress: row.server_address,
            recipientAddress: row.recipient_address,
            recipientName: row.recipient_name,
            noticeType: row.notice_type,
            issuingAgency: row.issuing_agency,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            
            // Alert NFT
            alertId: row.alert_id,
            alertNoticeId: row.alert_notice_id,
            alertStatus: 'DELIVERED', // Alert is always delivered
            
            // Document NFT
            documentId: row.document_id,
            documentNoticeId: row.document_notice_id,
            documentStatus: row.has_acceptance ? 'SIGNED' : 'AWAITING_SIGNATURE',
            pageCount: row.page_count || 1,
            
            // Tracking
            viewCount: parseInt(row.view_count) || 0,
            lastViewedAt: row.last_viewed_at,
            acceptedAt: row.accepted_at
        }));
        
        console.log(`Found ${cases.length} cases for server ${serverAddress}`);
        
        res.json({
            success: true,
            cases,
            total: cases.length
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