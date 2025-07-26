# Frontend vs Contract Audit Report

## Key Findings

### 1. **Function Name Mismatch** ❌
**Frontend calls:** `serveNotice()`
**Contract has:** 
- `createDocumentNotice()` (for Document Images)
- `createTextNotice()` (for Text Only)
- `serveNotice()` exists but is a legacy wrapper

**Issue:** Frontend is using the legacy function instead of the new simplified functions.

### 2. **Parameter Mismatch** ❌

**Frontend `serveNotice()` sends:**
```javascript
serveNotice(
    recipient,          // ✓ address
    encryptedIPFS,      // ✓ string
    decryptKey,         // ✓ string
    issuingAgency,      // ✓ string
    noticeType,         // ✓ string
    caseNumber,         // ✓ string
    noticeText,         // ✓ string (used as caseDetails)
    legalRights,        // ✓ string (not used in simplified)
    sponsorFees         // ✓ bool
)
```

**Contract `createDocumentNotice()` expects:**
```solidity
createDocumentNotice(
    recipient,          // address
    encryptedIPFS,      // string
    encryptionKey,      // string
    publicText,         // string (noticeText should map here)
    noticeType,         // string
    caseNumber,         // string
    issuingAgency,      // string
    baseTokenName       // string (missing from frontend!)
)
```

### 3. **Missing Parameters** ❌
- Frontend doesn't send `baseTokenName` (required by new functions)
- Frontend sends `legalRights` which contract doesn't use
- Frontend's `sponsorFees` boolean is handled differently in contract

### 4. **Fee Calculation Issues** ⚠️
- Frontend uses `calculateFee()` - ✓ This exists
- But sponsorship logic is different in simplified contract
- Contract expects exact fee amount, not a sponsorship boolean

### 5. **Accept Notice Function** ✓
- Frontend calls `acceptNotice(noticeId)` - Correct!
- Contract returns decryption key immediately - Matches!

### 6. **Get Alerts/Notices** ✓
- Frontend calls `getRecipientAlerts()` - Exists via compatibility layer
- Frontend uses `alerts()` mapping - Exists via compatibility layer

### 7. **Missing Contract Functions in Frontend ABI** ❌
The frontend ABI is missing these new functions:
- `createDocumentNotice()`
- `createTextNotice()`
- `getNoticeInfo()`
- `getDocument()`
- All the new admin events

### 8. **Document Viewing** ⚠️
- Frontend expects `viewDocument(documentId)`
- Contract has `getDocument(noticeId)` but also provides `viewDocument()` wrapper

## Recommendations

### Option 1: Update Frontend (Recommended)
Update the frontend to use the new simplified functions:
1. Replace `serveNotice()` calls with:
   - `createDocumentNotice()` for Document Images
   - `createTextNotice()` for Text Only
2. Add `baseTokenName` parameter (can use `noticeType + "-" + caseNumber`)
3. Update ABI with new functions
4. Remove unused `legalRights` parameter

### Option 2: Keep Using Legacy Function
The `serveNotice()` wrapper exists and should work, but:
- Less efficient (extra function call)
- Missing some new features
- Not using the simplified design benefits

### Option 3: Update Contract (Not Recommended)
We could modify the contract to match frontend exactly, but this would:
- Remove the benefits of the simplified design
- Add back complexity we removed
- Require re-deployment

## Critical Issues to Fix

1. **Token Name Parameter**
   - Frontend must provide `baseTokenName`
   - Suggest: Use `${noticeType}-${caseNumber}`

2. **Fee/Sponsorship Logic**
   - Frontend's sponsorship boolean doesn't match contract logic
   - Need to clarify how sponsorship should work

3. **ABI Update**
   - Frontend ABI must be regenerated from new contract
   - Missing many functions and events

## Questions for User

1. Should we update the frontend to use the new simplified functions, or continue using the legacy `serveNotice()` wrapper?

2. For the token name, should we:
   - Auto-generate from notice type + case number?
   - Add a new field in the UI?
   - Use a fixed format?

3. How should sponsorship work:
   - Keep the current boolean approach?
   - Let users specify exact sponsorship amount?
   - Remove sponsorship feature?