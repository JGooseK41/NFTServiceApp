/**
 * Case by Number Route - Find existing cases by case number
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * GET /api/cases/by-number/:caseNumber
 * Find a case by its case number
 */
router.get('/by-number/:caseNumber', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const { serverAddress } = req.query;

        if (!caseNumber) {
            return res.status(400).json({ 
                error: 'Case number is required' 
            });
        }

        console.log(`Looking for case with number: ${caseNumber} for server: ${serverAddress}`);

        // Query the database for the case
        const query = `
            SELECT 
                id, 
                case_number, 
                server_address, 
                metadata, 
                status, 
                created_at, 
                updated_at
            FROM cases 
            WHERE case_number = $1 
            AND ($2::text IS NULL OR server_address = $2)
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const result = await db.query(query, [caseNumber, serverAddress || null]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Case not found',
                caseNumber 
            });
        }

        const caseData = result.rows[0];

        // Parse metadata if it's a string
        if (typeof caseData.metadata === 'string') {
            try {
                caseData.metadata = JSON.parse(caseData.metadata);
            } catch (e) {
                console.error('Error parsing metadata:', e);
            }
        }

        // Get document count for this case
        const docCountQuery = `
            SELECT COUNT(*) as count 
            FROM case_documents 
            WHERE case_id = $1
        `;
        const docCountResult = await db.query(docCountQuery, [caseData.id]);
        
        if (!caseData.metadata) {
            caseData.metadata = {};
        }
        caseData.metadata.documentCount = parseInt(docCountResult.rows[0].count);

        console.log(`Found case ${caseData.id} with ${caseData.metadata.documentCount} documents`);

        res.json({ 
            success: true,
            case: caseData 
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
 * POST /api/cases/:caseId/add-documents
 * Add documents to an existing case
 */
router.post('/:caseId/add-documents', async (req, res) => {
    try {
        const { caseId } = req.params;
        const { documents } = req.body;

        if (!documents || !Array.isArray(documents)) {
            return res.status(400).json({ 
                error: 'Documents array is required' 
            });
        }

        console.log(`Adding ${documents.length} documents to case ${caseId}`);

        // Insert documents into case_documents table
        for (const doc of documents) {
            const insertQuery = `
                INSERT INTO case_documents (
                    case_id, 
                    document_name, 
                    document_type, 
                    document_size, 
                    document_data, 
                    upload_order
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `;

            await db.query(insertQuery, [
                caseId,
                doc.fileName,
                doc.fileType,
                doc.fileSize,
                doc.data,
                doc.order || 0
            ]);
        }

        // Update case metadata
        const updateQuery = `
            UPDATE cases 
            SET 
                metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{documentCount}',
                    (COALESCE(metadata->>'documentCount', '0')::int + $1)::text::jsonb
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `;

        await db.query(updateQuery, [documents.length, caseId]);

        console.log(`Successfully added ${documents.length} documents to case ${caseId}`);

        res.json({ 
            success: true,
            documentsAdded: documents.length,
            caseId 
        });

    } catch (error) {
        console.error('Error adding documents to case:', error);
        res.status(500).json({ 
            error: 'Failed to add documents',
            message: error.message 
        });
    }
});

module.exports = router;