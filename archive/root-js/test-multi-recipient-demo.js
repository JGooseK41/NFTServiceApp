/**
 * Demo: Multi-Recipient Case Handling
 * This demonstrates how the system handles multiple recipients per case
 */

// Simulate backend response with multi-recipient cases
const mockBackendResponse = {
    success: true,
    cases: [
        {
            caseNumber: "123456",
            serverAddress: "TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY",
            noticeType: "Legal Notice",
            issuingAgency: "Court Agency",
            firstServedAt: "2025-08-07T10:00:00Z",
            lastServedAt: "2025-08-07T10:00:00Z",
            recipients: [
                {
                    recipientAddress: "TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH",
                    recipientName: "",
                    alertId: "1",
                    documentId: "2",
                    alertStatus: "DELIVERED",
                    documentStatus: "SIGNED",
                    viewCount: 5,
                    acceptedAt: "2025-08-07T11:00:00Z",
                    pageCount: 1
                }
            ],
            recipientCount: 1,
            totalViews: 5,
            totalAccepted: 1,
            allSigned: true,
            partialSigned: false
        },
        {
            caseNumber: "34-987654",
            serverAddress: "TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY",
            noticeType: "Notice of Seizure",
            issuingAgency: "The Block Audit",
            firstServedAt: "2025-08-08T14:00:00Z",
            lastServedAt: "2025-08-08T14:30:00Z",
            recipients: [
                {
                    recipientAddress: "TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE",
                    recipientName: "Primary Defendant",
                    alertId: "3",
                    documentId: "4",
                    alertStatus: "DELIVERED",
                    documentStatus: "AWAITING_SIGNATURE",
                    viewCount: 2,
                    acceptedAt: null,
                    pageCount: 1
                },
                {
                    recipientAddress: "TTestAddress2234567890abcdefghijk",
                    recipientName: "Co-Defendant",
                    alertId: "5",
                    documentId: "6",
                    alertStatus: "DELIVERED",
                    documentStatus: "SIGNED",
                    viewCount: 3,
                    acceptedAt: "2025-08-08T15:00:00Z",
                    pageCount: 1
                },
                {
                    recipientAddress: "TTestAddress3234567890abcdefghijk",
                    recipientName: "Third Party",
                    alertId: "7",
                    documentId: "8",
                    alertStatus: "DELIVERED",
                    documentStatus: "AWAITING_SIGNATURE",
                    viewCount: 1,
                    acceptedAt: null,
                    pageCount: 1
                }
            ],
            recipientCount: 3,
            totalViews: 6,
            totalAccepted: 1,
            allSigned: false,
            partialSigned: true
        }
    ],
    totalCases: 2,
    totalNotices: 4
};

// Display the data structure
console.log("=== MULTI-RECIPIENT CASE DEMO ===\n");

mockBackendResponse.cases.forEach(caseData => {
    console.log(`📁 Case #${caseData.caseNumber}`);
    console.log(`   Type: ${caseData.noticeType}`);
    console.log(`   Agency: ${caseData.issuingAgency}`);
    console.log(`   Recipients: ${caseData.recipientCount}`);
    
    // Status display logic (same as frontend)
    let status;
    if (caseData.allSigned) {
        status = "✅ All Signed";
    } else if (caseData.partialSigned) {
        status = `⚠️ ${caseData.totalAccepted}/${caseData.recipientCount} Signed`;
    } else {
        status = "⏳ Awaiting Signatures";
    }
    console.log(`   Status: ${status}`);
    console.log(`   Total Views: ${caseData.totalViews}`);
    
    // Show individual recipients
    console.log("\n   Individual Recipients:");
    caseData.recipients.forEach((recipient, index) => {
        console.log(`   ${index + 1}. ${recipient.recipientAddress.substring(0, 20)}...`);
        if (recipient.recipientName) {
            console.log(`      Name: ${recipient.recipientName}`);
        }
        console.log(`      Alert NFT #${recipient.alertId}: ${recipient.alertStatus}`);
        console.log(`      Document NFT #${recipient.documentId}: ${recipient.documentStatus}`);
        console.log(`      Views: ${recipient.viewCount}`);
        if (recipient.acceptedAt) {
            console.log(`      Signed: ${new Date(recipient.acceptedAt).toLocaleDateString()}`);
        }
    });
    
    console.log("\n" + "─".repeat(60) + "\n");
});

console.log("SUMMARY:");
console.log(`- Total Cases: ${mockBackendResponse.totalCases}`);
console.log(`- Total Notices Served: ${mockBackendResponse.totalNotices}`);
console.log("\nUI BEHAVIOR:");
console.log("- Case #123456 shows 'All Signed' (green badge)");
console.log("- Case #34-987654 shows '1/3 Signed' (orange gradient badge)");
console.log("- Expanding case shows all 3 recipients with individual tracking");
console.log("\nEach recipient has their own:");
console.log("- Alert NFT (proof of delivery)");
console.log("- Document NFT (for signature)");
console.log("- View tracking");
console.log("- Receipt generation");