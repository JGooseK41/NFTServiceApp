/**
 * Direct API call to delete orphaned case 34-9633897
 */

const https = require('https');

const caseNumber = '34-9633897';
const serverAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';

// Make DELETE request to backend
const options = {
    hostname: 'nftservice-backend.onrender.com',
    port: 443,
    path: `/api/cases/${encodeURIComponent(caseNumber)}`,
    method: 'DELETE',
    headers: {
        'Content-Type': 'application/json',
        'X-Server-Address': serverAddress
    }
};

console.log('=== DELETING ORPHANED CASE ===');
console.log('Case Number:', caseNumber);
console.log('Server Address:', serverAddress);
console.log('API Endpoint:', `https://${options.hostname}${options.path}`);
console.log('');

const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        
        try {
            const response = JSON.parse(data);
            console.log('Response:', JSON.stringify(response, null, 2));
            
            if (res.statusCode === 200 && response.success) {
                console.log('\n✅ Successfully deleted orphaned case!');
                console.log('You can now create case 34-9633897 fresh in the UI.');
            } else if (res.statusCode === 404) {
                console.log('\nℹ️ Case not found - it may have been cleaned up already.');
                console.log('You should be able to create it now.');
            } else {
                console.log('\n⚠️ Unexpected response. You may need to manually check the database.');
            }
        } catch (e) {
            console.log('Raw Response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error making request:', error.message);
    console.log('\n=== ALTERNATIVE SOLUTION ===');
    console.log('Since the API call failed, you can:');
    console.log('1. Try creating the case with a different number (e.g., 34-9633897-v2)');
    console.log('2. Or wait for the backend to restart and try again');
});

req.end();