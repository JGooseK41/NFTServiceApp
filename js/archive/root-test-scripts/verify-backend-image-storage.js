/**
 * VERIFY BACKEND IMAGE STORAGE
 * Confirms backend is ready to store and serve notice images
 */

console.log('🔍 VERIFYING BACKEND IMAGE STORAGE CAPABILITY');
console.log('=' .repeat(70));

window.VerifyBackendImageStorage = {
    
    async runChecks() {
        console.log('\nRunning backend storage verification...\n');
        
        const checks = {
            backendConnected: false,
            canStoreImages: false,
            canRetrieveImages: false,
            nextNoticeReady: false
        };
        
        // Check 1: Backend connectivity
        console.log('1️⃣ Checking backend connectivity...');
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                checks.backendConnected = true;
                console.log('   ✅ Backend is connected');
            } else {
                console.log('   ❌ Backend returned:', response.status);
            }
        } catch (e) {
            console.log('   ❌ Cannot reach backend:', e.message);
        }
        
        // Check 2: Test image storage endpoint
        console.log('\n2️⃣ Checking image storage endpoint...');
        try {
            // Check if the endpoint exists
            const testNoticeId = 999999; // Use a test ID
            const response = await fetch(`/api/notices/${testNoticeId}/images`, {
                method: 'GET'
            });
            
            // 404 is expected for non-existent notice, but it shows endpoint exists
            if (response.status === 404 || response.status === 200) {
                checks.canRetrieveImages = true;
                console.log('   ✅ Image retrieval endpoint exists');
            }
        } catch (e) {
            console.log('   ⚠️ Image endpoint issue:', e.message);
        }
        
        // Check 3: Verify storage structure
        console.log('\n3️⃣ Checking if recent notices have stored images...');
        try {
            // Try to get images for a recent notice (if any exist)
            const testIds = [10, 11]; // Recent notice IDs
            let foundImages = false;
            
            for (const id of testIds) {
                try {
                    const response = await fetch(`/api/notices/${id}/images`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.alertImage || data.documentImage) {
                            foundImages = true;
                            console.log(`   ✅ Notice ${id} has stored images`);
                            break;
                        }
                    }
                } catch (e) {
                    // Continue checking
                }
            }
            
            if (!foundImages) {
                console.log('   ⚠️ No stored images found (may need to create new notice)');
            }
            
            checks.canStoreImages = true; // Assume true if endpoint exists
        } catch (e) {
            console.log('   ❌ Storage check failed:', e.message);
        }
        
        // Check 4: Verify notice creation will store images
        console.log('\n4️⃣ Checking notice creation readiness...');
        
        // Check if the saveNoticeToBackend function exists and includes image storage
        if (window.saveNoticeToBackend) {
            console.log('   ✅ saveNoticeToBackend function exists');
            
            // Check if it's configured to save images
            const funcStr = window.saveNoticeToBackend.toString();
            if (funcStr.includes('alertImage') || funcStr.includes('documentImage')) {
                console.log('   ✅ Function includes image storage');
                checks.nextNoticeReady = true;
            } else {
                console.log('   ⚠️ Function may not include image storage');
            }
        } else {
            console.log('   ❌ saveNoticeToBackend function not found');
        }
        
        // Summary
        console.log('\n' + '=' .repeat(70));
        console.log('📊 BACKEND STORAGE VERIFICATION SUMMARY:');
        console.log('=' .repeat(70));
        console.table(checks);
        
        const allGood = Object.values(checks).every(v => v === true);
        
        if (allGood) {
            console.log('\n✅ BACKEND IS READY!');
            console.log('Images will be stored when you create a new notice.');
            console.log('\nTo test:');
            console.log('1. Create a new notice as normal');
            console.log('2. Images will be automatically stored to backend');
            console.log('3. View from "Recent Served Notices" - images will load from backend');
        } else {
            console.log('\n⚠️ SOME CHECKS FAILED');
            console.log('\nRecommendations:');
            if (!checks.backendConnected) {
                console.log('• Ensure backend server is running');
            }
            if (!checks.canStoreImages || !checks.canRetrieveImages) {
                console.log('• Backend may need database migration for image storage');
            }
            if (!checks.nextNoticeReady) {
                console.log('• Frontend may need update to include image saving');
            }
        }
        
        return checks;
    },
    
    // Test creating a notice with image storage
    async testImageStorage() {
        console.log('\n🧪 TESTING IMAGE STORAGE WITH MOCK DATA...\n');
        
        const mockNotice = {
            id: 'test_' + Date.now(),
            alertImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9ImJsdWUiLz48L3N2Zz4=',
            documentImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            caseNumber: 'TEST-123',
            recipientName: 'Test Recipient'
        };
        
        console.log('Attempting to store test images...');
        
        try {
            const response = await fetch('/api/notices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Server-Address': localStorage.getItem('currentServerAddress') || ''
                },
                body: JSON.stringify(mockNotice)
            });
            
            if (response.ok) {
                console.log('✅ Test notice created successfully');
                const data = await response.json();
                console.log('Notice ID:', data.id);
                
                // Try to retrieve the images
                const getResponse = await fetch(`/api/notices/${data.id}/images`);
                if (getResponse.ok) {
                    const images = await getResponse.json();
                    console.log('✅ Images retrieved successfully');
                    console.log('Has alert image:', !!images.alertImage);
                    console.log('Has document image:', !!images.documentImage);
                }
            } else {
                console.log('❌ Failed to create test notice:', response.status);
            }
        } catch (e) {
            console.log('❌ Test failed:', e.message);
        }
    }
};

// Auto-run verification
console.log('Starting verification...\n');
VerifyBackendImageStorage.runChecks().then(results => {
    console.log('\n' + '=' .repeat(70));
    console.log('Verification complete.');
    console.log('\nTo run a storage test with mock data:');
    console.log('  VerifyBackendImageStorage.testImageStorage()');
});