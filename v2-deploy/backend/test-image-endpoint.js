const fetch = require('node-fetch');

async function testImageEndpoint(noticeId) {
    const url = `https://nftserviceapp.onrender.com/api/documents/${noticeId}/images`;
    
    console.log(`Testing endpoint: ${url}\n`);
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(data, null, 2));
        
        if (data.alertThumbnailUrl) {
            console.log('\nAlert Thumbnail URL type:', 
                data.alertThumbnailUrl.startsWith('data:') ? 'Data URL (base64)' : 'File URL');
            console.log('First 100 chars:', data.alertThumbnailUrl.substring(0, 100));
        }
        
        if (data.documentUnencryptedUrl) {
            console.log('\nDocument URL type:', 
                data.documentUnencryptedUrl.startsWith('data:') ? 'Data URL (base64)' : 'File URL');
            console.log('First 100 chars:', data.documentUnencryptedUrl.substring(0, 100));
        }
        
    } catch (error) {
        console.error('Error calling endpoint:', error.message);
    }
}

// Test with the notice ID from the error
testImageEndpoint('943220200');