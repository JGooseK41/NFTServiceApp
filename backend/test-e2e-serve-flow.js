/**
 * End-to-End Test: Document Serve Flow
 *
 * This script tests the complete flow from document upload to recipient viewing
 * to identify where the linkage breaks down.
 *
 * Run: node test-e2e-serve-flow.js
 */

const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const CONFIG = {
    // Use production for testing against real data
    BACKEND_URL: process.env.BACKEND_URL || 'https://nftserviceapp.onrender.com',
    DATABASE_URL: process.env.DATABASE_URL,

    // Test data
    TEST_SERVER_WALLET: 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY', // Admin wallet
    TEST_RECIPIENT_WALLET: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH', // Test recipient
    TEST_CASE_NUMBER: `TEST-${Date.now()}`,

    // Simulate blockchain token IDs (in real flow, these come from contract)
    SIMULATED_ALERT_TOKEN_ID: '999',
    SIMULATED_DOC_TOKEN_ID: '1000',
};

const pool = CONFIG.DATABASE_URL ? new Pool({
    connectionString: CONFIG.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
}) : null;

// Test results tracking
const testResults = {
    steps: [],
    passed: 0,
    failed: 0,
    errors: []
};

function logStep(step, status, details = {}) {
    const result = { step, status, details, timestamp: new Date().toISOString() };
    testResults.steps.push(result);

    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
    console.log(`${icon} ${step}`);
    if (details.message) console.log(`   ${details.message}`);
    if (details.error) console.log(`   ERROR: ${details.error}`);

    if (status === 'PASS') testResults.passed++;
    if (status === 'FAIL') {
        testResults.failed++;
        testResults.errors.push({ step, ...details });
    }
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('END-TO-END TEST: Document Serve Flow');
    console.log('='.repeat(60));
    console.log(`Backend: ${CONFIG.BACKEND_URL}`);
    console.log(`Test Case: ${CONFIG.TEST_CASE_NUMBER}`);
    console.log(`Recipient: ${CONFIG.TEST_RECIPIENT_WALLET}`);
    console.log('='.repeat(60) + '\n');

    // STEP 1: Health check
    console.log('\n--- STEP 1: Backend Health Check ---');
    try {
        const health = await axios.get(`${CONFIG.BACKEND_URL}/health`);
        logStep('Backend health check', health.data.status === 'ok' ? 'PASS' : 'FAIL', {
            message: `Status: ${health.data.status}`
        });
    } catch (e) {
        logStep('Backend health check', 'FAIL', { error: e.message });
    }

    // STEP 2: Check current state of recipient's records
    console.log('\n--- STEP 2: Check Recipient Current State ---');
    try {
        const response = await axios.get(
            `${CONFIG.BACKEND_URL}/api/recipient-cases/wallet/${CONFIG.TEST_RECIPIENT_WALLET}`
        );
        const notices = response.data.notices || [];
        logStep('Fetch recipient notices', 'PASS', {
            message: `Found ${notices.length} existing notices`
        });

        // Check for placeholder cases
        const placeholders = notices.filter(n => n.case_number?.includes('PLACEHOLDER'));
        if (placeholders.length > 0) {
            logStep('Check for placeholder cases', 'FAIL', {
                message: `Found ${placeholders.length} placeholder cases - these indicate broken linkage`,
                details: placeholders.map(p => p.case_number)
            });
        } else {
            logStep('Check for placeholder cases', 'PASS', {
                message: 'No placeholder cases found'
            });
        }
    } catch (e) {
        logStep('Fetch recipient notices', 'FAIL', { error: e.message });
    }

    // STEP 3: Simulate document upload (what frontend does)
    console.log('\n--- STEP 3: Simulate Document Upload ---');

    // Create a test image/document
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const testImageBuffer = Buffer.from(testImageBase64, 'base64');

    // Write temp file
    const tempFilePath = path.join(__dirname, 'test-document.png');
    fs.writeFileSync(tempFilePath, testImageBuffer);

    let uploadResult = null;
    try {
        const formData = new FormData();
        formData.append('thumbnail', fs.createReadStream(tempFilePath), 'test-document.png');
        formData.append('document', fs.createReadStream(tempFilePath), 'test-document.png');
        formData.append('batchId', `batch-${Date.now()}`);
        formData.append('caseNumber', CONFIG.TEST_CASE_NUMBER);
        formData.append('noticeType', 'Test Notice');
        formData.append('issuingAgency', 'Test Agency');
        formData.append('serverAddress', CONFIG.TEST_SERVER_WALLET);
        formData.append('recipients', JSON.stringify([CONFIG.TEST_RECIPIENT_WALLET]));
        formData.append('ipfsHash', 'QmTestHash123456789');
        formData.append('encryptionKey', 'test-encryption-key-123');

        // This is the KEY part - pass the blockchain token IDs
        formData.append('alertIds', JSON.stringify([CONFIG.SIMULATED_ALERT_TOKEN_ID]));
        formData.append('documentIds', JSON.stringify([CONFIG.SIMULATED_DOC_TOKEN_ID]));

        const response = await axios.post(
            `${CONFIG.BACKEND_URL}/api/batch/documents`,
            formData,
            { headers: formData.getHeaders() }
        );

        uploadResult = response.data;
        logStep('Document upload', response.data.success ? 'PASS' : 'FAIL', {
            message: response.data.message || 'Upload completed',
            details: response.data
        });
    } catch (e) {
        logStep('Document upload', 'FAIL', {
            error: e.response?.data?.error || e.message,
            details: e.response?.data
        });
    } finally {
        // Clean up temp file
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }

    // STEP 4: Verify database records were created correctly
    console.log('\n--- STEP 4: Verify Database Records ---');

    if (pool) {
        // Check notice_components
        try {
            const nc = await pool.query(`
                SELECT alert_id, document_id, case_number,
                       alert_thumbnail_url IS NOT NULL as has_thumbnail,
                       document_unencrypted_url IS NOT NULL as has_doc_url,
                       document_ipfs_hash
                FROM notice_components
                WHERE case_number = $1
            `, [CONFIG.TEST_CASE_NUMBER]);

            if (nc.rows.length > 0) {
                const row = nc.rows[0];
                const alertIdCorrect = row.alert_id === CONFIG.SIMULATED_ALERT_TOKEN_ID;
                logStep('notice_components record created', 'PASS', {
                    message: `Alert ID: ${row.alert_id}, Doc ID: ${row.document_id}`
                });
                logStep('Alert ID matches blockchain token', alertIdCorrect ? 'PASS' : 'FAIL', {
                    message: alertIdCorrect
                        ? 'IDs match correctly'
                        : `Expected ${CONFIG.SIMULATED_ALERT_TOKEN_ID}, got ${row.alert_id}`
                });
            } else {
                logStep('notice_components record created', 'FAIL', {
                    message: 'No record found'
                });
            }
        } catch (e) {
            logStep('notice_components verification', 'FAIL', { error: e.message });
        }

        // Check case_service_records
        try {
            const csr = await pool.query(`
                SELECT case_number, alert_token_id, document_token_id,
                       ipfs_hash, recipients
                FROM case_service_records
                WHERE case_number = $1
            `, [CONFIG.TEST_CASE_NUMBER]);

            if (csr.rows.length > 0) {
                const row = csr.rows[0];
                logStep('case_service_records created', 'PASS', {
                    message: `Token IDs: Alert=${row.alert_token_id}, Doc=${row.document_token_id}`
                });
            } else {
                logStep('case_service_records created', 'FAIL', {
                    message: 'No record found - THIS IS THE MISSING LINK!'
                });
            }
        } catch (e) {
            logStep('case_service_records verification', 'FAIL', { error: e.message });
        }

        // Check served_notices
        try {
            const sn = await pool.query(`
                SELECT notice_id, alert_id, document_id, case_number, ipfs_hash
                FROM served_notices
                WHERE case_number = $1
            `, [CONFIG.TEST_CASE_NUMBER]);

            if (sn.rows.length > 0) {
                logStep('served_notices record created', 'PASS', {
                    message: `Notice ID: ${sn.rows[0].notice_id}`
                });
            } else {
                logStep('served_notices record created', 'FAIL', {
                    message: 'No record found'
                });
            }
        } catch (e) {
            logStep('served_notices verification', 'FAIL', { error: e.message });
        }
    } else {
        logStep('Database verification', 'SKIP', {
            message: 'No DATABASE_URL provided - skipping direct DB checks'
        });
    }

    // STEP 5: Test recipient document access
    console.log('\n--- STEP 5: Test Recipient Document Access ---');
    try {
        const response = await axios.get(
            `${CONFIG.BACKEND_URL}/api/recipient-cases/${CONFIG.TEST_CASE_NUMBER}/document`
        );

        const hasImages = response.data.notice?.images &&
            (response.data.notice.images.alert_image || response.data.notice.images.document_image);

        logStep('Fetch document for case', response.data.success ? 'PASS' : 'FAIL', {
            message: response.data.success ? 'Document retrieved' : 'Failed to retrieve'
        });

        logStep('Document has images', hasImages ? 'PASS' : 'FAIL', {
            message: hasImages ? 'Images present' : 'NO IMAGES - Recipient sees placeholder!',
            details: response.data.notice?.images
        });

    } catch (e) {
        logStep('Recipient document access', 'FAIL', { error: e.message });
    }

    // STEP 6: Cleanup test data (optional)
    console.log('\n--- STEP 6: Cleanup ---');
    if (pool) {
        try {
            await pool.query(`DELETE FROM notice_components WHERE case_number = $1`, [CONFIG.TEST_CASE_NUMBER]);
            await pool.query(`DELETE FROM served_notices WHERE case_number = $1`, [CONFIG.TEST_CASE_NUMBER]);
            await pool.query(`DELETE FROM case_service_records WHERE case_number = $1`, [CONFIG.TEST_CASE_NUMBER]);
            logStep('Cleanup test data', 'PASS', { message: 'Test records removed' });
        } catch (e) {
            logStep('Cleanup test data', 'FAIL', { error: e.message });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);

    if (testResults.errors.length > 0) {
        console.log('\nFailed Steps:');
        testResults.errors.forEach(err => {
            console.log(`  - ${err.step}: ${err.error || err.message}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('KEY FINDINGS:');
    console.log('='.repeat(60));
    console.log(`
1. The batch-documents endpoint creates records in:
   - notice_components ✓
   - served_notices ✓

2. BUT it does NOT create records in:
   - case_service_records ❌

3. case_service_records is what BlockServed uses to find notices!

4. The fix needs to either:
   a) Add case_service_records insert to batch-documents.js
   b) OR make recipient-cases-api.js query notice_components directly
`);

    if (pool) await pool.end();
}

runTests().catch(console.error);
