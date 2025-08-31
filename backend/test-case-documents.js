/**
 * Test script for case documents API
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';
const CASE_NUMBER = '34-2312-235579';

async function testCaseDocumentsAPI() {
    console.log('=== Testing Case Documents API ===\n');
    
    try {
        // Test 1: Get all documents for a case
        console.log(`1. Fetching documents for case ${CASE_NUMBER}...`);
        const response = await axios.get(`${API_BASE}/api/case-documents/${CASE_NUMBER}/images`);
        
        console.log('\n=== Response Summary ===');
        console.log(`Success: ${response.data.success}`);
        console.log(`Case Number: ${response.data.case_number}`);
        console.log('\nStatistics:');
        console.log(`  Total documents: ${response.data.stats.total_documents}`);
        console.log(`  With alert images: ${response.data.stats.with_alert_images}`);
        console.log(`  With document images: ${response.data.stats.with_document_images}`);
        console.log(`  With IPFS: ${response.data.stats.with_ipfs}`);
        console.log(`  Case service records: ${response.data.stats.case_service_records}`);
        
        if (response.data.documents.length > 0) {
            console.log('\n=== Documents Found ===');
            response.data.documents.forEach((doc, index) => {
                console.log(`\n${index + 1}. Notice ID: ${doc.notice_id}`);
                console.log(`   Source: ${doc.source}`);
                console.log(`   Alert image available: ${doc.images.alert_thumbnail_available}`);
                console.log(`   Document image available: ${doc.images.document_available}`);
                if (doc.ipfs) {
                    console.log(`   IPFS Alert: ${doc.ipfs.alert_hash || 'N/A'}`);
                    console.log(`   IPFS Document: ${doc.ipfs.document_hash || 'N/A'}`);
                }
                console.log(`   Created: ${doc.created_at}`);
            });
        } else {
            console.log('\n❌ No documents found for this case');
        }
        
        // Test 2: Get documents with data URLs
        console.log('\n2. Testing with dataurl format...');
        const dataUrlResponse = await axios.get(
            `${API_BASE}/api/case-documents/${CASE_NUMBER}/images?format=dataurl`
        );
        
        if (dataUrlResponse.data.documents.length > 0) {
            const firstDoc = dataUrlResponse.data.documents[0];
            if (firstDoc.images.alert_thumbnail) {
                console.log(`   ✅ Alert thumbnail data URL generated (${firstDoc.images.alert_thumbnail.substring(0, 50)}...)`);
            }
            if (firstDoc.images.document) {
                console.log(`   ✅ Document data URL generated (${firstDoc.images.document.substring(0, 50)}...)`);
            }
        }
        
        // Test 3: Get specific document image
        if (response.data.documents.length > 0) {
            const noticeId = response.data.documents[0].notice_id;
            console.log(`\n3. Testing direct image retrieval for notice ${noticeId}...`);
            
            try {
                const imageResponse = await axios.get(
                    `${API_BASE}/api/case-documents/notice/${noticeId}/image?type=document`,
                    { responseType: 'arraybuffer' }
                );
                console.log(`   ✅ Document image retrieved (${imageResponse.data.byteLength} bytes)`);
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    console.log(`   ❌ No document image available for notice ${noticeId}`);
                } else {
                    throw error;
                }
            }
            
            try {
                const alertResponse = await axios.get(
                    `${API_BASE}/api/case-documents/notice/${noticeId}/image?type=alert`,
                    { responseType: 'arraybuffer' }
                );
                console.log(`   ✅ Alert thumbnail retrieved (${alertResponse.data.byteLength} bytes)`);
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    console.log(`   ❌ No alert image available for notice ${noticeId}`);
                } else {
                    throw error;
                }
            }
        }
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

// Run tests
testCaseDocumentsAPI();