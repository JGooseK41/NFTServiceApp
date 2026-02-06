# Unified System Review - LegalNotice Service

## Overview

This document analyzes the end-to-end flow from server upload to recipient document delivery.

---

## 1. CURRENT STATE: What Each Layer Does

### A. Lite Smart Contract (On-Chain)
**File:** `contracts/LegalNoticeNFT_Lite.sol`

**What it stores per notice:**
```solidity
struct Notice {
    address recipient;      // Who was served
    address server;         // Who served them
    uint48 servedAt;        // Service timestamp
    uint48 acknowledgedAt;  // When recipient acknowledged
    bool acknowledged;      // Has recipient acknowledged?
}
// Plus: tokenURI (metadata link) stored separately
```

**Key functions:**
- `serveNotice(recipient, metadataURI)` - Single serve
- `serveNoticeBatch(recipients[], metadataURIs[])` - Batch serve
- `acknowledgeNotice(alertId)` - Recipient acknowledges
- `getRecipientNotices(address)` - Get all notices for recipient
- `getServerNotices(address)` - Get all notices by server

**What's NOT on-chain:** Case number, agency, document, thumbnail - all in metadataURI

---

### B. Frontend (theblockservice.com)
**Files:** `index.html`, `js-v2/app.js`, `js-v2/modules/*.js`

**Form fields captured:**
- Recipient addresses (up to 10)
- Case number
- Issuing agency/law firm
- Notice type (Summons, Subpoena, etc.)
- Case details
- Notice summary
- Response deadline
- PDF documents (drag-and-drop)

**Current flow:**
1. User fills form and uploads PDFs
2. `saveToCase()` sends everything to backend
3. Backend consolidates PDFs, generates thumbnail
4. `confirmAndMint()` triggers NFT creation
5. `notices.createNotice()` processes documents
6. `documents.processDocuments()`:
   - Uploads encrypted PDF to IPFS
   - Uploads thumbnail to IPFS
   - Stores copy on backend disk
7. `contract.createAlertNFT()` or `createBatchNotices()` mints NFT

---

### C. Backend Database
**Primary tables:**

| Table | Purpose |
|-------|---------|
| `cases` | Draft cases with PDF paths, server address |
| `served_notices` | Official notices with NFT IDs, tx hash |
| `case_service_records` | Links cases to recipients with full metadata |
| `notice_components` | Alert + Document NFT pairs |
| `token_tracking` | Token ID to case mapping |
| `notice_views` | When recipients view notices |
| `recipient_acknowledgments` | Legal signatures with device info |
| `document_storage` | Disk-stored PDF references |

---

### D. Recipient Portal (blockserved.com)
**Files:** `index-blockserved.html`, `backend/routes/recipient-*.js`

**Current flow:**
1. Recipient connects wallet (TronLink)
2. Portal queries: `GET /api/recipient-cases/wallet/:address`
3. Backend searches `case_service_records` for recipient
4. PDF served from disk: `GET /api/recipient/document/:caseNumber/view`
5. Signing logs to: `POST /api/notices/audit`

---

### E. Server Dashboard
**Files:** `js-v2/modules/cases.js`, `js-v2/modules/receipts.js`

**What exists:**
- Backend APIs for server case queries
- Receipt generation with transaction hash
- Proof of service document generation

**What's missing:**
- No dedicated dashboard UI in js-v2
- No status aggregation (has recipient viewed/signed?)

---

## 2. IDENTIFIED GAPS

### Gap 1: Case Data Not Fully Saved to Backend
**Problem:** When case is saved, recipients are stored but linkage to NFT minting is loose.

**Current:** `saveToCase()` saves to `cases` table, but NFT minting doesn't update that record with token IDs.

**Fix needed:** After NFT mint, update `cases` table with:
- `alert_nft_id`
- `document_nft_id` (if applicable)
- `tx_hash`
- `served_at`
- `status = 'served'`

---

### Gap 2: Recipient Lookup Missing Data
**Problem:** Recipient portal queries `case_service_records`, but this table may not have the minted case data.

**Current flow creates records in:**
- `cases` table (on save)
- Blockchain (on mint)
- But NOT always `case_service_records`

**Fix needed:** Ensure `case_service_records` is populated when:
1. Case is saved (with `status = 'pending'`)
2. Case is minted (update with token IDs, tx hash, `status = 'served'`)

---

### Gap 3: Server Can't See Recipient Status
**Problem:** Server needs to know if recipient has viewed/signed document.

**Data exists in:**
- `notice_views` - view timestamps
- `recipient_acknowledgments` - signatures

**Missing:** Aggregated endpoint for server to query recipient status.

**Fix needed:** Create endpoint:
```
GET /api/server/:wallet/case/:caseNumber/recipient-status
Returns: [
  {
    recipient: "T...",
    viewed_at: timestamp,
    signed_at: timestamp,
    status: "Delivered|Viewed|Signed For"
  }
]
```

---

### Gap 4: No Server Dashboard UI
**Problem:** Server has no way to see prior notices in js-v2 interface.

**Backend exists:** `/api/server/:wallet/all-notices`

**Frontend missing:** Cases tab that calls this API and displays results.

**Fix needed:** Add Cases tab to theblockservice.com that shows:
- All prior cases with status
- Link to view details
- Download receipt option
- Recipient status indicators

---

### Gap 5: Stamped Copy Incomplete
**Problem:** Receipt exists but doesn't show recipient acknowledgment status.

**Current receipt shows:**
- Transaction hash
- Token IDs
- Service date
- "Delivered" status (always)

