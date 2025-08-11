# NFT Service App - Field Mapping for LegalNoticeNFT_v5_Enumerable Contract

## Critical Data Flow Architecture
```
Frontend Input → Backend Validation/Staging → Smart Contract Execution → Blockchain Events → Backend Confirmation → Frontend Display
```

## CONTRACT: LegalNoticeNFT_v5_Enumerable.sol

### Smart Contract Function Parameters
```solidity
function serveNotice(
    address recipient,
    string memory encryptedIPFS,
    string memory encryptionKey,
    string memory issuingAgency,
    string memory noticeType,
    string memory caseNumber,
    string memory caseDetails,
    string memory legalRights,
    bool sponsorFees,
    string memory metadataURI
)
```

### BatchNotice Struct
```solidity
struct BatchNotice {
    address recipient;
    string encryptedIPFS;
    string encryptionKey;
    string issuingAgency;
    string noticeType;
    string caseNumber;
    string caseDetails;
    string legalRights;
    bool sponsorFees;
    string metadataURI;
}
```

## Complete Field Mapping Table

| Layer | Field Name | Data Type | Description | Validation Required |
|-------|------------|-----------|-------------|-------------------|
| **FRONTEND** | | | | |
| HTML ID | `mintRecipient` | string | Recipient wallet address | Must be valid TRON address |
| HTML ID | `encryptedIPFS` | string | IPFS hash of encrypted document | Generated after encryption |
| HTML ID | `encryptionKey` | string | Key to decrypt document | Generated during encryption |
| HTML ID | `issuingAgency` | string | Agency name from registration | Must match process_servers.agency |
| HTML ID | `noticeType` | string | Type of legal notice | Required field |
| HTML ID | `mintCaseNumber` | string | Case number | Optional but recommended |
| HTML ID | `caseDetails` | string | Additional case details | Optional |
| HTML ID | `legalRights` | string | Rights statement | Optional |
| HTML ID | `sponsorFees` | boolean | Sponsor recipient's fees | true/false |
| HTML ID | `metadataURI` | string | IPFS metadata URI | Optional |
| | | | | |
| **BACKEND** | | | | |
| Column | `recipient_address` | VARCHAR(255) | Recipient wallet | Validate TRON format |
| Column | `encrypted_ipfs` | TEXT | IPFS hash | Required |
| Column | `encryption_key` | TEXT | Decryption key | Required |
| Column | `issuing_agency` | VARCHAR(255) | Must match process_servers.agency | Cross-validate with process_servers table |
| Column | `notice_type` | VARCHAR(100) | Notice type | Required |
| Column | `case_number` | VARCHAR(100) | Case identifier | Optional |
| Column | `case_details` | TEXT | Extended details | Optional |
| Column | `legal_rights` | TEXT | Rights text | Optional |
| Column | `sponsor_fees` | BOOLEAN | Fee sponsorship | Default false |
| Column | `metadata_uri` | TEXT | IPFS metadata | Optional |
| Column | `server_address` | VARCHAR(255) | Process server wallet | Must match authenticated user |
| | | | | |
| **SMART CONTRACT** | | | | |
| Parameter | `recipient` | address | Recipient wallet | Cannot be zero address |
| Parameter | `encryptedIPFS` | string | Document hash | Memory string |
| Parameter | `encryptionKey` | string | Decryption key | Memory string |
| Parameter | `issuingAgency` | string | Agency name | Memory string |
| Parameter | `noticeType` | string | Notice type | Memory string |
| Parameter | `caseNumber` | string | Case number | Memory string |
| Parameter | `caseDetails` | string | Details | Memory string |
| Parameter | `legalRights` | string | Rights | Memory string |
| Parameter | `sponsorFees` | bool | Sponsorship flag | true/false |
| Parameter | `metadataURI` | string | Metadata | Memory string |

## Smart Contract Events to Backend Mapping

