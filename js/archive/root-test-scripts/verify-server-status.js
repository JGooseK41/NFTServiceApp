/**
 * VERIFY SERVER STATUS
 * Ensures the system properly recognizes you as the process server
 * WITHOUT bypassing security - just fixing the data
 */

console.log('🔍 VERIFYING PROCESS SERVER STATUS');
console.log('=' .repeat(70));

window.VerifyServerStatus = {
    
    // Your confirmed server address
    SERVER_ADDRESS: 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
    
    async checkBackendRecognition() {
        console.log('\n📊 Checking backend recognition...\n');
        
        const wallet = window.tronWeb?.defaultAddress?.base58;
        console.log('Your current wallet:', wallet);
        console.log('Expected server address:', this.SERVER_ADDRESS);
        
        if (wallet !== this.SERVER_ADDRESS) {
            console.log('⚠️ WARNING: Your connected wallet doesn\'t match the server address');
            console.log('Please connect wallet:', this.SERVER_ADDRESS);
            return false;
        }
        
        // Test multiple notices to verify server status
        const testNotices = [18, 19, 20, 21];
        const results = [];
        
        for (const noticeId of testNotices) {
            try {
                const response = await fetch(`https://nftserviceapp.onrender.com/api/notices/${noticeId}/images`, {
                    headers: {
                        'X-Wallet-Address': wallet,
                        'X-Server-Address': wallet
                    }
                });
                
                const data = await response.json();
                
                if (response.ok && data.accessType === 'process_server') {
                    results.push({
                        noticeId,
                        status: '✅ Server Access',
                        serverAddress: data.serverAddress,
                        recipientAddress: data.recipientAddress
                    });
                } else {
                    results.push({
                        noticeId,
                        status: '❌ No Access',
                        reason: data.message || 'Not found'
                    });
                }
            } catch (e) {
                results.push({
                    noticeId,
                    status: '⚠️ Error',
                    reason: e.message
                });
            }
        }
        
        console.table(results);
        
        const accessCount = results.filter(r => r.status.includes('✅')).length;
        console.log(`\n📈 You have server access to ${accessCount}/${testNotices.length} notices tested`);
        
        return accessCount > 0;
    },
    
    async verifyDatabaseRecords() {
        console.log('\n🗄️ Verifying database records...\n');
        
        // Check what the backend says about your served notices
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/notices/my-served', {
                headers: {
                    'X-Wallet-Address': this.SERVER_ADDRESS,
                    'X-Server-Address': this.SERVER_ADDRESS
                }
            });
            
            const data = await response.json();
            
            if (data.totalNotices > 0) {
                console.log(`✅ Backend confirms you served ${data.totalNotices} notices`);
                
                if (data.notices && data.notices.length > 0) {
                    console.log('\nYour served notices:');
                    data.notices.slice(0, 5).forEach(n => {
                        console.log(`  - Alert #${n.alert_id}, Doc #${n.document_id} → ${n.recipient_address?.substring(0, 10)}...`);
                    });
                }
                return true;
            } else {
                console.log('⚠️ Backend shows 0 served notices');
                console.log('This might be a query issue, not a data issue');
                return false;
            }
        } catch (e) {
            console.log('❌ Error checking served notices:', e.message);
            return false;
        }
    },
    
    async diagnoseAccessIssue() {
        console.log('\n🔬 DIAGNOSING ACCESS ISSUE...\n');
        
        // Step 1: Check wallet
        const wallet = window.tronWeb?.defaultAddress?.base58;
        if (!wallet) {
            console.log('❌ No wallet connected');
            return;
        }
        
        console.log('Step 1: Wallet Check');
        console.log(`  Your wallet: ${wallet}`);
        console.log(`  Should be: ${this.SERVER_ADDRESS}`);
        console.log(`  Match: ${wallet === this.SERVER_ADDRESS ? '✅ YES' : '❌ NO'}`);
        
        // Step 2: Check a specific notice
        console.log('\nStep 2: Checking Notice #19 specifically');
        
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/notices/19/images', {
                headers: {
                    'X-Wallet-Address': wallet,
                    'X-Server-Address': wallet
                }
            });
            
            const data = await response.json();
            console.log('  Backend response:', response.status);
            console.log('  Access granted:', data.accessGranted || false);
            console.log('  Access type:', data.accessType || 'none');
            console.log('  Server in DB:', data.serverAddress || 'not set');
            console.log('  Recipient in DB:', data.recipientAddress || 'not set');
            
            if (data.serverAddress === this.SERVER_ADDRESS) {
                console.log('\n✅ Database has correct server address');
                console.log('The backend recognizes you as the server');
                
                if (!data.accessGranted) {
                    console.log('❌ But access was still denied - checking why...');
                    console.log('Your wallet:', wallet);
                    console.log('DB server:', data.serverAddress);
                    console.log('Case sensitivity issue?', wallet.toLowerCase() === data.serverAddress.toLowerCase());
                }
            } else {
                console.log('\n❌ Database has wrong server address');
                console.log(`Database shows: ${data.serverAddress}`);
                console.log(`Should be: ${this.SERVER_ADDRESS}`);
            }
            
        } catch (e) {
            console.log('  Error:', e.message);
        }
        
        // Step 3: Check frontend recognition
        console.log('\nStep 3: Frontend Recognition');
        
        if (window.DocumentAccessControl) {
            console.log('  DocumentAccessControl is loaded');
            
            // Check what publicInfo is available
            const dac = new DocumentAccessControl();
            console.log('  Backend URL:', dac.backend);
            console.log('  Current wallet stored:', dac.walletAddress);
            
            // The issue might be that publicInfo is not being fetched
            console.log('\n💡 SOLUTION: The frontend needs to fetch metadata from IPFS');
            console.log('The "undefined" values are because publicInfo isn\'t populated');
        }
    },
    
    async fixMetadataDisplay() {
        console.log('\n🔧 Fixing metadata display issue...\n');
        
        // Fetch the IPFS metadata for Notice #19
        try {
            const response = await fetch('https://gateway.pinata.cloud/ipfs/QmNXdo5dyHsWVPsvNsQFgkHtKCMPbENjGayBADvY9kSVDs');
            const metadata = await response.json();
            
            console.log('✅ Fetched IPFS metadata:');
            console.log('  Case Number:', metadata.attributes?.find(a => a.trait_type === 'Case Number')?.value);
            console.log('  Type:', metadata.attributes?.find(a => a.trait_type === 'Type')?.value);
            console.log('  Issuing Agency:', metadata.attributes?.find(a => a.trait_type === 'Issuing Agency')?.value);
            
            // Store it globally for the frontend to use
            window.notice19Metadata = {
                caseNumber: metadata.attributes?.find(a => a.trait_type === 'Case Number')?.value,
                noticeType: metadata.attributes?.find(a => a.trait_type === 'Type')?.value,
                issuingAgency: metadata.attributes?.find(a => a.trait_type === 'Issuing Agency')?.value
            };
            
            console.log('\n✅ Metadata stored. The frontend should now display:');
            console.log('  Case number:', window.notice19Metadata.caseNumber);
            console.log('  Notice type:', window.notice19Metadata.noticeType);
            console.log('  Issuing agency:', window.notice19Metadata.issuingAgency);
            
            return window.notice19Metadata;
        } catch (e) {
            console.log('❌ Error fetching metadata:', e.message);
        }
    },
    
    async runFullDiagnostic() {
        console.log('\n🏥 RUNNING FULL DIAGNOSTIC\n');
        console.log('This will check everything to find why access is being denied\n');
        
        // 1. Backend recognition
        const backendOk = await this.checkBackendRecognition();
        
        // 2. Database records
        const dbOk = await this.verifyDatabaseRecords();
        
        // 3. Specific diagnosis
        await this.diagnoseAccessIssue();
        
        // 4. Fix metadata
        await this.fixMetadataDisplay();
        
        console.log('\n📋 SUMMARY:');
        console.log('  Backend recognizes you as server:', backendOk ? '✅' : '❌');
        console.log('  Database has your records:', dbOk ? '✅' : '❌');
        console.log('  Metadata is available:', window.notice19Metadata ? '✅' : '❌');
        
        if (backendOk) {
            console.log('\n✅ The backend properly recognizes you as the process server');
            console.log('The "Restricted Access" modal is a frontend display issue');
            console.log('\nThe issue is that DocumentAccessControl is not checking the backend properly');
        }
    }
};

// Auto-run diagnostic
console.log('\n🚀 Starting automatic diagnostic...');
VerifyServerStatus.runFullDiagnostic();

console.log('\n📚 Available commands:');
console.log('  VerifyServerStatus.runFullDiagnostic() - Complete check');
console.log('  VerifyServerStatus.checkBackendRecognition() - Test backend');
console.log('  VerifyServerStatus.diagnoseAccessIssue() - Detailed diagnosis');
console.log('  VerifyServerStatus.fixMetadataDisplay() - Fix undefined values');