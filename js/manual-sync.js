/**
 * Manual sync script for populating backend with known cases
 */

async function manualSyncCases() {
    const backend = 'https://nftserviceapp.onrender.com';
    const serverAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
    
    console.log('Starting manual sync...');
    
    // Your two known cases
    const cases = [
        {
            noticeId: 'notice_123456_alert',
            alertId: '1',
            documentId: '2',
            serverAddress: serverAddress,
            recipientAddress: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH',
            caseNumber: '123456',
            noticeType: 'Legal Notice',
            issuingAgency: 'Court Agency',
            hasDocument: true
        },
        {
            noticeId: 'notice_34987654_alert',
            alertId: '3',
            documentId: '4',
            serverAddress: serverAddress,
            recipientAddress: 'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE',
            caseNumber: '34-987654',
            noticeType: 'Notice of Seizure',
            issuingAgency: 'The Block Audit',
            hasDocument: true
        }
    ];
    
    let successCount = 0;
    let failCount = 0;
    
    for (const caseData of cases) {
        try {
            const response = await fetch(`${backend}/api/notices/served`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(caseData)
            });
            
            if (response.ok) {
                console.log(`✅ Synced case ${caseData.caseNumber}`);
                successCount++;
            } else {
                const error = await response.text();
                console.log(`❌ Failed to sync case ${caseData.caseNumber}: ${error}`);
                failCount++;
            }
        } catch (error) {
            console.error(`❌ Error syncing case ${caseData.caseNumber}:`, error);
            failCount++;
        }
    }
    
    console.log(`\nSync complete: ${successCount} success, ${failCount} failed`);
    
    // Now try to fetch the cases
    try {
        const response = await fetch(`${backend}/api/servers/${serverAddress}/notices`);
        if (response.ok) {
            const data = await response.json();
            console.log(`\n📊 Backend now has ${data.notices ? data.notices.length : 0} notices`);
            return data.notices;
        }
    } catch (error) {
        console.error('Could not fetch notices:', error);
    }
    
    return [];
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
    window.manualSyncCases = manualSyncCases;
    console.log('Manual sync ready. Run manualSyncCases() in console.');
}