### Event: NoticeServed
```solidity
event NoticeServed(uint256 indexed alertId, uint256 indexed documentId, address indexed recipient);
```
| Event Field | Backend Column | Description |
|------------|---------------|-------------|
| alertId | alert_id | Alert NFT token ID |
| documentId | document_id | Document NFT token ID |
| recipient | recipient_address | Recipient wallet (for verification) |

### Event: LegalNoticeCreated
```solidity
event LegalNoticeCreated(uint256 indexed noticeId, address indexed server, address indexed recipient, uint256 timestamp);
```
| Event Field | Backend Column | Description |
|------------|---------------|-------------|
| noticeId | notice_id | Unique notice identifier |
| server | server_address | Process server wallet (for verification) |
| recipient | recipient_address | Recipient wallet |
| timestamp | blockchain_timestamp | Block timestamp |

## Implementation Code Examples

### 1. Frontend to Backend Submission
```javascript
// Frontend: Prepare data for backend
async function submitNoticeToBackend() {
    const noticeData = {
        // Direct field mapping
        recipient_address: document.getElementById('mintRecipient').value,
        encrypted_ipfs: encryptedHash,
        encryption_key: encryptionKey,
        issuing_agency: serverData.agency, // CRITICAL: Must match backend process_servers.agency
        notice_type: document.getElementById('noticeType').value,
        case_number: document.getElementById('mintCaseNumber').value,
        case_details: document.getElementById('caseDetails')?.value || '',
        legal_rights: document.getElementById('legalRights')?.value || '',
        sponsor_fees: document.getElementById('sponsorFees')?.checked || false,
        metadata_uri: metadataIPFS || '',
        server_address: tronWeb.defaultAddress.base58
    };
    
    // Send to backend for validation
    const response = await fetch('/api/stage-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noticeData)
    });
    
    return response.json();
}
```

