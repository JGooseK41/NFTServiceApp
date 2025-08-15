# UI Function Call Fixes Needed

## Critical Issues Found

### 1. tokenOfOwnerByIndex - DOES NOT EXIST
**Used in:**
- Line 6610: Checking NFT ownership
- Line 14431: Getting user's tokens
- Line 14527: Batch operations
- Line 15553: Recipient checks

**Fix:** Remove these calls or implement alternative token tracking using events or localStorage

### 2. processServers - DOES NOT EXIST
**Used in:**
- Line 6950: Checking server info
- Line 9481: Role checks
- Line 9581: Server validation

**Fix:** Remove these calls. Process server role is managed via hasRole function only.

### 3. getNotice - WRONG FUNCTION NAME
**Used in:** Multiple places (lines 7189, 12192, 12248, etc.)

**Should use:**
- `notices(noticeId)` - For basic notice info
- `alertNotices(alertId)` - For alert details
- `getAlertDetails(alertId)` - For comprehensive alert info

## Functions that DO exist and work:
✅ balanceOf
✅ serviceFeeExemptions
✅ serviceFee
✅ creationFee
✅ sponsorshipFee
✅ grantRole
✅ hasRole
✅ setFeeExemption
✅ serveNotice

## Immediate Actions Needed:
1. Remove all tokenOfOwnerByIndex calls
2. Remove all processServers calls
3. Replace getNotice with correct function names
4. Test all functionality after fixes