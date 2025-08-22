/**
 * Debug Case Display Issues
 * Run this in the browser console to see what data sources are being used
 */

async function debugCaseDisplay() {
    console.log('\n=== DEBUGGING CASE DISPLAY ===\n');
    
    const caseNumber = '34-2312-235579';
    
    // 1. Check Local Storage
    console.log('1. LOCAL STORAGE DATA:');
    console.log('----------------------');
    
    // Check window.storage
    const storageCases = window.storage?.get('cases') || [];
    const storageCase = storageCases.find(c => c.caseNumber === caseNumber || c.case_number === caseNumber);
    console.log('window.storage cases:', storageCase || 'NOT FOUND');
    
    // Check localStorage legalnotice_cases
    const legalNoticeCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
    const legalNoticeCase = legalNoticeCases.find(c => c.caseNumber === caseNumber || c.case_number === caseNumber);
    console.log('localStorage legalnotice_cases:', legalNoticeCase || 'NOT FOUND');
    
    // Check localStorage individual case
    const individualCase = localStorage.getItem(`case_${caseNumber}`);
    console.log('localStorage individual case:', individualCase ? JSON.parse(individualCase) : 'NOT FOUND');
    
    // 2. Check Backend API
    console.log('\n2. BACKEND API DATA:');
    console.log('--------------------');
    
    const backendUrl = window.getConfig?.('backend.baseUrl') || 'https://nftserviceapp.onrender.com';
    
    try {
        // Try to get from list endpoint
        const listResponse = await fetch(`${backendUrl}/api/cases/list?serverAddress=${window.wallet?.address || 'unknown'}`);
        const listData = await listResponse.json();
        console.log('List endpoint response:', listData);
        
        if (listData.success && listData.cases) {
            const backendCase = listData.cases.find(c => c.case_number === caseNumber);
            console.log('Case from list:', backendCase || 'NOT IN LIST');
        }
        
        // Try to get specific case
        const caseResponse = await fetch(`${backendUrl}/api/cases/${caseNumber}`);
        const caseData = await caseResponse.json();
        console.log('Specific case endpoint:', caseData);
        
        // Try to get service data
        const serviceResponse = await fetch(`${backendUrl}/api/cases/${caseNumber}/service-data`);
        const serviceData = await serviceResponse.json();
        console.log('Service data endpoint:', serviceData);
        
    } catch (error) {
        console.error('Backend API error:', error);
    }
    
    // 3. Check what the UI is actually displaying
    console.log('\n3. CURRENT UI DISPLAY:');
    console.log('----------------------');
    
    // Find the case in the table
    const caseRows = document.querySelectorAll('#casesTableBody tr');
    let foundRow = null;
    
    caseRows.forEach(row => {
        const caseLink = row.querySelector('a');
        if (caseLink && caseLink.textContent.includes(caseNumber)) {
            foundRow = row;
        }
    });
    
    if (foundRow) {
        console.log('Found in UI table:');
        console.log('- Case Number:', foundRow.querySelector('td:nth-child(1)')?.textContent);
        console.log('- Date:', foundRow.querySelector('td:nth-child(2)')?.textContent);
        console.log('- Pages:', foundRow.querySelector('td:nth-child(3)')?.textContent);
        console.log('- Status:', foundRow.querySelector('td:nth-child(4) .badge')?.textContent);
        console.log('- Transaction Hash:', foundRow.querySelector('td:nth-child(4) code')?.textContent);
        console.log('- NFT IDs:', foundRow.querySelector('td:nth-child(4) small:last-child')?.textContent);
    } else {
        console.log('NOT FOUND in UI table');
    }
    
    // 4. Check merged data
    console.log('\n4. MERGED DATA (what cases module has):');
    console.log('----------------------------------------');
    
    if (window.cases?.currentCases) {
        const mergedCase = window.cases.currentCases.find(c => 
            c.caseNumber === caseNumber || c.case_number === caseNumber
        );
        console.log('Merged case data:', mergedCase || 'NOT FOUND');
        
        if (mergedCase) {
            console.log('\nKey fields:');
            console.log('- status:', mergedCase.status);
            console.log('- transactionHash:', mergedCase.transactionHash);
            console.log('- transaction_hash:', mergedCase.transaction_hash);
            console.log('- alertTokenId:', mergedCase.alertTokenId);
            console.log('- alert_token_id:', mergedCase.alert_token_id);
            console.log('- documentTokenId:', mergedCase.documentTokenId);
            console.log('- document_token_id:', mergedCase.document_token_id);
            console.log('- servedAt:', mergedCase.servedAt);
            console.log('- served_at:', mergedCase.served_at);
            console.log('- ipfsHash:', mergedCase.ipfsHash);
            console.log('- ipfs_hash:', mergedCase.ipfs_hash);
        }
    } else {
        console.log('cases.currentCases not available');
    }
    
    console.log('\n=== END DEBUG ===\n');
}

// Run it
debugCaseDisplay();