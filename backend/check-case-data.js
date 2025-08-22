/**
 * Check what data the cases actually have
 * Run this in the browser console to see case data
 */

function checkCaseData() {
    console.log('=== CHECKING CASE DATA ===');
    
    // Check localStorage
    const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
    
    // Check each served case
    ['34-2312-235579', '34-4343902'].forEach(caseNum => {
        console.log(`\n📁 Case ${caseNum}:`);
        
        // Find in localStorage
        const localCase = localCases.find(c => 
            c.caseNumber === caseNum || 
            c.case_number === caseNum ||
            String(c.caseNumber).includes(caseNum.replace('34-', '')) ||
            String(c.case_number).includes(caseNum.replace('34-', ''))
        );
        
        if (localCase) {
            console.log('Found in localStorage:');
            console.log('- status:', localCase.status);
            console.log('- transactionHash:', localCase.transactionHash);
            console.log('- transaction_hash:', localCase.transaction_hash);
            console.log('- alertTokenId:', localCase.alertTokenId);
            console.log('- alert_token_id:', localCase.alert_token_id);
            console.log('- served_at:', localCase.served_at);
            console.log('- servedAt:', localCase.servedAt);
            console.log('Full data:', localCase);
        } else {
            console.log('❌ Not found in localStorage');
        }
    });
    
    // Check what the cases module sees
    if (window.cases && window.cases.currentCases) {
        console.log('\n=== CASES MODULE DATA ===');
        window.cases.currentCases.forEach(c => {
            const caseNum = c.caseNumber || c.case_number;
            if (caseNum && (caseNum.includes('235579') || caseNum.includes('4343902'))) {
                console.log(`\n📁 Case ${caseNum} in module:`);
                console.log('- status:', c.status);
                console.log('- transaction_hash:', c.transaction_hash);
                console.log('- transactionHash:', c.transactionHash);
                console.log('- served_at:', c.served_at);
                console.log('- servedAt:', c.servedAt);
                console.log('Full data:', c);
            }
        });
    }
    
    // Try to fetch from backend
    console.log('\n=== FETCHING FROM BACKEND ===');
    ['2312-235579', '4343902'].forEach(async (caseNum) => {
        try {
            const response = await fetch(`https://nftserviceapp.onrender.com/api/cases/${caseNum}/service-data`);
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Backend data for ${caseNum}:`, data.case);
            } else {
                console.log(`❌ Backend fetch failed for ${caseNum}: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Error fetching ${caseNum}:`, error.message);
        }
    });
}

// Function to manually set transaction hash for a case
function fixCaseData(caseNumber, transactionHash) {
    const localCases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');
    
    // Find the case
    const caseIndex = localCases.findIndex(c => 
        c.caseNumber === caseNumber || 
        c.case_number === caseNumber ||
        String(c.caseNumber).includes(caseNumber.replace('34-', '')) ||
        String(c.case_number).includes(caseNumber.replace('34-', ''))
    );
    
    if (caseIndex >= 0) {
        // Update the case
        localCases[caseIndex].status = 'served';
        localCases[caseIndex].transactionHash = transactionHash;
        localCases[caseIndex].transaction_hash = transactionHash;
        localCases[caseIndex].served_at = localCases[caseIndex].served_at || new Date().toISOString();
        localCases[caseIndex].servedAt = localCases[caseIndex].servedAt || new Date().toISOString();
        
        // Save back
        localStorage.setItem('legalnotice_cases', JSON.stringify(localCases));
        console.log(`✅ Fixed case ${caseNumber} with tx hash ${transactionHash}`);
        
        // Reload cases if available
        if (window.cases && window.cases.loadCases) {
            window.cases.loadCases();
        }
    } else {
        console.log(`❌ Case ${caseNumber} not found`);
    }
}

// Run the check
checkCaseData();

console.log('\n💡 To fix a case, run:');
console.log('   fixCaseData("34-2312-235579", "YOUR_TX_HASH")');
console.log('   fixCaseData("34-4343902", "033b50d5d7510d247274d9dd535b50a61706ec987415ee8f4847c14e75f867f5")');