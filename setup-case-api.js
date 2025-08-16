/**
 * Setup Case API in Backend
 * Run this to add the case management endpoints to your server
 * 
 * This script shows you what to add to your server.js file
 */

console.log(`
${'='.repeat(60)}
CASE API SETUP INSTRUCTIONS
${'='.repeat(60)}

Add these lines to your backend server.js file:

1. At the top with other requires:
${'-'.repeat(60)}
const caseRouter = require('./case-api');

2. With other middleware (after app.use(cors()) etc):
${'-'.repeat(60)}
// Case Management API
app.use('/api', caseRouter);

3. Make sure you have these dependencies installed:
${'-'.repeat(60)}
npm install express pg cors

4. The case-api.js file should be in your backend folder
   (already pushed to GitHub)

5. Your server.js should have a database pool set up like:
${'-'.repeat(60)}
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
app.set('dbPool', pool);

${'='.repeat(60)}
TESTING THE API
${'='.repeat(60)}

Once set up, test with curl:

# Create a case
curl -X POST https://nftserviceapp.onrender.com/api/cases \\
  -H "Content-Type: application/json" \\
  -H "X-Wallet-Address: YOUR_WALLET_ADDRESS" \\
  -d '{
    "case_number": "TEST-001",
    "case_title": "Test Case",
    "notice_type": "Legal Notice",
    "issuing_agency": "Test Agency"
  }'

# List your cases
curl https://nftserviceapp.onrender.com/api/cases \\
  -H "X-Wallet-Address: YOUR_WALLET_ADDRESS"

${'='.repeat(60)}
`);

// Check if we can test the API
const https = require('https');

function testAPI() {
    console.log('Testing if API is already available...\n');
    
    const options = {
        hostname: 'nftserviceapp.onrender.com',
        path: '/api/cases?status=test',
        method: 'GET',
        headers: {
            'X-Wallet-Address': 'TEST'
        }
    };
    
    const req = https.request(options, (res) => {
        console.log('API Response Status:', res.statusCode);
        
        if (res.statusCode === 404) {
            console.log('❌ Case API not found - needs to be added to server');
            console.log('   Follow the instructions above to add it');
        } else if (res.statusCode === 401) {
            console.log('✅ Case API is responding! (401 is expected for test wallet)');
            console.log('   The API is properly installed');
        } else if (res.statusCode === 200) {
            console.log('✅ Case API is working!');
        } else {
            console.log('⚠️  Unexpected response - check server logs');
        }
    });
    
    req.on('error', (error) => {
        console.error('❌ Could not connect to server:', error.message);
        console.log('   Make sure the server is running');
    });
    
    req.end();
}

testAPI();