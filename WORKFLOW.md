# Complete NFT Minting Workflow

## Overview
The system uses a staging-first approach where all data is sent to the backend BEFORE any blockchain transaction, preventing wasted energy rentals on failed transactions.

## Step-by-Step Workflow

### Phase 1: Document Upload & Processing

1. **User uploads documents** (`handleDocumentUpload` in index.html:9342)
   - Accepts: JPEG, JPG, PNG, PDF
   - Multiple file support
   - Files stored in `window.uploadedDocuments` array

2. **Document processing** (`processDocuments`)
   - Compresses images to under 400KB
   - Converts PDFs to images
   - Generates thumbnails
   - Creates encrypted versions
   - Uploads to IPFS if configured

3. **Form data collection**
   - Case number, issuing agency
   - Notice type and public text
   - Multiple recipients support (via `getAllRecipients()`)
   - Sponsorship fee option

### Phase 2: Transaction Staging (Backend Storage)

4. **User clicks "Create Legal Notice"** 
   - Calls `createLegalNoticeWithStaging()` (js/transaction-staging.js:544)

5. **Stage transaction on backend** (`TransactionStaging.stageTransaction()`)
   - **Endpoint**: POST `/api/stage/transaction`
   - **Sends**:
     - All form data
     - Recipients array
     - Thumbnail and document files
     - Encrypted document blob
     - IPFS hashes if available
     - Fee amounts (90 TRX base, 5 TRX sponsorship)
   
   - **Backend stores in tables**:
     - `staged_transactions` - Main transaction record
     - `staged_notices` - Notice details
     - `staged_files` - File references
     - `staged_ipfs` - IPFS data
     - `staged_recipients` - Each recipient
     - `staged_energy_estimates` - Energy calculations

6. **Staging confirmation dialog**
   - Shows cost breakdown
   - Energy rental estimate (~30-45 TRX for energy)
   - Total cost preview
   - User can cancel or proceed

### Phase 3: Energy Rental

7. **User clicks "Execute on Blockchain"**
   - Calls `TransactionStaging.proceedWithExecution(transactionId)`
   - Shows `TransactionStatus` modal with progress updates

8. **Retrieve staged data from backend**
   - **Endpoint**: GET `/api/stage/transaction/:transactionId`
   - Backend returns all stored data
   - Data is validated and ready

9. **Energy rental process** (`EnergyRental.prepareEnergyForTransaction()`)
   - **Status Update**: "Acquiring Energy" phase shown
   - Calculates needed energy (1-1.5M for typical transaction)
   - Connects to JustLend contract
   - **Critical Fix Applied**: Now properly tracks `energyBefore`
   - Rents energy at ~0.03 TRX per 1000 units
   - Verifies energy was received
   - If fails: Prompts user to continue with higher fees

### Phase 4: Blockchain Transaction

10. **Execute smart contract** 
    - **Status Update**: "Creating Legal Notices" phase
    - For single recipient: `legalContract.serveNotice()`
    - For multiple: `legalContract.serveNoticeBatch()`
    - **Parameters from backend**:
      - Recipient addresses
      - Encrypted IPFS hash
      - Encryption key
      - Notice metadata
      - Sponsorship flag
    - **Payment**: 90 TRX + (5 TRX × recipients if sponsoring)

11. **Transaction confirmation**
    - **Status Update**: "Confirming Delivery" phase
    - Waits for blockchain confirmation
    - Extracts alert IDs and document IDs
    - Gets transaction hash

### Phase 5: Backend Recording

12. **Update backend with results**
    - **Endpoint**: POST `/api/stage/execute/:transactionId`
    - **Sends**:
      - `blockchainTxHash`
      - `alertIds[]` array
      - `documentIds[]` array
      - `energyUsed`

13. **Backend permanent storage**
    - Moves files from `/uploads/staged/` to `/uploads/documents/`
    - Inserts into `served_notices` table
    - Records in `notice_components` with all IDs
    - Updates transaction status to 'executed'
    - Stores transaction hash permanently

14. **Success display**
    - Shows success in `TransactionStatus` modal
    - Displays transaction hash
    - Confirms all recipients notified

## Data Flow Summary

```
1. Upload Images → 2. Fill Form → 3. Stage on Backend → 4. Show Cost Preview
→ 5. User Confirms → 6. Rent Energy → 7. Execute on Blockchain 
→ 8. Get Transaction Hash → 9. Store Hash in Backend → 10. Show Success
```

## Key Features

### Error Prevention
- ✅ All data validated BEFORE energy rental
- ✅ Backend validates recipient addresses
- ✅ Files stored before blockchain execution
- ✅ Energy rental can fail gracefully

### Cost Breakdown (per transaction)
- Base fee: 90 TRX
- Sponsorship: 5 TRX per recipient (optional)
- Energy rental: ~30-45 TRX (saves ~500+ TRX vs burning)
- Total: ~120-140 TRX for single recipient with sponsorship

### Backend Tables Used
- `staged_transactions` - Temporary storage
- `served_notices` - Permanent record
- `notice_components` - Image/document storage
- `draft_files` - For saved drafts

### Critical Files
- `js/transaction-staging.js` - Staging flow
- `js/energy-rental.js` - Energy management
- `js/transaction-status.js` - Progress UI
- `backend/routes/transaction-staging.js` - Backend API
- `index.html` - Main UI and form handling

## Security Features
- Documents encrypted client-side
- Only recipient can decrypt with private key
- IPFS storage for permanence
- Blockchain proof of delivery
- Immutable audit trail

## Recent Fixes Applied
1. ✅ Fixed `energyBefore` undefined bug causing false failures
2. ✅ Added proper JSON parsing error handling
3. ✅ CORS headers on all endpoints
4. ✅ Transaction status updates during processing
5. ✅ Draft save/load functionality
6. ✅ Removed batch mode (using multi-recipient instead)