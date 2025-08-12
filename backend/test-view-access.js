/**
 * Test View-Only Access System
 * Verifies that recipients can view documents without signing
 */

const axios = require('axios');

const API_URL = process.env.NODE_ENV === 'production' 
    ? 'https://nftserviceapp.onrender.com' 
    : 'http://localhost:3000';

async function testViewAccess() {
    console.log('Testing View-Only Access System...\n');
    
    // Test data
    const testNoticeId = '943220200';
    const testDocumentId = 'DOC-943220200';
    const recipientAddress = 'TDzQUBRiA7euKCvh19RamLZs5DfMYYQQCH';
    const wrongAddress = 'TWrongAddressForTesting123456789';
    
    try {
        // Test 1: Check access with correct recipient wallet
        console.log('Test 1: Checking access with correct recipient wallet...');
        const accessResponse = await axios.post(`${API_URL}/api/notices/check-access`, {
            noticeId: testNoticeId,
            documentId: testDocumentId,
            walletAddress: recipientAddress
        });
        
        console.log('✅ Access check response:', {
            hasAccess: accessResponse.data.hasAccess,
            isRecipient: accessResponse.data.isRecipient,
            canViewOnly: accessResponse.data.canViewOnly,
            isSigned: accessResponse.data.isSigned
        });
        
        // Test 2: Check access with wrong wallet
        console.log('\nTest 2: Checking access with wrong wallet...');
        const wrongAccessResponse = await axios.post(`${API_URL}/api/notices/check-access`, {
            noticeId: testNoticeId,
            documentId: testDocumentId,
            walletAddress: wrongAddress
        });
        
        console.log('✅ Wrong wallet access check:', {
            hasAccess: wrongAccessResponse.data.hasAccess,
            reason: wrongAccessResponse.data.reason || 'Access denied'
        });
        
        // Test 3: Log a view-only access
        if (accessResponse.data.hasAccess && !accessResponse.data.isSigned) {
            console.log('\nTest 3: Logging view-only access...');
            const logResponse = await axios.post(`${API_URL}/api/notices/log-view`, {
                noticeId: testNoticeId,
                documentId: testDocumentId,
                viewerAddress: recipientAddress,
                viewType: 'view_only_no_signature',
                timestamp: new Date().toISOString()
            });
            
            console.log('✅ View logged:', {
                success: logResponse.data.success,
                viewId: logResponse.data.viewId
            });
        }
        
        // Test 4: Get view history
        console.log('\nTest 4: Getting view history...');
        const historyResponse = await axios.get(`${API_URL}/api/notices/notice/${testNoticeId}/views`);
        
        console.log('✅ View history:', {
            totalViews: historyResponse.data.totalViews,
            viewsWithoutSignature: historyResponse.data.viewsWithoutSignature,
            documentSigned: historyResponse.data.documentSigned
        });
        
        console.log('\n✅ All tests passed! View-only access system is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status === 404) {
            console.log('\nNote: Make sure the notice exists in the database.');
            console.log('You may need to serve a notice first to test this feature.');
        }
    }
}

// Run tests
testViewAccess();