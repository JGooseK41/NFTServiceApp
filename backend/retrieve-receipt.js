/**
 * Retrieve Delivery Receipt Function
 * Run this in the browser console on theblockservice.com to retrieve any delivery receipt
 */

// Function to retrieve and display a delivery receipt
async function retrieveDeliveryReceipt(caseNumber) {
    if (!caseNumber) {
        caseNumber = prompt('Enter the case number to retrieve receipt for:');
        if (!caseNumber) return;
    }
    
    console.log(`Retrieving receipt for case ${caseNumber}...`);
    
    try {
        // Try backend first
        const backendUrl = 'https://nftserviceapp.onrender.com';
        const response = await fetch(`${backendUrl}/api/cases/${caseNumber}/service-data`);
        
        let caseData;
        if (response.ok) {
            const data = await response.json();
            caseData = data.case;
            console.log('✅ Found case in backend:', caseData);
        } else {
            // Try localStorage fallback
            const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
            caseData = localCases.find(c => 
                c.caseNumber === caseNumber || 
                c.case_number === caseNumber ||
                String(c.caseNumber).includes(caseNumber) ||
                String(c.case_number).includes(caseNumber)
            );
            
            if (caseData) {
                console.log('✅ Found case in localStorage:', caseData);
            }
        }
        
        if (!caseData) {
            alert(`❌ Case ${caseNumber} not found`);
            return;
        }
        
        // Check if we have receipt module
        if (window.receipts && window.receipts.viewDeliveryReceipt) {
            // Use the receipts module
            await window.receipts.viewDeliveryReceipt(caseData.caseNumber || caseData.case_number || caseNumber);
        } else if (window.proofOfService && window.proofOfService.generateReceipt) {
            // Use proof of service module
            await window.proofOfService.generateReceipt(caseData);
        } else {
            // Display basic receipt info
            displayBasicReceipt(caseData);
        }
        
    } catch (error) {
        console.error('Error retrieving receipt:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

// Display basic receipt information if modules not available
function displayBasicReceipt(caseData) {
    const caseNumber = caseData.caseNumber || caseData.case_number;
    const txHash = caseData.transactionHash || caseData.transaction_hash;
    const alertTokenId = caseData.alertTokenId || caseData.alert_token_id;
    const documentTokenId = caseData.documentTokenId || caseData.document_token_id;
    const servedAt = caseData.servedAt || caseData.served_at;
    const recipients = caseData.recipients || [];
    
    // Create modal
    const modalHtml = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                    background: rgba(0,0,0,0.8); z-index: 9999; 
                    display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; max-width: 600px; 
                        max-height: 80vh; overflow-y: auto; border-radius: 10px;">
                <h2 style="margin-top: 0;">📋 Delivery Receipt</h2>
                
                <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Case ${caseNumber}</h3>
                    
                    <p><strong>Status:</strong> ✅ Served</p>
                    <p><strong>Date Served:</strong> ${servedAt ? new Date(servedAt).toLocaleString() : 'N/A'}</p>
                    
                    <hr>
                    
                    <p><strong>Transaction Hash:</strong><br>
                    <code style="font-size: 11px; word-break: break-all;">${txHash || 'N/A'}</code></p>
                    
                    <p><strong>Alert NFT Token ID:</strong> #${alertTokenId || 'N/A'}</p>
                    <p><strong>Document NFT Token ID:</strong> #${documentTokenId || 'N/A'}</p>
                    
                    <p><strong>Recipients:</strong> ${recipients.length} address(es)</p>
                    <div style="font-size: 12px; background: white; padding: 10px; border-radius: 3px;">
                        ${recipients.map(r => `<div>${r}</div>`).join('')}
                    </div>
                    
                    ${caseData.ipfsHash || caseData.ipfsDocument ? `
                        <hr>
                        <p><strong>IPFS Document Hash:</strong><br>
                        <code style="font-size: 11px;">${caseData.ipfsHash || caseData.ipfsDocument}</code></p>
                    ` : ''}
                    
                    ${caseData.alertImage || caseData.alert_preview ? `
                        <hr>
                        <p><strong>Alert NFT Preview:</strong></p>
                        <img src="${caseData.alertImage || caseData.alert_preview}" 
                             style="max-width: 100%; border: 1px solid #ddd; border-radius: 5px;">
                    ` : ''}
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: space-between;">
                    ${txHash ? `
                        <button onclick="window.open('https://tronscan.org/#/transaction/${txHash}', '_blank')"
                                style="padding: 10px 20px; background: #17a2b8; color: white; 
                                       border: none; border-radius: 5px; cursor: pointer;">
                            View on TronScan
                        </button>
                    ` : ''}
                    
                    <button onclick="this.closest('div[style*=fixed]').remove()"
                            style="padding: 10px 20px; background: #6c757d; color: white; 
                                   border: none; border-radius: 5px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Quick function to list all served cases
async function listServedCases() {
    console.log('Fetching all served cases...');
    
    const servedCases = [];
    
    // Try backend
    try {
        const backendUrl = 'https://nftserviceapp.onrender.com';
        const response = await fetch(`${backendUrl}/api/cases?status=served`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.cases) {
                servedCases.push(...data.cases);
                console.log(`✅ Found ${data.cases.length} cases in backend`);
            }
        }
    } catch (error) {
        console.error('Backend fetch error:', error);
    }
    
    // Also check localStorage
    const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]')
        .filter(c => c.status === 'served' && c.transactionHash);
    
    // Merge and dedupe
    localCases.forEach(localCase => {
        const caseNum = localCase.caseNumber || localCase.case_number;
        if (!servedCases.find(c => c.case_number === caseNum)) {
            servedCases.push({
                case_number: caseNum,
                transaction_hash: localCase.transactionHash,
                served_at: localCase.servedAt || localCase.served_at,
                alert_token_id: localCase.alertTokenId,
                document_token_id: localCase.documentTokenId
            });
        }
    });
    
    if (servedCases.length === 0) {
        console.log('❌ No served cases found');
        return;
    }
    
    console.log('\n📋 SERVED CASES:');
    console.log('================');
    servedCases.forEach((c, i) => {
        console.log(`${i + 1}. Case ${c.case_number}`);
        console.log(`   Served: ${c.served_at ? new Date(c.served_at).toLocaleDateString() : 'N/A'}`);
        console.log(`   Tx: ${(c.transaction_hash || c.transactionHash || '').substring(0, 20)}...`);
        console.log(`   NFTs: Alert #${c.alert_token_id || c.alertTokenId || 'N/A'}, Doc #${c.document_token_id || c.documentTokenId || 'N/A'}`);
        console.log('');
    });
    
    console.log(`\n💡 To retrieve a receipt, run:`);
    console.log(`   retrieveDeliveryReceipt('CASE_NUMBER')`);
    
    return servedCases;
}

// Auto-run instructions
console.log('==================================');
console.log('🧾 DELIVERY RECEIPT RETRIEVAL');
console.log('==================================');
console.log('');
console.log('Available commands:');
console.log('');
console.log('1. List all served cases:');
console.log('   listServedCases()');
console.log('');
console.log('2. Retrieve specific receipt:');
console.log('   retrieveDeliveryReceipt("CASE_NUMBER")');
console.log('');
console.log('3. Or just run to be prompted:');
console.log('   retrieveDeliveryReceipt()');
console.log('');
console.log('==================================');

// Export functions to window
window.retrieveDeliveryReceipt = retrieveDeliveryReceipt;
window.listServedCases = listServedCases;