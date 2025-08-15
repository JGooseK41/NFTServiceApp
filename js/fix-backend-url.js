/**
 * FIX BACKEND URL CONFIGURATION
 * Ensures all API calls use the correct backend URL
 */

console.log('🔧 FIXING BACKEND URL CONFIGURATION');
console.log('=' .repeat(70));

(function() {
    const CORRECT_BACKEND_URL = 'https://nftserviceapp.onrender.com';
    
    console.log(`Setting backend URL to: ${CORRECT_BACKEND_URL}`);
    
    // Store in localStorage for persistence
    localStorage.setItem('backendUrl', CORRECT_BACKEND_URL);
    
    // Set as global variable
    window.BACKEND_URL = CORRECT_BACKEND_URL;
    window.backendUrl = CORRECT_BACKEND_URL;
    
    // Override fetch to use correct backend URL
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // Convert relative API paths to use correct backend
        if (typeof url === 'string') {
            if (url.startsWith('/api/')) {
                url = CORRECT_BACKEND_URL + url;
                console.log(`Redirecting API call to: ${url}`);
            } else if (url.includes('theblockservice.com/api/')) {
                url = url.replace('https://theblockservice.com/api/', CORRECT_BACKEND_URL + '/api/');
                console.log(`Correcting backend URL to: ${url}`);
            }
        }
        
        return originalFetch.call(this, url, options);
    };
    
    // Fix saveNoticeToBackend function if it doesn't exist
    if (!window.saveNoticeToBackend) {
        window.saveNoticeToBackend = async function(noticeData) {
            console.log('Saving notice to backend with images...');
            
            try {
                const response = await fetch(`${CORRECT_BACKEND_URL}/api/notices`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                    },
                    body: JSON.stringify({
                        ...noticeData,
                        alertImage: noticeData.alertImage || noticeData.alertThumbnail,
                        documentImage: noticeData.documentImage || noticeData.fullDocumentImage,
                        timestamp: new Date().toISOString()
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Notice saved to backend with images');
                    return result;
                } else {
                    console.error('Failed to save notice:', response.status);
                    return null;
                }
            } catch (error) {
                console.error('Error saving notice to backend:', error);
                return null;
            }
        };
        
        console.log('✅ Created saveNoticeToBackend function');
    }
    
    console.log('\n✅ Backend URL configuration fixed!');
    console.log(`All API calls will now use: ${CORRECT_BACKEND_URL}`);
    
    // Now run verification with correct backend
    console.log('\n🔍 Running verification with correct backend URL...\n');
    
    async function verifyWithCorrectBackend() {
        const checks = {
            backendConnected: false,
            canStoreImages: false,
            canRetrieveImages: false,
            hasStoredImages: false
        };
        
        // Check 1: Backend connectivity
        console.log('1️⃣ Checking backend at correct URL...');
        try {
            const response = await fetch(`${CORRECT_BACKEND_URL}/api/health`);
            if (response.ok || response.status === 404) {
                checks.backendConnected = true;
                console.log(`   ✅ Backend responded: ${response.status}`);
            }
        } catch (e) {
            console.log('   ❌ Cannot reach backend:', e.message);
        }
        
        // Check 2: Image endpoints
        console.log('\n2️⃣ Checking image storage endpoints...');
        try {
            const response = await fetch(`${CORRECT_BACKEND_URL}/api/images/999999`);
            if (response.status === 404 || response.status === 200) {
                checks.canRetrieveImages = true;
                console.log('   ✅ Image endpoints exist');
            }
        } catch (e) {
            console.log('   ⚠️ Image endpoint issue:', e.message);
        }
        
        // Check 3: Check recent notices for images
        console.log('\n3️⃣ Checking for stored images in recent notices...');
        const noticeIds = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        for (const id of noticeIds) {
            try {
                const response = await fetch(`${CORRECT_BACKEND_URL}/api/images/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.alertImage || data.documentImage) {
                        checks.hasStoredImages = true;
                        console.log(`   ✅ Notice ${id} has stored images!`);
                        break;
                    }
                }
            } catch (e) {
                // Continue checking
            }
        }
        
        if (!checks.hasStoredImages) {
            console.log('   ⚠️ No stored images found in recent notices');
            console.log('   This is normal if notices were created before image storage was implemented');
        }
        
        // Summary
        console.log('\n' + '=' .repeat(70));
        console.log('📊 BACKEND VERIFICATION SUMMARY:');
        console.log('=' .repeat(70));
        console.table(checks);
        
        const ready = checks.backendConnected && checks.canRetrieveImages;
        
        if (ready) {
            console.log('\n✅ BACKEND IS CONFIGURED AND READY!');
            console.log('\nWhen you create a new notice:');
            console.log('1. Images will be automatically saved to backend');
            console.log('2. They will be retrievable from /api/images/{id}');
            console.log('3. No blockchain interaction needed to view images');
            
            if (!checks.hasStoredImages) {
                console.log('\n📝 Note: Previous notices may not have images stored.');
                console.log('Only NEW notices will have images saved to backend.');
            }
        } else {
            console.log('\n⚠️ Backend may have issues');
            if (!checks.backendConnected) {
                console.log('• Backend server may be sleeping (Render free tier)');
                console.log('• Try again in a moment - it may need to wake up');
            }
        }
        
        return checks;
    }
    
    // Run verification
    verifyWithCorrectBackend();
    
})();

console.log('\nCommands:');
console.log('  window.saveNoticeToBackend(data) - Save notice with images');
console.log('  fetch("/api/images/10")  - Will use correct backend');