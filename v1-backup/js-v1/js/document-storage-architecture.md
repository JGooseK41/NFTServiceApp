# Document Storage Architecture

## Overview
Dual storage system for legal documents with encryption for recipients and full access for process servers.

## Storage Locations

### 1. IPFS (Encrypted)
- **Purpose**: Permanent, decentralized storage for recipients
- **Format**: Encrypted PDF (AES-256)
- **Access**: Only recipients with decryption key
- **When**: After recipient accepts service
- **Stored**: IPFS hash in blockchain NFT metadata

### 2. Backend Database (Unencrypted)
- **Purpose**: Immediate access for process servers and authorized parties
- **Format**: Base64-encoded PDF (original quality)
- **Access**: Process servers, system admins, authorized recipients
- **When**: Immediately upon upload
- **Stored**: PostgreSQL `notice_components.document_data`

## Data Flow

```
1. Document Upload
   ├── Convert PDF to Base64
   ├── Store unencrypted in PostgreSQL (immediate access)
   ├── Generate AES-256 encryption key
   ├── Encrypt PDF
   ├── Upload encrypted to IPFS
   └── Store IPFS hash + encryption key

2. Document Access
   ├── Process Server: Fetch from PostgreSQL (unencrypted)
   └── Recipient: 
       ├── Before acceptance: No access
       ├── After acceptance: 
           ├── Get IPFS hash from blockchain
           ├── Fetch encrypted from IPFS
           └── Decrypt with key
```

## Implementation Steps

### Step 1: Fix Current Storage (PostgreSQL)
- Remove 10,000px canvas height limit
- Store original PDF as base64 (no conversion to images)
- Increase upload limit to 50MB
- Keep PDF quality intact

### Step 2: Add IPFS Encryption
- Generate unique AES-256 key per document
- Encrypt PDF before IPFS upload
- Store encryption key in database (not on blockchain)
- Only provide key after service acceptance

### Step 3: Access Control
- Process servers: Direct PostgreSQL access
- Recipients (pre-acceptance): No document access
- Recipients (post-acceptance): IPFS + decryption key
- Public: Only alert thumbnail (proof of service)

## Benefits
1. **Redundancy**: Documents stored in two locations
2. **Privacy**: Encrypted on IPFS, only recipients can decrypt
3. **Efficiency**: Process servers get instant access via database
4. **Permanence**: IPFS ensures documents can't be deleted
5. **Legal Compliance**: Original PDF preserved, no quality loss

## Security Model
- Encryption keys never stored on blockchain (too public)
- Keys provided only after identity verification
- Process server access logged for audit trail
- Time-limited access tokens for recipients