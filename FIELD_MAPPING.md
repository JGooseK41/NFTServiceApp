# NFT Service App - Field Mapping & Data Flow Documentation

## Critical Data Flow Architecture
```
Frontend → Backend (validation & staging) → Smart Contract → Backend (confirmation) → Frontend (display)
```

## Standard Field Names Across All Layers

### Process Server Registration Fields

| Frontend Field | Backend Column | Smart Contract | Description |
|---------------|---------------|----------------|-------------|
| walletAddress | wallet_address | msg.sender | Process server's TRON wallet |
| name | name | - | Person's name |
| agency | agency | issuingAgency | Agency/company name |
| email | email | - | Contact email |
| phone | phone | - | Contact phone |
| serverID | server_id | serverId (event) | Unique server identifier |
| licenseNumber | license_number | - | Professional license |
| jurisdiction | jurisdiction | - | Service area |
| status | status | hasRole() | pending/approved/rejected |

### Notice Creation Fields

| Frontend Field | Backend Column | Smart Contract Parameter | Description |
|---------------|---------------|-------------------------|-------------|
| recipientAddress | recipient_address | recipient | Notice recipient wallet |
| encryptedIPFS | encrypted_ipfs | encryptedIPFS | IPFS hash of encrypted doc |
| encryptionKey | encryption_key | encryptionKey | Decryption key |
| issuingAgency | issuing_agency | issuingAgency | Agency serving notice |
| noticeType | notice_type | noticeType | Type of legal notice |
| caseNumber | case_number | caseNumber | Case identifier |
| caseDetails | case_details | caseDetails | Additional case info |
| legalRights | legal_rights | legalRights | Rights statement |
| sponsorFees | sponsor_fees | sponsorFees | Whether to sponsor gas |
| metadataURI | metadata_uri | metadataURI | IPFS metadata URI |
| tokenName | token_name | - | Display name for NFT |

### Notice Response Fields (Smart Contract → Backend)

| Smart Contract Event | Backend Column | Frontend Display | Description |
|---------------------|---------------|------------------|-------------|
| alertId | alert_id | alertID | Alert NFT token ID |
| documentId | document_id | documentID | Document NFT token ID |
| server (address) | server_address | serverAddress | Process server wallet |
| recipient | recipient_address | recipientAddress | Recipient wallet |
| timestamp | created_at | createdAt | Notice creation time |
| transactionHash | transaction_hash | txHash | Blockchain tx hash |

## Data Flow Implementation

### 1. Frontend → Backend (Staging)
```javascript
// Frontend sends to backend for validation
const stageData = {
    recipientAddress: document.getElementById('mintRecipient').value,
    issuingAgency: serverData.agency, // From registration
    noticeType: document.getElementById('noticeType').value,
    caseNumber: document.getElementById('mintCaseNumber').value,
    encryptedIPFS: encryptedHash,
    encryptionKey: encryptedKey,
    // ... other fields
};

// Backend validates and stores in staging table
POST /api/stage-transaction
```

### 2. Backend → Smart Contract
```javascript
// Backend prepares contract call with validated data
const contractParams = {
    recipient: stagedData.recipient_address,
    encryptedIPFS: stagedData.encrypted_ipfs,
    encryptionKey: stagedData.encryption_key,
    issuingAgency: stagedData.issuing_agency, // Must match process_servers.agency
    noticeType: stagedData.notice_type,
    caseNumber: stagedData.case_number,
    caseDetails: stagedData.case_details || '',
    legalRights: stagedData.legal_rights || '',
    sponsorFees: stagedData.sponsor_fees || false,
    metadataURI: stagedData.metadata_uri || ''
};

// Call smart contract
const tx = await contract.serveNotice(...Object.values(contractParams));
```

### 3. Smart Contract → Backend (Confirmation)
```javascript
// Listen for blockchain events
contract.on('NoticeServed', async (alertId, documentId, recipient, event) => {
    // Update backend with confirmed blockchain data
    await updateServedNotice({
        alert_id: alertId.toString(),
        document_id: documentId.toString(),
        recipient_address: recipient,
        server_address: event.transaction.from,
        transaction_hash: event.transaction.hash,
        block_number: event.blockNumber,
        status: 'confirmed'
    });
});

contract.on('LegalNoticeCreated', async (noticeId, server, recipient, timestamp) => {
    // Additional confirmation data
    await updateNoticeMetadata({
        notice_id: noticeId.toString(),
        confirmed_at: new Date(timestamp * 1000),
        blockchain_status: 'confirmed'
    });
});
```

### 4. Backend → Frontend (Display)
```javascript
// Backend provides confirmed data to frontend
GET /api/notices/:noticeId
Response: {
    alertId: '123',
    documentId: '456',
    recipientAddress: 'TGdD34RR3rZf...',
    issuingAgency: 'Legal Process Services LLC', // From process_servers.agency
    status: 'Delivered',
    confirmedOnChain: true,
    transactionHash: '0xabc...',
    blockNumber: 12345678
}
```

## Critical Validation Rules

### Backend MUST Validate:
1. **Agency Match**: `issuing_agency` must match `process_servers.agency` for the connected wallet
2. **Wallet Authorization**: Sender must have PROCESS_SERVER_ROLE in smart contract
3. **Required Fields**: All required contract parameters must be present
4. **Data Types**: Ensure proper type conversion (strings, addresses, numbers)

### Smart Contract Events to Monitor:
```solidity
event NoticeServed(uint256 indexed alertId, uint256 indexed documentId, address indexed recipient);
event LegalNoticeCreated(uint256 indexed noticeId, address indexed server, address indexed recipient, uint256 timestamp);
event ServiceAttemptRecorded(uint256 indexed noticeId, uint256 attemptNumber, string note);
```

## Database Schema Alignment

### process_servers (Backend)
```sql
CREATE TABLE process_servers (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    agency VARCHAR(255),           -- Maps to smart contract issuingAgency
    email VARCHAR(255),
    phone VARCHAR(50),
    server_id VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending',
    license_number VARCHAR(100),
    jurisdiction VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### served_notices (Backend)
```sql
CREATE TABLE served_notices (
    id SERIAL PRIMARY KEY,
    notice_id TEXT UNIQUE NOT NULL,
    alert_id TEXT,                  -- From smart contract event
    document_id TEXT,                -- From smart contract event  
    server_address VARCHAR(255),     -- Must match process_servers.wallet_address
    recipient_address VARCHAR(255),
    issuing_agency VARCHAR(255),     -- Must match process_servers.agency
    notice_type VARCHAR(100),
    case_number VARCHAR(100),
    transaction_hash VARCHAR(255),
    block_number BIGINT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,          -- When blockchain confirms
    accepted_at TIMESTAMP            -- When recipient accepts
);
```

## Implementation Checklist

- [ ] Frontend sends all data to backend first
- [ ] Backend validates agency matches registered server
- [ ] Backend stages transaction before blockchain call
- [ ] Smart contract parameters match backend staging data
- [ ] Event listeners update backend with blockchain confirmation
- [ ] Backend serves as single source of truth
- [ ] Frontend displays only backend-confirmed data
- [ ] Agency field is consistently named across all layers