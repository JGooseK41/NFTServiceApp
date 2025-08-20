/**
 * Debug endpoint for batch upload issues
 * Helps diagnose what's actually failing
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * POST /api/batch/debug
 * Test the batch upload step by step to find the exact error
 */
router.post('/debug', async (req, res) => {
    const results = {
        steps: [],
        error: null,
        success: false
    };
    
    let client;
    
    try {
        // Step 1: Test database connection
        results.steps.push({ step: 'connect', status: 'attempting' });
        client = await pool.connect();
        results.steps.push({ step: 'connect', status: 'success' });
        
        // Step 2: Check tables exist
        results.steps.push({ step: 'check_tables', status: 'attempting' });
        
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('served_notices', 'batch_uploads', 'notice_batch_items', 'notice_components')
            ORDER BY table_name
        `);
        
        results.steps.push({ 
            step: 'check_tables', 
            status: 'success',
            tables: tableCheck.rows.map(r => r.table_name)
        });
        
        // Step 3: Check served_notices columns
        const columnCheck = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'served_notices'
            ORDER BY ordinal_position
        `);
        
        results.steps.push({
            step: 'check_columns',
            status: 'success',
            columns: columnCheck.rows
        });
        
        // Step 4: Test simple insert
        await client.query('BEGIN');
        results.steps.push({ step: 'begin_transaction', status: 'success' });
        
        // Test with minimal data
        const testId = `TEST_${Date.now()}`;
        const testQuery = `
            INSERT INTO batch_uploads 
            (batch_id, server_address, recipient_count, status, metadata)
            VALUES ($1::TEXT, $2::TEXT, $3::INTEGER, $4::TEXT, $5::JSONB)
            ON CONFLICT (batch_id) DO NOTHING
            RETURNING batch_id
        `;
        
        results.steps.push({ step: 'test_batch_insert', status: 'attempting' });
        
        const testResult = await client.query(testQuery, [
            testId,
            'test_address',
            1,
            'test',
            JSON.stringify({ test: true })
        ]);
        
        results.steps.push({ 
            step: 'test_batch_insert', 
            status: 'success',
            inserted: testResult.rows[0]
        });
        
        // Test served_notices insert
        const noticeQuery = `
            INSERT INTO served_notices 
            (notice_id, server_address, recipient_address, notice_type,
             case_number, alert_id, document_id, issuing_agency,
             has_document, ipfs_hash, batch_id)
            VALUES ($1::TEXT, $2::TEXT, $3::TEXT, $4::TEXT, 
                    $5::TEXT, $6::TEXT, $7::TEXT, $8::TEXT,
                    $9::BOOLEAN, $10::TEXT, $11::TEXT)
            ON CONFLICT (notice_id) DO NOTHING
            RETURNING notice_id
        `;
        
        results.steps.push({ step: 'test_notice_insert', status: 'attempting' });
        
        const noticeResult = await client.query(noticeQuery, [
            testId,
            'test_server',
            'test_recipient',
            'test_type',
            'test_case',
            testId,
            testId,
            'test_agency',
            false,
            '',
            testId
        ]);
        
        results.steps.push({ 
            step: 'test_notice_insert', 
            status: 'success',
            inserted: noticeResult.rows[0]
        });
        
        // Rollback test data
        await client.query('ROLLBACK');
        results.steps.push({ step: 'rollback', status: 'success' });
        
        results.success = true;
        results.message = 'All database operations working correctly';
        
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (e) {
                // Ignore rollback errors
            }
        }
        
        results.error = {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position,
            routine: error.routine,
            schema: error.schema,
            table: error.table,
            column: error.column,
            dataType: error.dataType,
            constraint: error.constraint,
            file: error.file,
            line: error.line,
            stack: error.stack
        };
        
        results.success = false;
        results.failedAt = results.steps[results.steps.length - 1]?.step || 'unknown';
        
    } finally {
        if (client) {
            client.release();
        }
    }
    
    res.json(results);
});

/**
 * GET /api/batch/health
 * Simple health check
 */
router.get('/health', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

/**
 * POST /api/batch/validate
 * Validate the incoming batch data without processing
 */
router.post('/validate', express.json(), (req, res) => {
    const body = req.body || {};
    const validation = {
        valid: true,
        errors: [],
        warnings: [],
        data: {}
    };
    
    // Check each field
    validation.data = {
        batchId: body.batchId || null,
        recipients: body.recipients || null,
        caseNumber: body.caseNumber || null,
        serverAddress: body.serverAddress || null,
        noticeType: body.noticeType || null,
        issuingAgency: body.issuingAgency || null,
        ipfsHash: body.ipfsHash || null,
        alertIds: body.alertIds || null,
        documentIds: body.documentIds || null
    };
    
    // Parse recipients if string
    if (typeof validation.data.recipients === 'string') {
        try {
            validation.data.recipients = JSON.parse(validation.data.recipients);
        } catch (e) {
            validation.errors.push('Recipients is not valid JSON');
            validation.valid = false;
        }
    }
    
    // Validate required fields
    if (!validation.data.batchId) {
        validation.warnings.push('No batchId provided, will be generated');
    }
    
    if (!validation.data.recipients || !Array.isArray(validation.data.recipients)) {
        validation.errors.push('Recipients must be an array');
        validation.valid = false;
    } else if (validation.data.recipients.length === 0) {
        validation.errors.push('At least one recipient is required');
        validation.valid = false;
    }
    
    if (!validation.data.serverAddress) {
        validation.errors.push('Server address is required');
        validation.valid = false;
    }
    
    // Check TRON address format
    if (validation.data.serverAddress && !validation.data.serverAddress.startsWith('T')) {
        validation.warnings.push('Server address might not be a valid TRON address');
    }
    
    if (validation.data.recipients && Array.isArray(validation.data.recipients)) {
        validation.data.recipients.forEach((addr, i) => {
            if (!addr || !addr.startsWith('T')) {
                validation.warnings.push(`Recipient ${i + 1} might not be a valid TRON address: ${addr}`);
            }
        });
    }
    
    res.json(validation);
});

module.exports = router;