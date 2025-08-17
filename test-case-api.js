/**
 * Comprehensive Test Suite for Case Management API
 * Tests all endpoints and functionality
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');

// Configuration
const API_URL = process.env.API_URL || 'https://nftserviceapp.onrender.com';
const TEST_SERVER_ADDRESS = 'TEST-SERVER-' + Date.now();

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Test results tracking
let testResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
};

/**
 * Log test result
 */
function logTest(name, status, details = '') {
    const statusSymbol = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
    const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow;
    
    console.log(`${color}${statusSymbol} ${name}${colors.reset}`);
    if (details) {
        console.log(`   ${details}`);
    }
    
    testResults.tests.push({ name, status, details });
    if (status === 'pass') testResults.passed++;
    else if (status === 'fail') testResults.failed++;
    else testResults.skipped++;
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint() {
    const testName = 'Health Check Endpoint';
    try {
        const response = await fetch(`${API_URL}/api/health`);
        if (response.ok) {
            const data = await response.json();
            logTest(testName, 'pass', `Status: ${response.status}, Message: ${data.message || 'OK'}`);
            return true;
        } else {
            logTest(testName, 'fail', `Status: ${response.status}`);
            return false;
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return false;
    }
}

/**
 * Test case API test endpoint
 */
async function testCaseTestEndpoint() {
    const testName = 'Case API Test Endpoint';
    try {
        const response = await fetch(`${API_URL}/api/cases/test`);
        if (response.ok) {
            const data = await response.json();
            logTest(testName, 'pass', `Success: ${data.success}`);
            return true;
        } else {
            logTest(testName, 'fail', `Status: ${response.status}`);
            return false;
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return false;
    }
}

/**
 * Create sample PDFs for testing
 */
async function createSamplePDFs() {
    const testName = 'Create Sample PDF Files';
    try {
        // Check if sample PDFs exist
        const samplesDir = path.join(__dirname, 'test-samples');
        try {
            await fs.access(samplesDir);
        } catch {
            await fs.mkdir(samplesDir, { recursive: true });
        }
        
        // Create a simple text file that we'll treat as PDF for testing
        const pdf1Path = path.join(samplesDir, 'test1.pdf');
        const pdf2Path = path.join(samplesDir, 'test2.pdf');
        
        // For real testing, these should be actual PDFs
        // For now, create dummy files
        await fs.writeFile(pdf1Path, 'PDF content 1');
        await fs.writeFile(pdf2Path, 'PDF content 2');
        
        logTest(testName, 'pass', 'Created 2 sample files');
        return [pdf1Path, pdf2Path];
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return [];
    }
}

/**
 * Test case creation
 */
async function testCreateCase(pdfPaths) {
    const testName = 'Create New Case';
    try {
        const form = new FormData();
        
        // Add PDFs to form
        for (const pdfPath of pdfPaths) {
            const fileContent = await fs.readFile(pdfPath);
            form.append('documents', fileContent, {
                filename: path.basename(pdfPath),
                contentType: 'application/pdf'
            });
        }
        
        // Add metadata
        form.append('description', 'Test case created at ' + new Date().toISOString());
        form.append('caseType', 'test');
        form.append('urgency', 'normal');
        form.append('serverAddress', TEST_SERVER_ADDRESS);
        
        const response = await fetch(`${API_URL}/api/cases`, {
            method: 'POST',
            headers: {
                'X-Server-Address': TEST_SERVER_ADDRESS,
                ...form.getHeaders()
            },
            body: form
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.caseId) {
                logTest(testName, 'pass', `Case ID: ${data.caseId}`);
                return data.caseId;
            } else {
                logTest(testName, 'fail', `Response: ${JSON.stringify(data)}`);
                return null;
            }
        } else {
            const text = await response.text();
            logTest(testName, 'fail', `Status: ${response.status}, Body: ${text}`);
            return null;
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return null;
    }
}

/**
 * Test list cases
 */
async function testListCases() {
    const testName = 'List Cases';
    try {
        const response = await fetch(`${API_URL}/api/cases?serverAddress=${TEST_SERVER_ADDRESS}`, {
            headers: {
                'X-Server-Address': TEST_SERVER_ADDRESS
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.cases)) {
                logTest(testName, 'pass', `Found ${data.cases.length} cases`);
                return data.cases;
            } else {
                logTest(testName, 'fail', `Invalid response format`);
                return [];
            }
        } else {
            logTest(testName, 'fail', `Status: ${response.status}`);
            return [];
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return [];
    }
}

/**
 * Test get case details
 */
async function testGetCase(caseId) {
    const testName = 'Get Case Details';
    if (!caseId) {
        logTest(testName, 'skip', 'No case ID available');
        return null;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/cases/${caseId}?serverAddress=${TEST_SERVER_ADDRESS}`, {
            headers: {
                'X-Server-Address': TEST_SERVER_ADDRESS
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.case) {
                logTest(testName, 'pass', `Case status: ${data.case.status}`);
                return data.case;
            } else {
                logTest(testName, 'fail', 'Invalid response format');
                return null;
            }
        } else {
            logTest(testName, 'fail', `Status: ${response.status}`);
            return null;
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return null;
    }
}

/**
 * Test get case PDF
 */
async function testGetCasePDF(caseId) {
    const testName = 'Get Case PDF';
    if (!caseId) {
        logTest(testName, 'skip', 'No case ID available');
        return false;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/cases/${caseId}/pdf?serverAddress=${TEST_SERVER_ADDRESS}`, {
            headers: {
                'X-Server-Address': TEST_SERVER_ADDRESS
            }
        });
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            
            if (contentType && contentType.includes('application/pdf')) {
                logTest(testName, 'pass', `PDF size: ${contentLength || 'unknown'} bytes`);
                return true;
            } else {
                logTest(testName, 'fail', `Wrong content type: ${contentType}`);
                return false;
            }
        } else {
            logTest(testName, 'fail', `Status: ${response.status}`);
            return false;
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return false;
    }
}

/**
 * Test prepare case for serving
 */
async function testPrepareCaseForServing(caseId) {
    const testName = 'Prepare Case for Serving';
    if (!caseId) {
        logTest(testName, 'skip', 'No case ID available');
        return null;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/cases/${caseId}/prepare`, {
            method: 'POST',
            headers: {
                'X-Server-Address': TEST_SERVER_ADDRESS,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipientAddress: 'TTestRecipient123',
                serverAddress: TEST_SERVER_ADDRESS
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.ipfsHash) {
                logTest(testName, 'pass', `IPFS Hash: ${data.ipfsHash}`);
                return data;
            } else {
                logTest(testName, 'fail', 'Invalid response format');
                return null;
            }
        } else {
            logTest(testName, 'fail', `Status: ${response.status}`);
            return null;
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return null;
    }
}

/**
 * Test storage statistics
 */
async function testStorageStats() {
    const testName = 'Storage Statistics';
    try {
        const response = await fetch(`${API_URL}/api/storage/stats?serverAddress=${TEST_SERVER_ADDRESS}`, {
            headers: {
                'X-Server-Address': TEST_SERVER_ADDRESS
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const info = `Cases: ${data.caseCount?.total || 0}, Disk: ${data.disk?.percentUsed || 'N/A'}`;
                logTest(testName, 'pass', info);
                return data;
            } else {
                logTest(testName, 'fail', 'Invalid response format');
                return null;
            }
        } else {
            logTest(testName, 'fail', `Status: ${response.status}`);
            return null;
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return null;
    }
}

/**
 * Test delete case
 */
async function testDeleteCase(caseId) {
    const testName = 'Delete Case';
    if (!caseId) {
        logTest(testName, 'skip', 'No case ID available');
        return false;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/cases/${caseId}?serverAddress=${TEST_SERVER_ADDRESS}`, {
            method: 'DELETE',
            headers: {
                'X-Server-Address': TEST_SERVER_ADDRESS
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                logTest(testName, 'pass', 'Case deleted');
                return true;
            } else {
                logTest(testName, 'fail', data.error || 'Failed to delete');
                return false;
            }
        } else {
            logTest(testName, 'fail', `Status: ${response.status}`);
            return false;
        }
    } catch (error) {
        logTest(testName, 'fail', error.message);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}   Case Management API Test Suite${colors.reset}`);
    console.log(`${colors.cyan}   Testing: ${API_URL}${colors.reset}`);
    console.log(`${colors.cyan}   Server: ${TEST_SERVER_ADDRESS}${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);
    
    // Track test case ID for cleanup
    let createdCaseId = null;
    
    try {
        // Basic connectivity tests
        console.log(`${colors.blue}▶ Testing API Connectivity${colors.reset}`);
        await testHealthEndpoint();
        await testCaseTestEndpoint();
        
        // Case management tests
        console.log(`\n${colors.blue}▶ Testing Case Management${colors.reset}`);
        
        // Create sample PDFs
        const pdfPaths = await createSamplePDFs();
        
        // Create a case
        if (pdfPaths.length > 0) {
            createdCaseId = await testCreateCase(pdfPaths);
        }
        
        // List cases
        const cases = await testListCases();
        
        // Get case details
        if (createdCaseId) {
            await testGetCase(createdCaseId);
            await testGetCasePDF(createdCaseId);
            await testPrepareCaseForServing(createdCaseId);
        }
        
        // Storage stats
        await testStorageStats();
        
        // Cleanup - delete the test case
        if (createdCaseId) {
            await testDeleteCase(createdCaseId);
        }
        
    } catch (error) {
        console.error(`${colors.red}Test suite error: ${error.message}${colors.reset}`);
    }
    
    // Print summary
    console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}   Test Results Summary${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}   ✅ Passed: ${testResults.passed}${colors.reset}`);
    console.log(`${colors.red}   ❌ Failed: ${testResults.failed}${colors.reset}`);
    console.log(`${colors.yellow}   ⏭️  Skipped: ${testResults.skipped}${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();