### 2. Backend Validation Before Smart Contract
```javascript
// Backend: Validate and prepare for smart contract
app.post('/api/stage-notice', async (req, res) => {
    const {
        recipient_address,
        encrypted_ipfs,
        encryption_key,
        issuing_agency,
        notice_type,
        case_number,
        case_details,
        legal_rights,
        sponsor_fees,
        metadata_uri,
        server_address
    } = req.body;
    
    // CRITICAL VALIDATION 1: Verify issuing_agency matches registered process server
    const serverCheck = await pool.query(
        'SELECT agency FROM process_servers WHERE wallet_address = $1 AND status = $2',
        [server_address, 'approved']
    );
    
    if (!serverCheck.rows.length || serverCheck.rows[0].agency !== issuing_agency) {
        return res.status(400).json({
            error: 'Issuing agency does not match registered process server'
        });
    }
    
    // CRITICAL VALIDATION 2: Store in staging table
    const staged = await pool.query(`
        INSERT INTO staged_notices (
            recipient_address, encrypted_ipfs, encryption_key,
            issuing_agency, notice_type, case_number,
            case_details, legal_rights, sponsor_fees,
            metadata_uri, server_address, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
        RETURNING id
    `, [recipient_address, encrypted_ipfs, encryption_key,
        issuing_agency, notice_type, case_number,
        case_details, legal_rights, sponsor_fees,
        metadata_uri, server_address]);
    
    res.json({ 
        success: true, 
        stagingId: staged.rows[0].id,
        contractParams: {
            recipient: recipient_address,
            encryptedIPFS: encrypted_ipfs,
            encryptionKey: encryption_key,
            issuingAgency: issuing_agency,
            noticeType: notice_type,
            caseNumber: case_number || '',
            caseDetails: case_details || '',
            legalRights: legal_rights || '',
            sponsorFees: sponsor_fees || false,
            metadataURI: metadata_uri || ''
        }
    });
});
```

### 3. Smart Contract Execution
```javascript
// Frontend: Execute smart contract with backend-validated params
async function executeSmartContract(contractParams) {
    const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
    
    // Calculate fees
    const fee = await contract.calculateFee(tronWeb.defaultAddress.base58).call();
    const sponsorshipFee = contractParams.sponsorFees ? 
        await contract.sponsorshipFee().call() : 0;
    const totalFee = Number(fee) + Number(sponsorshipFee);
    
    // Execute contract - parameter order MUST match contract
    const tx = await contract.serveNotice(
        contractParams.recipient,
        contractParams.encryptedIPFS,
        contractParams.encryptionKey,
        contractParams.issuingAgency,
        contractParams.noticeType,
        contractParams.caseNumber,
        contractParams.caseDetails,
        contractParams.legalRights,
        contractParams.sponsorFees,
        contractParams.metadataURI
    ).send({
        callValue: totalFee,
        feeLimit: 1000000000
    });
    
    return tx;
}
```

### 4. Backend Event Listener for Confirmation
```javascript
// Backend: Listen for blockchain events and update database
async function setupEventListeners() {
    const tronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        eventServer: 'https://api.trongrid.io'
    });
    
    const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
    
    // Listen for NoticeServed event
    contract.NoticeServed().watch((err, event) => {
        if (err) return console.error(err);
        
        const { alertId, documentId, recipient } = event.result;
        
        // Update backend with confirmed blockchain data
        pool.query(`
            UPDATE staged_notices 
            SET alert_id = $1, 
                document_id = $2, 
                status = 'confirmed',
                transaction_hash = $3,
                block_number = $4,
                confirmed_at = NOW()
            WHERE recipient_address = $5 
            AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
        `, [alertId, documentId, event.transaction, 
            event.block, recipient]);
    });
    
    // Listen for LegalNoticeCreated event
    contract.LegalNoticeCreated().watch((err, event) => {
        if (err) return console.error(err);
        
        const { noticeId, server, recipient, timestamp } = event.result;
        
        // Store in served_notices table
        pool.query(`
            INSERT INTO served_notices (
                notice_id, server_address, recipient_address,
                blockchain_timestamp, status
            ) VALUES ($1, $2, $3, $4, 'delivered')
        `, [noticeId, server, recipient, new Date(timestamp * 1000)]);
    });
}
```

## Critical Validation Checklist

### Frontend Must:
- [ ] Get issuing_agency from process_servers.agency (not user input)
- [ ] Validate all required fields before submission
- [ ] Send to backend first, not directly to smart contract

### Backend Must:
- [ ] Verify server_address matches authenticated user
- [ ] Verify issuing_agency matches process_servers.agency
- [ ] Stage all data before blockchain execution
- [ ] Return properly ordered contract parameters

### Smart Contract Requires:
- [ ] Parameters in exact order as function signature
- [ ] Correct fee calculation (base fee + sponsorship if applicable)
- [ ] Non-zero recipient address
- [ ] msg.sender has PROCESS_SERVER_ROLE or ADMIN_ROLE

### Event Confirmation Must:
- [ ] Update staged_notices with blockchain confirmation
- [ ] Store alert_id and document_id from events
- [ ] Record transaction hash and block number
- [ ] Update status to 'confirmed' only after blockchain confirmation

## Database Tables Required

### process_servers
```sql
CREATE TABLE process_servers (
    wallet_address VARCHAR(255) PRIMARY KEY,
    agency VARCHAR(255) NOT NULL, -- CRITICAL: Must match issuingAgency in contract
    name VARCHAR(255),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending'
);
```

### staged_notices
```sql
CREATE TABLE staged_notices (
    id SERIAL PRIMARY KEY,
    recipient_address VARCHAR(255),
    encrypted_ipfs TEXT,
    encryption_key TEXT,
    issuing_agency VARCHAR(255), -- Must match process_servers.agency
    notice_type VARCHAR(100),
    case_number VARCHAR(100),
    case_details TEXT,
    legal_rights TEXT,
    sponsor_fees BOOLEAN DEFAULT false,
    metadata_uri TEXT,
    server_address VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    alert_id TEXT, -- Updated from blockchain event
    document_id TEXT, -- Updated from blockchain event
    transaction_hash VARCHAR(255),
    block_number BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP
);
```