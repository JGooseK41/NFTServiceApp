# Legal Service NFT Workflow

## Overview
The system creates two separate NFTs for each legal service:

1. **Service NFT** - Automatically sent to recipient's wallet
2. **Document NFT** - Held by contract until recipient accepts

## Workflow Steps

### 1. Document Upload (Law Enforcement)
```
[Officer uploads PDF/Word] → [System converts to images] → [Creates preview + full doc]
```

- **Supported formats**: PDF, Word (.doc, .docx), Images (JPEG, PNG)
- **Automatic conversion**: PDFs and Word docs converted to images
- **Preview generation**: Small base64 image for wallet display
- **Full document**: Stored on IPFS for later access

### 2. Service Creation
```
[Fill recipient info] → [Create 2 NFTs] → [Service NFT sent to recipient]
```

**Service NFT contains:**
- Preview image (base64) - visible in any wallet
- Case number
- Document type
- Server details
- Link to full document

**Document NFT contains:**
- Full document on IPFS
- Document hash for verification
- Metadata (jurisdiction, court, etc.)
- Held by contract until accepted

### 3. Recipient Experience
```
[Sees NFT in wallet] → [Views preview] → [Accepts service] → [Receives full document]
```

1. **Immediate visibility**: Service NFT appears in recipient's wallet
2. **Preview available**: Can see document preview without accepting
3. **Acceptance required**: Must accept to access full document
4. **Proof of service**: Acceptance timestamp recorded on blockchain

### 4. Confirmation Flow
```
[Recipient accepts] → [Document NFT transfers] → [Server notified] → [Service confirmed]
```

- **Automatic notification**: Server receives confirmation when accepted
- **Timestamp proof**: Exact acceptance time recorded
- **Full access granted**: Recipient can now view/download full document

## Benefits

### For Law Enforcement:
- ✅ Proof of service delivery
- ✅ Timestamp verification
- ✅ Recipient acknowledgment
- ✅ Immutable record

### For Recipients:
- ✅ Preview before accepting
- ✅ Wallet notification
- ✅ Control over acceptance
- ✅ Permanent access to documents

### Legal Compliance:
- ✅ Chain of custody maintained
- ✅ Verification of delivery
- ✅ Consent recorded
- ✅ Audit trail preserved

## Technical Implementation

### Smart Contract Functions:
```solidity
// Issue service (creates both NFTs)
issueService(recipient, preview, ipfsHash, documentHash, caseNumber, docType)

// Accept service (transfers document NFT)
acceptDocument(serviceId)

// Check status
isServiceAcknowledged(serviceId)
getServiceStatus(serviceId)
```

### Frontend Features:
- PDF/Word to image conversion
- Automatic preview generation
- IPFS upload integration
- Real-time status tracking
- Multi-chain support

## Security Features:
- Non-transferable service NFTs
- Document hash verification
- Role-based access (authorized servers only)
- Tamper-proof timestamps
- Encrypted IPFS storage (optional)