/**
 * Fix all served cases by pushing complete data to backend
 * This ensures all IPFS hashes, token IDs, and service data are stored
 */

async function fixAllCases() {
    console.log('Starting to fix all cases...');
    
    // Get all cases from localStorage
    const cases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
    console.log(`Found ${cases.length} cases in localStorage`);
    
    const backendUrl = 'https://nftserviceapp.onrender.com';
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const caseData of cases) {
        const caseNumber = caseData.caseNumber || caseData.case_number;
        
        // Only fix served cases
        if (caseData.status !== 'served' && !caseData.transactionHash) {
            console.log(`Skipping ${caseNumber} - not served`);
            continue;
        }
        
        console.log(`\nFixing case ${caseNumber}...`);
        
        try {
            // Prepare complete data for backend
            const updateData = {
                transactionHash: caseData.transactionHash,
                alertTokenId: caseData.alertTokenId,
                documentTokenId: caseData.documentTokenId,
                alertImage: caseData.alertImage || caseData.alert_preview || caseData.alertPreview,
                ipfsHash: caseData.ipfsHash || caseData.ipfsDocument || caseData.metadata?.ipfsHash,
                encryptionKey: caseData.encryptionKey || caseData.encryption_key || '',
                recipients: caseData.recipients || [],
                agency: caseData.agency || caseData.issuingAgency || 'The Block Audit',
                noticeType: caseData.noticeType || 'Legal Notice',
                pageCount: caseData.pageCount || caseData.page_count || 1,
                servedAt: caseData.servedAt || caseData.served_at || new Date().toISOString(),
                serverAddress: caseData.serverAddress || window.wallet?.address || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
                metadata: {
                    ...caseData.metadata,
                    caseDetails: caseData.caseDetails,
                    noticeText: caseData.noticeText
                }
            };
            
            console.log('Sending to backend:', {
                caseNumber,
                hasIPFS: !!updateData.ipfsHash,
                hasTransaction: !!updateData.transactionHash,
                hasTokens: !!(updateData.alertTokenId && updateData.documentTokenId)
            });
            
            // Send to backend
            const response = await fetch(`${backendUrl}/api/cases/${caseNumber}/service-complete`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Server-Address': updateData.serverAddress
                },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Fixed ${caseNumber}:`, result);
                fixedCount++;
            } else {
                const error = await response.text();
                console.error(`❌ Failed to fix ${caseNumber}:`, error);
                
                // If table doesn't exist, try to create it
                if (error.includes('does not exist')) {
                    console.log('Attempting to create table...');
                    await createServiceTable();
                    // Retry once
                    const retry = await fetch(`${backendUrl}/api/cases/${caseNumber}/service-complete`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Server-Address': updateData.serverAddress
                        },
                        body: JSON.stringify(updateData)
                    });
                    
                    if (retry.ok) {
                        console.log(`✅ Fixed ${caseNumber} on retry`);
                        fixedCount++;
                    } else {
                        errorCount++;
                    }
                } else {
                    errorCount++;
                }
            }
            
        } catch (error) {
            console.error(`Error fixing ${caseNumber}:`, error);
            errorCount++;
        }
    }
    
    console.log('\n=================================');
    console.log(`✅ Fixed ${fixedCount} cases`);
    console.log(`❌ Failed to fix ${errorCount} cases`);
    console.log('=================================');
    
    return { fixedCount, errorCount };
}

// Helper to create the service table
async function createServiceTable() {
    const backendUrl = 'https://nftserviceapp.onrender.com';
    
    try {
        // Call a simple endpoint to trigger table creation
        await fetch(`${backendUrl}/api/cases/trigger-table-creation`, {
            method: 'GET'
        });
    } catch (error) {
        console.log('Table creation trigger failed:', error);
    }
}

// Run the fix
fixAllCases().then(result => {
    alert(`Finished fixing cases!\n\nFixed: ${result.fixedCount}\nFailed: ${result.errorCount}\n\nRefresh the Cases tab to see updates.`);
});