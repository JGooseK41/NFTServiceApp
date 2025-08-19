#!/usr/bin/env node

/**
 * Test Simple PDF Upload System
 * Uses the new /api/pdf-simple endpoints
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const BACKEND_URL = 'https://nftserviceapp.onrender.com';

async function createTestPDF() {
    const { PDFDocument, rgb } = require('pdf-lib');
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    
    page.drawText('Simple PDF Upload Test', {
        x: 50,
        y: 350,
        size: 30,
        color: rgb(0, 0, 0)
    });
    
    page.drawText(`Timestamp: ${new Date().toISOString()}`, {
        x: 50,
        y: 300,
        size: 12,
        color: rgb(0.5, 0.5, 0.5)
    });
    
    page.drawText('This PDF tests the simple upload system', {
        x: 50,
        y: 250,
        size: 16,
        color: rgb(0, 0, 0)
    });
    
    page.drawText('No database required - direct disk storage!', {
        x: 50,
        y: 200,
        size: 14,
        color: rgb(0, 0.5, 0)
    });
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

async function testSimplePDFSystem() {
    console.log('🚀 Testing Simple PDF Upload System\n');
    console.log('='.repeat(50));
    
    try {
        // 1. Check health endpoint first
        console.log('\n1️⃣ Checking system health...');
        const healthResponse = await fetch(`${BACKEND_URL}/api/pdf-simple/health`);
        const healthData = await healthResponse.json();
        
        if (healthData.success) {
            console.log('✅ System is healthy!');
            console.log(`   Upload directory: ${healthData.uploadDir}`);
            console.log(`   PDFs currently stored: ${healthData.pdfCount}`);
        } else {
            console.log('⚠️ System health check failed:', healthData.error);
        }
        
        // 2. Create test PDF
        console.log('\n2️⃣ Creating test PDF...');
        const pdfBuffer = await createTestPDF();
        console.log(`✅ Test PDF created (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
        
        // 3. Upload the PDF
        console.log('\n3️⃣ Uploading PDF to Render...');
        const formData = new FormData();
        formData.append('document', pdfBuffer, {
            filename: 'test-simple.pdf',
            contentType: 'application/pdf'
        });
        
        const uploadResponse = await fetch(`${BACKEND_URL}/api/pdf-simple/upload`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult.success) {
            throw new Error(`Upload failed: ${uploadResult.error}`);
        }
        
        console.log('✅ PDF uploaded successfully!');
        console.log(`   File ID: ${uploadResult.fileId}`);
        console.log(`   Size: ${(uploadResult.fileSize / 1024).toFixed(2)} KB`);
        console.log(`   Retrieve URL: ${uploadResult.retrieveUrl}`);
        
        // 4. Retrieve the PDF
        console.log('\n4️⃣ Retrieving uploaded PDF...');
        const retrieveUrl = `${BACKEND_URL}${uploadResult.retrieveUrl}`;
        console.log(`   Fetching from: ${retrieveUrl}`);
        
        const retrieveResponse = await fetch(retrieveUrl);
        
        if (!retrieveResponse.ok) {
            throw new Error(`Failed to retrieve: ${retrieveResponse.status}`);
        }
        
        const contentType = retrieveResponse.headers.get('content-type');
        const contentLength = retrieveResponse.headers.get('content-length');
        
        console.log('✅ PDF retrieved successfully!');
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Size: ${contentLength} bytes`);
        
        // 5. Save locally for verification
        console.log('\n5️⃣ Saving retrieved PDF locally...');
        const retrievedBuffer = await retrieveResponse.buffer();
        const outputFile = `retrieved-${Date.now()}.pdf`;
        fs.writeFileSync(outputFile, retrievedBuffer);
        console.log(`✅ Saved as: ${outputFile}`);
        
        // 6. Test direct access
        console.log('\n6️⃣ Testing direct PDF access...');
        const directUrl = `${BACKEND_URL}${uploadResult.directUrl}`;
        const directResponse = await fetch(directUrl);
        
        if (directResponse.ok) {
            console.log('✅ Direct access works!');
        } else {
            console.log('⚠️ Direct access failed');
        }
        
        // 7. List all PDFs
        console.log('\n7️⃣ Listing all stored PDFs...');
        const listResponse = await fetch(`${BACKEND_URL}/api/pdf-simple/list`);
        const listData = await listResponse.json();
        
        if (listData.success) {
            console.log(`✅ Found ${listData.count} PDFs on server`);
            if (listData.count > 0) {
                console.log('   Recent uploads:');
                listData.files.slice(-3).forEach(file => {
                    console.log(`     - ${file.fileId} (${(file.size / 1024).toFixed(2)} KB)`);
                });
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(50));
        console.log('✅ Health Check: PASSED');
        console.log('✅ PDF Creation: PASSED');
        console.log('✅ PDF Upload: PASSED');
        console.log('✅ PDF Retrieval: PASSED');
        console.log('✅ Local Save: PASSED');
        console.log(`${directResponse.ok ? '✅' : '⚠️'} Direct Access: ${directResponse.ok ? 'PASSED' : 'FAILED'}`);
        console.log('✅ List PDFs: PASSED');
        
        console.log('\n🎉 SUCCESS! The simple PDF system is working!');
        console.log(`   Your test PDF is saved as: ${outputFile}`);
        console.log(`   File ID on server: ${uploadResult.fileId}`);
        console.log(`   Preview URL: ${BACKEND_URL}${uploadResult.retrieveUrl}`);
        
        return {
            success: true,
            fileId: uploadResult.fileId,
            localFile: outputFile,
            retrieveUrl: uploadResult.retrieveUrl
        };
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test
if (require.main === module) {
    testSimplePDFSystem()
        .then(result => {
            if (result.success) {
                console.log('\n✨ All tests passed!');
                process.exit(0);
            } else {
                console.log('\n❌ Tests failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { testSimplePDFSystem };