# V4 Quick Reference Guide

## Contract Address
```
TSQZgUdYGm7LYSoZqr4SCKs8nb4C98ckn5
```

## Key Changes from Previous Versions

### 1. serveNotice Function (10 parameters)
```javascript
await legalContract.serveNotice(
    recipient,           // address
    encryptedIPFS,      // string
    encryptionKey,      // string
    issuingAgency,      // string
    noticeType,         // string
    caseNumber,         // string
    caseDetails,        // string
    legalRights,        // string
    sponsorFees,        // bool
    metadataURI         // string (NEW - for NFT visibility!)
).send({
    callValue: fee,
    feeLimit: 300_000_000
});
```

### 2. Batch Serving (NEW)
```javascript
const batchNotices = [
    {
        recipient: "TXxx...",
        encryptedIPFS: "",
        encryptionKey: "",
        issuingAgency: "Agency Name",
        noticeType: "Summons",
        caseNumber: "2024-001",
        caseDetails: "Details",
        legalRights: "Rights",
        sponsorFees: true,
        metadataURI: "ipfs://..."
    },
    // ... up to 10 notices
];

await legalContract.serveNoticeBatch(batchNotices).send({
    callValue: totalFee,
    feeLimit: 500_000_000
});
```

### 3. Server ID (NEW)
```javascript
// Get server ID
const serverId = await legalContract.getServerId(serverAddress).call();
// Returns: 1000, 1001, 1002, etc.
```

### 4. Service Attempts (NEW)
```javascript
// Record attempt
await legalContract.recordServiceAttempt(
    noticeId,
    "No one at residence - 2nd attempt"
).send();

// Check attempts
const attemptCount = await legalContract.serviceAttempts(noticeId).call();
const lastNote = await legalContract.lastAttemptNote(noticeId).call();
```

## UI File Structure
```
v4/
├── index_v4.html          # Complete UI with v4 integration
├── LegalNoticeNFT_v4_Final.sol      # Source code
├── LegalNoticeNFT_v4_Final.abi      # Contract ABI
├── CONTRACT_V4_INFO.json  # Deployment details
├── config.js              # Configuration
└── js/                    # JavaScript dependencies
    ├── simple-encryption.js
    ├── thumbnail-generator.js
    └── ...
```

## Cost Comparison

### Single Notice
- Traditional: 25-27 TRX per notice
- v4: Same cost

### Batch (10 notices)
- Traditional: 250-270 TRX (10 transactions)
- v4 Batch: 50-70 TRX (1 transaction)
- **Savings: 200 TRX (75-80%)**

## Important Notes

1. **Always include metadataURI** - Even if empty string, must be 10th parameter
2. **Batch limit is 10** - Contract will revert if more than 10
3. **Server IDs start at 1000** - Automatically assigned
4. **Service attempts** - Only server or admin can record

## Testing Checklist

- [ ] Single notice with metadata
- [ ] Batch serving (2-10 notices)
- [ ] Server ID display
- [ ] Service attempt recording
- [ ] NFT visibility in wallet