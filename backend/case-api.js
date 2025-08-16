/**
 * Case Management API Endpoints
 * For 2-stage case preparation workflow
 */

const express = require('express');
const router = express.Router();

// Middleware to check wallet authentication
const authenticateWallet = (req, res, next) => {
    const walletAddress = req.headers['x-wallet-address'];
    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address required' });
    }
    req.walletAddress = walletAddress;
    next();
};

/**
 * GET /api/cases
 * List cases for the server
 */
router.get('/cases', authenticateWallet, async (req, res) => {
    try {
        const { status } = req.query;
        const pool = req.app.get('dbPool');
        
        let query = `
            SELECT * FROM prepared_cases 
            WHERE server_address = $1
        `;
        const params = [req.walletAddress];
        
        if (status) {
            query += ' AND status = $2';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ error: 'Failed to fetch cases' });
    }
});

/**
 * GET /api/cases/:id
 * Get specific case
 */
router.get('/cases/:id', authenticateWallet, async (req, res) => {
    try {
        const pool = req.app.get('dbPool');
        
        const result = await pool.query(
            'SELECT * FROM prepared_cases WHERE id = $1 AND server_address = $2',
            [req.params.id, req.walletAddress]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ error: 'Failed to fetch case' });
    }
});

/**
 * POST /api/cases
 * Create new case
 */
router.post('/cases', authenticateWallet, async (req, res) => {
    try {
        const pool = req.app.get('dbPool');
        const {
            case_number,
            case_title,
            notice_type,
            issuing_agency,
            status = 'preparing'
        } = req.body;
        
        // Check if case already exists
        const existing = await pool.query(
            'SELECT id FROM prepared_cases WHERE case_number = $1 AND server_address = $2',
            [case_number, req.walletAddress]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Case already exists' });
        }
        
        const result = await pool.query(
            `INSERT INTO prepared_cases 
            (case_number, case_title, notice_type, issuing_agency, server_address, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *`,
            [case_number, case_title, notice_type, issuing_agency, req.walletAddress, status]
        );
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error creating case:', error);
        res.status(500).json({ error: 'Failed to create case' });
    }
});

/**
 * PATCH /api/cases/:id
 * Update case status
 */
router.patch('/cases/:id', authenticateWallet, async (req, res) => {
    try {
        const pool = req.app.get('dbPool');
        const { status } = req.body;
        
        const result = await pool.query(
            `UPDATE prepared_cases 
            SET status = $1, updated_at = NOW()
            WHERE id = $2 AND server_address = $3
            RETURNING *`,
            [status, req.params.id, req.walletAddress]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error updating case:', error);
        res.status(500).json({ error: 'Failed to update case' });
    }
});

/**
 * DELETE /api/cases/:id
 * Delete case
 */
router.delete('/cases/:id', authenticateWallet, async (req, res) => {
    try {
        const pool = req.app.get('dbPool');
        
        // Delete documents first
        await pool.query(
            'DELETE FROM case_documents WHERE case_id = $1',
            [req.params.id]
        );
        
        // Delete case
        const result = await pool.query(
            'DELETE FROM prepared_cases WHERE id = $1 AND server_address = $2 RETURNING id',
            [req.params.id, req.walletAddress]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error deleting case:', error);
        res.status(500).json({ error: 'Failed to delete case' });
    }
});

/**
 * POST /api/cases/:id/documents
 * Store processed documents for a case
 */
router.post('/cases/:id/documents', authenticateWallet, async (req, res) => {
    try {
        const pool = req.app.get('dbPool');
        const {
            alert_image,
            alert_thumbnail,
            document_image,
            document_thumbnail,
            page_count,
            file_names
        } = req.body;
        
        // Verify case exists and belongs to user
        const caseCheck = await pool.query(
            'SELECT id FROM prepared_cases WHERE id = $1 AND server_address = $2',
            [req.params.id, req.walletAddress]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        // Store documents
        const result = await pool.query(
            `INSERT INTO case_documents 
            (case_id, alert_image, alert_thumbnail, document_image, document_thumbnail, page_count, file_names, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (case_id) 
            DO UPDATE SET 
                alert_image = EXCLUDED.alert_image,
                alert_thumbnail = EXCLUDED.alert_thumbnail,
                document_image = EXCLUDED.document_image,
                document_thumbnail = EXCLUDED.document_thumbnail,
                page_count = EXCLUDED.page_count,
                file_names = EXCLUDED.file_names,
                updated_at = NOW()
            RETURNING *`,
            [req.params.id, alert_image, alert_thumbnail, document_image, document_thumbnail, page_count, file_names]
        );
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error storing documents:', error);
        res.status(500).json({ error: 'Failed to store documents' });
    }
});

/**
 * GET /api/cases/:id/documents
 * Get documents for a case
 */
router.get('/cases/:id/documents', authenticateWallet, async (req, res) => {
    try {
        const pool = req.app.get('dbPool');
        
        // Verify case belongs to user
        const caseCheck = await pool.query(
            'SELECT id FROM prepared_cases WHERE id = $1 AND server_address = $2',
            [req.params.id, req.walletAddress]
        );
        
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        const result = await pool.query(
            'SELECT * FROM case_documents WHERE case_id = $1',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No documents found' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

module.exports = router;