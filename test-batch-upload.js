#!/usr/bin/env node

/**
 * Test script for batch upload functionality
 * Run this to verify the batch endpoint is working
 */

const { default: fetch } = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TEST_DATA = {
    batchId: `TEST_BATCH_${Date.now()}`,
    recipients: [
        'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh',
        'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
    ],
    caseNumber: 'TEST-2024-001',
    serverAddress: 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh',
    noticeType: 'Test Legal Notice',
    issuingAgency: 'Test Agency',
    alertIds: ['1000001', '1000002'],
    documentIds: ['2000001', '2000002']
};

async function testBatchUpload() {
    console.log('Testing Batch Upload Endpoint');
    console.log('==============================');
    console.log(`Backend URL: ${BACKEND_URL}`);
    console.log(`Batch ID: ${TEST_DATA.batchId}`);
    console.log(`Recipients: ${TEST_DATA.recipients.length}`);
    console.log('');

    try {
        // Step 1: Test endpoint availability
        console.log('1. Testing endpoint availability...');
        const healthCheck = await fetch(`${BACKEND_URL}/api/batch/health`, {
            method: 'GET'
        }).catch(() => null);
        
        if (!healthCheck || !healthCheck.ok) {
            console.log('   ⚠️  Batch endpoint may not be available, continuing test...');
        } else {
            console.log('   ✅ Endpoint is reachable');
        }

        // Step 2: Create form data
        console.log('2. Preparing test data...');
        const formData = new FormData();
        
        // Add batch metadata
        formData.append('batchId', TEST_DATA.batchId);
        formData.append('recipients', JSON.stringify(TEST_DATA.recipients));
        formData.append('caseNumber', TEST_DATA.caseNumber);
        formData.append('serverAddress', TEST_DATA.serverAddress);
        formData.append('noticeType', TEST_DATA.noticeType);
        formData.append('issuingAgency', TEST_DATA.issuingAgency);
        formData.append('alertIds', JSON.stringify(TEST_DATA.alertIds));
        formData.append('documentIds', JSON.stringify(TEST_DATA.documentIds));

        // Add test files (create dummy files if needed)
        const testImagePath = path.join(__dirname, 'test-image.png');
        if (!fs.existsSync(testImagePath)) {
            // Create a minimal PNG file for testing
            const pngHeader = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
                0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
                0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00,
                0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
                0x42, 0x60, 0x82
            ]);
            fs.writeFileSync(testImagePath, pngHeader);
            console.log('   Created test image file');
        }

        formData.append('thumbnail', fs.createReadStream(testImagePath), 'thumbnail.png');
        formData.append('document', fs.createReadStream(testImagePath), 'document.png');
        
        console.log('   ✅ Test data prepared');

        // Step 3: Send batch upload request
        console.log('3. Sending batch upload request...');
        const response = await fetch(`${BACKEND_URL}/api/batch/documents`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.log('   ❌ Failed to parse response:', responseText.substring(0, 200));
            throw new Error('Invalid JSON response');
        }

        if (!response.ok) {
            console.log(`   ❌ Upload failed (${response.status}):`, result.error || responseText.substring(0, 200));
            return false;
        }

        console.log('   ✅ Batch upload successful');
        console.log(`   - Batch ID: ${result.batchId}`);
        console.log(`   - Success: ${result.successCount}/${result.totalRecipients}`);
        console.log(`   - Failures: ${result.failureCount}`);

        // Step 4: Check batch status
        console.log('4. Checking batch status...');
        const statusResponse = await fetch(`${BACKEND_URL}/api/batch/${TEST_DATA.batchId}/status`);
        
        if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log('   ✅ Batch status retrieved');
            console.log(`   - Status: ${status.batch?.status || 'unknown'}`);
            console.log(`   - Items: ${status.items?.length || 0}`);
        } else {
            console.log('   ⚠️  Could not retrieve batch status');
        }

        // Cleanup test file
        if (fs.existsSync(testImagePath)) {
            fs.unlinkSync(testImagePath);
        }

        console.log('\n✅ All tests completed successfully!');
        return true;

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run test
testBatchUpload().then(success => {
    process.exit(success ? 0 : 1);
});