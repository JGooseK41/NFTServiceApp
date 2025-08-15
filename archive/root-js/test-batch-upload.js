/**
 * Test script for batch document upload
 * Run this to verify the batch upload is working after migration
 */

async function testBatchUpload() {
    const API_URL = process.env.API_URL || 'https://nftserviceapp.onrender.com';
    
    const testData = {
        batchId: `BATCH_${Date.now()}`,
        recipients: [
            "TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE"
        ],
        serverAddress: "TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY",
        caseNumber: "TEST-" + Math.floor(Math.random() * 10000),
        noticeType: "Legal Notice",
        issuingAgency: "Test Agency",
        alertIds: [],
        documentIds: []
    };
    
    console.log('🚀 Testing batch upload endpoint...');
    console.log('📦 Batch ID:', testData.batchId);
    console.log('👥 Recipients:', testData.recipients.length);
    
    try {
        const response = await fetch(`${API_URL}/api/batch/documents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('\n✅ Batch upload successful!');
            console.log('📊 Results:');
            console.log(`  - Total Recipients: ${result.totalRecipients}`);
            console.log(`  - Successful: ${result.successCount}`);
            console.log(`  - Failed: ${result.failureCount}`);
            console.log(`  - Status: ${result.status}`);
            console.log('\n📝 Notice IDs created:');
            result.results.forEach((r, i) => {
                console.log(`  ${i + 1}. ${r.recipient}: ${r.noticeId} (${r.status})`);
            });
        } else {
            console.error('\n❌ Batch upload failed:');
            console.error('Error:', result.error);
            if (result.detail) console.error('Detail:', result.detail);
            if (result.hint) console.error('Hint:', result.hint);
        }
        
        return result;
        
    } catch (error) {
        console.error('\n💥 Request failed:', error.message);
        throw error;
    }
}

// Run the test
console.log('=====================================');
console.log('Batch Upload Test Script');
console.log('=====================================');
console.log('Target:', process.env.API_URL || 'https://nftserviceapp.onrender.com');
console.log('Time:', new Date().toISOString());
console.log('=====================================\n');

testBatchUpload()
    .then(result => {
        console.log('\n✨ Test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    });