**Fix needed:** Add to receipt:
- "Viewed at: [timestamp]" if viewed
- "Signed For at: [timestamp]" if signed
- Signature hash from blockchain

---

### Gap 6: Lite Contract Metadata Structure
**Problem:** Lite contract only stores metadataURI, so ALL data must be in metadata.

**Current metadata includes:**
- name, description, image
- case number, agency, notice type
- IPFS hash for document

**Verify needed:** Ensure thumbnail IPFS URL is in `image` field.

---

## 3. UNIFIED FIX PLAN

### Phase 1: Backend Data Linkage (Critical)

**Task 1.1: Update case on NFT mint**
```javascript
// After successful mint in contract.js
await fetch('/api/cases/:caseNumber/update-served', {
  method: 'POST',
  body: JSON.stringify({
    alertNftId: tokenId,
    txHash: tx,
    servedAt: new Date(),
    status: 'served'
  })
});
```

**Task 1.2: Ensure case_service_records populated**
- On saveToCase: Insert record with status='pending'
- On mint: Update with token IDs, tx hash, status='served'

**Task 1.3: Create recipient status endpoint**
```javascript
// backend/routes/server-cases-api.js
router.get('/server/:wallet/case/:caseNumber/recipient-status', async (req, res) => {
  // Query case_service_records + notice_views + recipient_acknowledgments
  // Return aggregated status per recipient
});
```

---

### Phase 2: Frontend Server Dashboard

**Task 2.1: Add Cases tab to theblockservice.com**
- List all cases from `/api/server/:wallet/all-notices`
- Show: case number, recipients count, served date, status

**Task 2.2: Case detail modal**
- Show all recipients with individual status
- View/download document
- Download receipt with blockchain stamp

**Task 2.3: Status indicators**
- Green check: Served
- Blue eye: Viewed
- Signed seal: Signed For

---

### Phase 3: Recipient Portal Fixes

**Task 3.1: Ensure data consistency**
- Recipient lookup should find cases regardless of how they were created
- Add fallback to `served_notices` table if not in `case_service_records`

**Task 3.2: Show proper NFT status**
- Alert NFT: Always shows "Delivered"
- Document NFT: Shows "Awaiting Signature" or "Document Signed For"

---

### Phase 4: Receipt Enhancement

**Task 4.1: Add recipient status to receipt**
- Query notice_views for view timestamps
- Query recipient_acknowledgments for signature data

**Task 4.2: Show blockchain signature proof**
- Link to TronScan for transaction verification
- Include signature hash in receipt

---

## 4. DATA FLOW DIAGRAM (TARGET STATE)

```
SERVER UPLOADS (theblockservice.com)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  saveToCase()                                                │
│  ├─ POST /api/cases                                         │
│  ├─ PDF consolidated, thumbnail generated                   │
│  └─ Insert into: cases, case_service_records (status=pending)│
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  confirmAndMint()                                            │
│  ├─ Upload encrypted PDF to IPFS                            │
│  ├─ Upload thumbnail to IPFS                                │
│  ├─ Build TRC-721 metadata with:                            │
│  │   - name, description, image (IPFS thumbnail)            │
│  │   - case number, agency, notice type                     │
│  │   - external_url to blockserved.com                      │
│  ├─ Mint NFT: serveNotice(recipient, metadataURI)          │
│  └─ Update: cases, case_service_records (status=served)     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN (Lite Contract)                                  │
│  ├─ Notice struct: recipient, server, timestamps, acknowledged│
│  ├─ TokenURI: points to metadata                             │
│  └─ Events: NoticeServed, NoticeAcknowledged                 │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  RECIPIENT VIEWS (blockserved.com)                           │
│  ├─ Connect wallet                                           │
│  ├─ Query: /api/recipient-cases/wallet/:address             │
│  ├─ Backend searches: case_service_records + served_notices │
│  ├─ Serve PDF from disk                                      │
│  ├─ Log view in: notice_views                                │
│  ├─ On sign: record in recipient_acknowledgments            │
│  └─ Update: case_service_records (viewed_at, signed_at)      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVER CHECKS STATUS                                        │
│  ├─ View Cases tab: /api/server/:wallet/all-notices         │
│  ├─ Check recipient: /api/server/:wallet/case/:id/status    │
│  ├─ Download receipt with blockchain stamp                   │
│  └─ Receipt shows: Served → Viewed → Signed For              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. PRIORITY ORDER

1. **Critical:** Fix case update after mint (backend link)
2. **Critical:** Ensure recipient lookup works (data consistency)
3. **High:** Add recipient status endpoint for servers
4. **High:** Add Cases tab to server dashboard
5. **Medium:** Enhance receipt with signature status
6. **Low:** Add acknowledgment tracking improvements

---

## 6. TESTING CHECKLIST

After fixes:

- [ ] Server can upload case with PDF
- [ ] Case is saved to backend with pending status
- [ ] NFT mints successfully on Lite contract
- [ ] Backend updated with token ID and tx hash
- [ ] Recipient can connect wallet on blockserved.com
- [ ] Recipient sees their notice(s)
- [ ] Recipient can view PDF document
- [ ] View is logged in backend
- [ ] Recipient can sign/acknowledge
- [ ] Signature is logged with device info
- [ ] Server can see all prior cases
- [ ] Server can check if recipient viewed
- [ ] Server can check if recipient signed
- [ ] Server can download receipt with blockchain stamp
- [ ] Receipt shows correct status (Delivered/Viewed/Signed For)
