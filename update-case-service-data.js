/**
 * Script to manually update case with service data
 * Run this to fix cases that were served but UI isn't reflecting it
 */

async function updateCaseServiceData() {
    const caseNumber = prompt('Enter case number:') || '4343902'; // Your case number
    const transactionHash = '033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5';
    
    // Get transaction info from blockchain to extract token IDs
    if (window.tronWeb) {
        try {
            console.log('Fetching transaction info from blockchain...');
            const txInfo = await window.tronWeb.trx.getTransactionInfo(transactionHash);
            console.log('Transaction info:', txInfo);
            
            // Extract token IDs from logs
            let alertTokenId = null;
            let documentTokenId = null;
            
            if (txInfo && txInfo.log) {
                // Look for Transfer events
                for (const log of txInfo.log) {
                    if (log.topics && log.topics[0] === 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                        // This is a Transfer event
                        const tokenId = parseInt(log.topics[3], 16);
                        console.log('Found token ID:', tokenId);
                        
                        if (!alertTokenId) {
                            alertTokenId = tokenId;
                        } else if (!documentTokenId) {
                            documentTokenId = tokenId;
                        }
                    }
                }
            }
            
            // Get case data from localStorage
            const cases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
            const caseData = cases.find(c => 
                c.caseNumber === caseNumber || 
                c.case_number === caseNumber ||
                c.caseNumber?.includes(caseNumber)
            );
            
            console.log('Found case in localStorage:', caseData);
            
            // Prepare update data
            const updateData = {
                transactionHash: transactionHash,
                alertTokenId: alertTokenId || prompt('Enter Alert NFT Token ID:'),
                documentTokenId: documentTokenId || prompt('Enter Document NFT Token ID:'),
                alertImage: caseData?.alertImage || caseData?.alert_preview,
                ipfsHash: caseData?.ipfsHash || caseData?.ipfsDocument,
                encryptionKey: caseData?.encryptionKey || caseData?.encryption_key || '',
                recipients: caseData?.recipients || [],
                agency: caseData?.agency || 'The Block Audit',
                noticeType: caseData?.noticeType || 'Legal Notice',
                pageCount: caseData?.pageCount || caseData?.page_count || 46,
                servedAt: caseData?.servedAt || new Date().toISOString(),
                serverAddress: window.wallet?.address || window.serverAddress || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
            };
            
            console.log('Sending update to backend:', updateData);
            
            // Send to backend
            const backendUrl = 'https://nftserviceapp.onrender.com';
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
                console.log('✅ Backend updated successfully:', result);
                
                // Also update localStorage
                if (caseData) {
                    Object.assign(caseData, {
                        status: 'served',
                        transactionHash: transactionHash,
                        alertTokenId: updateData.alertTokenId,
                        documentTokenId: updateData.documentTokenId,
                        servedAt: updateData.servedAt
                    });
                    localStorage.setItem('legalnotice_cases', JSON.stringify(cases));
                    console.log('✅ Local storage updated');
                }
                
                alert('Case updated successfully! Refresh the Cases tab to see changes.');
            } else {
                console.error('Backend update failed:', await response.text());
                alert('Failed to update backend. Check console for details.');
            }
            
        } catch (error) {
            console.error('Error updating case:', error);
            alert('Error: ' + error.message);
        }
    } else {
        alert('TronWeb not available. Please connect your wallet first.');
    }
}

// Run the update
updateCaseServiceData();