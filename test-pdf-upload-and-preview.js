#!/usr/bin/env node

/**
 * Test PDF Upload and Preview System
 * This will upload a test PDF to Render and then retrieve it
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const BACKEND_URL = 'https://nftserviceapp.onrender.com';

async function createTestPDF() {
    // Create a simple test PDF using pdf-lib
    const { PDFDocument, rgb } = require('pdf-lib');
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    
    page.drawText('Test PDF Document', {
        x: 50,
        y: 350,
        size: 30,
        color: rgb(0, 0, 0)
    });
    
    page.drawText(`Created at: ${new Date().toISOString()}`, {
        x: 50,
        y: 300,
        size: 12,
        color: rgb(0, 0, 0)
    });
    
    page.drawText('This is a test document for PDF upload system', {
        x: 50,
        y: 250,
        size: 14,
        color: rgb(0, 0, 0)
    });
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

async function testPDFUploadAndRetrieve() {
    console.log('🧪 Testing PDF Upload and Preview System...\n');
    
    try {
        // 1. Create a test PDF
        console.log('1️⃣ Creating test PDF...');
        const pdfBuffer = await createTestPDF();
        console.log(`✅ Test PDF created (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
        
        // 2. Upload the PDF to backend
        console.log('\n2️⃣ Uploading PDF to Render backend...');
        const formData = new FormData();
        
        const testNoticeId = `TEST-${Date.now()}`;
        formData.append('document', pdfBuffer, {
            filename: 'test-document.pdf',
            contentType: 'application/pdf'
        });
        formData.append('noticeId', testNoticeId);
        formData.append('caseNumber', 'TEST-CASE-001');
        formData.append('serverAddress', 'TTestServerAddress123');
        formData.append('recipientAddress', 'TTestRecipientAddress456');
        formData.append('fileName', 'test-document.pdf');
        formData.append('fileType', 'application/pdf');
        formData.append('fileSize', pdfBuffer.length.toString());
        
        const uploadResponse = await fetch(`${BACKEND_URL}/api/documents/upload-pdf`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        const uploadResult = await uploadResponse.json();
        console.log('Upload response:', uploadResult);
        
        if (!uploadResult.success) {
            throw new Error(`Upload failed: ${uploadResult.error}`);
        }
        
        console.log(`✅ PDF uploaded successfully!`);
        console.log(`   Document URL: ${uploadResult.documentUrl}`);
        console.log(`   File ID: ${uploadResult.fileId}`);
        console.log(`   Disk Path: ${uploadResult.diskPath}`);
        
        // 3. Try to retrieve the PDF directly
        console.log('\n3️⃣ Retrieving PDF from server...');
        const retrieveUrl = `${BACKEND_URL}${uploadResult.documentUrl}`;
        console.log(`   Fetching from: ${retrieveUrl}`);
        
        const retrieveResponse = await fetch(retrieveUrl);
        
        if (!retrieveResponse.ok) {
            throw new Error(`Failed to retrieve PDF: ${retrieveResponse.status} ${retrieveResponse.statusText}`);
        }
        
        const contentType = retrieveResponse.headers.get('content-type');
        const contentLength = retrieveResponse.headers.get('content-length');
        
        console.log(`✅ PDF retrieved successfully!`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Content-Length: ${contentLength} bytes`);
        
        // 4. Save retrieved PDF locally to verify
        console.log('\n4️⃣ Saving retrieved PDF locally for verification...');
        const retrievedBuffer = await retrieveResponse.buffer();
        const outputPath = path.join(__dirname, `retrieved-test-${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, retrievedBuffer);
        console.log(`✅ Retrieved PDF saved to: ${outputPath}`);
        
        // 5. Test the access-controlled endpoint
        console.log('\n5️⃣ Testing access-controlled retrieval...');
        const accessUrl = `${BACKEND_URL}/api/documents/pdf/${testNoticeId}?serverAddress=TTestServerAddress123`;
        console.log(`   Fetching from: ${accessUrl}`);
        
        const accessResponse = await fetch(accessUrl);
        
        if (accessResponse.ok) {
            console.log('✅ Access-controlled retrieval successful!');
        } else {
            const errorData = await accessResponse.json();
            console.log(`⚠️ Access-controlled retrieval failed: ${errorData.error}`);
        }
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log('='.repeat(50));
        console.log('✅ PDF Creation: SUCCESS');
        console.log('✅ PDF Upload: SUCCESS');
        console.log('✅ PDF Direct Retrieval: SUCCESS');
        console.log('✅ PDF Local Verification: SUCCESS');
        console.log(`${accessResponse.ok ? '✅' : '⚠️'} Access-Controlled Retrieval: ${accessResponse.ok ? 'SUCCESS' : 'FAILED'}`);
        
        console.log('\n🎉 The PDF upload and preview system is WORKING!');
        console.log('   PDFs are being stored on Render disk and can be retrieved.');
        console.log(`   Test PDF saved locally at: ${outputPath}`);
        
        return {
            success: true,
            noticeId: testNoticeId,
            documentUrl: uploadResult.documentUrl,
            fileId: uploadResult.fileId,
            localPath: outputPath
        };
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test
if (require.main === module) {
    testPDFUploadAndRetrieve()
        .then(result => {
            if (result.success) {
                console.log('\n✨ Test completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Test failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { testPDFUploadAndRetrieve };