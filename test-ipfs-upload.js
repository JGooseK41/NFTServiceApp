/**
 * Test IPFS upload functionality
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_URL = 'https://nftserviceapp.onrender.com';
// const API_URL = 'http://localhost:3001';

async function testIPFSUpload() {
    try {
        console.log('Testing IPFS upload endpoint...\n');
        
        // First test if Pinata is configured
        console.log('1. Testing Pinata configuration...');
        const testResponse = await axios.get(`${API_URL}/api/pinata/test`);
        console.log('Pinata status:', testResponse.data);
        
        // Create a test document
        console.log('\n2. Creating test document...');
        const testContent = Buffer.from('Test legal document for IPFS upload - ' + new Date().toISOString());
        
        // Upload to IPFS
        console.log('\n3. Uploading to IPFS...');
        const formData = new FormData();
        formData.append('file', testContent, 'test-document.txt');
        
        const metadata = {
            name: 'Test Legal Document',
            keyvalues: {
                type: 'test',
                timestamp: new Date().toISOString()
            }
        };
        formData.append('pinataMetadata', JSON.stringify(metadata));
        
        const uploadResponse = await axios.post(
            `${API_URL}/api/uploadDocument`,
            formData,
            {
                headers: formData.getHeaders()
            }
        );
        
        console.log('Upload response:', uploadResponse.data);
        
        if (uploadResponse.data.ipfsHash) {
            console.log('\n✅ IPFS upload successful!');
            console.log('IPFS Hash:', uploadResponse.data.ipfsHash);
            
            if (!uploadResponse.data.placeholder) {
                console.log('View at: https://gateway.pinata.cloud/ipfs/' + uploadResponse.data.ipfsHash);
            } else {
                console.log('(Placeholder hash - Pinata not configured)');
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testIPFSUpload();