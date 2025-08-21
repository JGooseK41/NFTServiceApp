const fetch = require('node-fetch');

async function testCasesAPI() {
    const serverAddress = 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';
    const backendUrl = 'https://nftserviceapp.onrender.com';
    
    try {
        // Test simple-cases endpoint
        console.log('Testing simple-cases endpoint...');
        const response = await fetch(`${backendUrl}/api/servers/${serverAddress}/simple-cases`, {
            headers: {
                'X-Server-Address': serverAddress
            }
        });
        
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        
        // Also test the direct cases endpoint
        console.log('\nTesting direct cases endpoint...');
        const casesResponse = await fetch(`${backendUrl}/api/cases?serverAddress=${serverAddress}`, {
            headers: {
                'X-Server-Address': serverAddress
            }
        });
        
        if (casesResponse.ok) {
            const casesData = await casesResponse.json();
            console.log('Cases response:', JSON.stringify(casesData, null, 2));
        } else {
            console.log('Cases endpoint returned:', casesResponse.status, casesResponse.statusText);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testCasesAPI();
