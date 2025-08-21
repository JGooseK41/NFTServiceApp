// Run this in the browser console to fix case 4343902

// Get current cases
const cases = JSON.parse(localStorage.getItem('legalnotice_cases') || '[]');

// Find case 4343902
const caseIndex = cases.findIndex(c => 
    c.caseNumber === '4343902' || 
    c.caseNumber === '34-4343902' ||
    c.case_number === '4343902'
);

if (caseIndex >= 0) {
    // Fix the case with the correct data
    cases[caseIndex].status = 'served';
    cases[caseIndex].pageCount = 46;
    cases[caseIndex].page_count = 46;
    cases[caseIndex].servedAt = '2024-12-20T20:00:00.000Z';
    cases[caseIndex].transactionHash = '8841e1e6c8f8e1e6c8f8e1e6c8f8e1e6c8f8e1e6c8f8e1e6c8f8e1e6c8f8e1e6'; // Replace with actual tx hash
    cases[caseIndex].alertTokenId = 31;
    cases[caseIndex].documentTokenId = 32;
    cases[caseIndex].recipients = [
        'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE',
        'TAr8S97Xw3xhrGkZSghXQ85SFuP5XDU4cF', 
        'TBrjqKepMQKeZWjebMip2bH5872fiD3F6Q',
        'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH'
    ];
    cases[caseIndex].agency = 'The Block Audit';
    cases[caseIndex].noticeType = 'Legal Notice';
    cases[caseIndex].ipfsDocument = 'QmQg8cAaMxBfj1dFaKLWnEdPix6qButoBWwhYfPygxy7y2';
    
    // Save it
    localStorage.setItem('legalnotice_cases', JSON.stringify(cases));
    
    console.log('✅ Case 4343902 fixed!');
    console.log('Updated case:', cases[caseIndex]);
} else {
    console.log('❌ Case 4343902 not found');
}

// Now refresh the page or click Refresh in Cases tab