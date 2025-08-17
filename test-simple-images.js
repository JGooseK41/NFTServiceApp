/**
 * Test Suite for Simple Images API
 * Tests image storage and retrieval functionality
 */

const fetch = require('node-fetch');

// Configuration
const API_URL = process.env.API_URL || 'https://nftserviceapp.onrender.com';
const TEST_WALLET = 'TTestWallet' + Date.now();

// Color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

/**
 * Generate test image data
 */
function generateTestImage(type = 'alert') {
    // Create a simple 1x1 pixel image as base64
    const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    return `data:image/png;base64,${pixel}`;
}

/**
 * Test storing images
 */
async function testStoreImages() {
    console.log(`${colors.cyan}Testing: Store Images${colors.reset}`);
    
    const testData = {
        notice_id: '999999' + Date.now(),
        server_address: TEST_WALLET,
        recipient_address: 'TRecipient123',
        alert_image: generateTestImage('alert'),
        document_image: generateTestImage('document'),
        alert_thumbnail: generateTestImage('alert_thumb'),
        document_thumbnail: generateTestImage('doc_thumb'),
        transaction_hash: '0x' + Math.random().toString(36).substring(2, 15),
        case_number: 'TEST-CASE-' + Date.now()
    };
    
    try {
        const response = await fetch(`${API_URL}/api/images`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Server-Address': TEST_WALLET
            },
            body: JSON.stringify(testData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            console.log(`${colors.green}✅ Store Images: SUCCESS${colors.reset}`);
            console.log(`   Storage: ${result.storage}`);
            console.log(`   Notice ID: ${result.image?.notice_id}`);
            return testData.notice_id;
        } else {
            console.log(`${colors.red}❌ Store Images: FAILED${colors.reset}`);
            console.log(`   Error: ${result.error || 'Unknown error'}`);
            if (result.details) {
                console.log(`   Details: ${result.details}`);
            }
            return null;
        }
    } catch (error) {
        console.log(`${colors.red}❌ Store Images: ERROR${colors.reset}`);
        console.log(`   ${error.message}`);
        return null;
    }
}

/**
 * Test retrieving a specific image
 */
async function testGetImage(noticeId) {
    console.log(`\n${colors.cyan}Testing: Get Specific Image${colors.reset}`);
    
    if (!noticeId) {
        console.log(`${colors.yellow}⏭️  Skipped: No notice ID available${colors.reset}`);
        return false;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/images/${noticeId}`, {
            headers: {
                'X-Wallet-Address': TEST_WALLET
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`${colors.green}✅ Get Image: SUCCESS${colors.reset}`);
            console.log(`   Notice ID: ${data.notice_id}`);
            console.log(`   Has Alert Image: ${!!data.alert_image}`);
            console.log(`   Has Document Image: ${!!data.document_image}`);
            console.log(`   Case Number: ${data.case_number || 'N/A'}`);
            return true;
        } else if (response.status === 404) {
            console.log(`${colors.yellow}⚠️  Get Image: NOT FOUND${colors.reset}`);
            return false;
        } else {
            const error = await response.json();
            console.log(`${colors.red}❌ Get Image: FAILED${colors.reset}`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Error: ${error.error}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}❌ Get Image: ERROR${colors.reset}`);
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Test getting all images for a wallet
 */
async function testGetAllImages() {
    console.log(`\n${colors.cyan}Testing: Get All Images for Wallet${colors.reset}`);
    
    try {
        // Test as server
        let response = await fetch(`${API_URL}/api/images?role=server`, {
            headers: {
                'X-Wallet-Address': TEST_WALLET
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`${colors.green}✅ Get Images (as server): SUCCESS${colors.reset}`);
            console.log(`   Found ${Array.isArray(data) ? data.length : 0} images`);
        } else {
            console.log(`${colors.red}❌ Get Images (as server): FAILED${colors.reset}`);
        }
        
        // Test as recipient
        response = await fetch(`${API_URL}/api/images?role=recipient`, {
            headers: {
                'X-Wallet-Address': 'TRecipient123'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`${colors.green}✅ Get Images (as recipient): SUCCESS${colors.reset}`);
            console.log(`   Found ${Array.isArray(data) ? data.length : 0} images`);
        } else {
            console.log(`${colors.red}❌ Get Images (as recipient): FAILED${colors.reset}`);
        }
        
        return true;
    } catch (error) {
        console.log(`${colors.red}❌ Get All Images: ERROR${colors.reset}`);
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Test delete image
 */
async function testDeleteImage(noticeId) {
    console.log(`\n${colors.cyan}Testing: Delete Image${colors.reset}`);
    
    if (!noticeId) {
        console.log(`${colors.yellow}⏭️  Skipped: No notice ID available${colors.reset}`);
        return false;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/images/${noticeId}`, {
            method: 'DELETE',
            headers: {
                'X-Wallet-Address': TEST_WALLET
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`${colors.green}✅ Delete Image: SUCCESS${colors.reset}`);
            return true;
        } else if (response.status === 404) {
            console.log(`${colors.yellow}⚠️  Delete Image: NOT FOUND${colors.reset}`);
            return false;
        } else {
            const error = await response.json();
            console.log(`${colors.red}❌ Delete Image: FAILED${colors.reset}`);
            console.log(`   Error: ${error.error}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}❌ Delete Image: ERROR${colors.reset}`);
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Test image retrieval by transaction hash
 */
async function testGetImageByTx(txHash) {
    console.log(`\n${colors.cyan}Testing: Get Image by Transaction Hash${colors.reset}`);
    
    if (!txHash) {
        // Create a test tx hash
        txHash = '0x' + Math.random().toString(36).substring(2, 15);
    }
    
    try {
        const response = await fetch(`${API_URL}/api/images/tx/${txHash}`, {
            headers: {
                'X-Wallet-Address': TEST_WALLET
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`${colors.green}✅ Get by TX: SUCCESS${colors.reset}`);
            console.log(`   Found ${Array.isArray(data) ? data.length : 0} images`);
            return true;
        } else {
            const error = await response.json();
            console.log(`${colors.yellow}⚠️  Get by TX: No results${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}❌ Get by TX: ERROR${colors.reset}`);
        console.log(`   ${error.message}`);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}   Simple Images API Test Suite${colors.reset}`);
    console.log(`${colors.cyan}   Testing: ${API_URL}${colors.reset}`);
    console.log(`${colors.cyan}   Wallet: ${TEST_WALLET}${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);
    
    let passed = 0;
    let failed = 0;
    
    // Store images test
    const noticeId = await testStoreImages();
    if (noticeId) passed++; else failed++;
    
    // Get specific image test
    const getResult = await testGetImage(noticeId);
    if (getResult) passed++; else failed++;
    
    // Get all images test
    const getAllResult = await testGetAllImages();
    if (getAllResult) passed++; else failed++;
    
    // Get by transaction hash test
    const getTxResult = await testGetImageByTx();
    if (getTxResult) passed++; else failed++;
    
    // Delete image test (cleanup)
    const deleteResult = await testDeleteImage(noticeId);
    if (deleteResult) passed++; else failed++;
    
    // Summary
    console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}   Test Results${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}   ✅ Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}   ❌ Failed: ${failed}${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);
    
    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();