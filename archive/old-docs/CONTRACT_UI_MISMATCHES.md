# Contract-UI Function Mismatches

## Critical Issues Found

### 1. Missing Functions in Contract

The UI calls these functions that don't exist in the simplified contract:

#### a) `totalNotices()`
- **UI Usage**: Line 6810 - Used to get sequential notice numbers
- **Fix Needed**: Use `_noticeIdCounter.current()` internally or add a view function

#### b) `getUserNotices(address user)`
- **UI Usage**: Line 7567 - Gets all notices for a user
- **Fix Needed**: This should probably call `getRecipientNotices(address)`

#### c) `getServerNotices(address server)`
- **UI Usage**: Line 7893 - Gets notices created by a server
- **Fix Needed**: This should call `getSenderNotices(address)`

#### d) `resourceSponsorshipEnabled()`
- **UI Usage**: Line 8461 - Checks if sponsorship is enabled
- **Fix Needed**: Remove from UI (not in simplified contract)

#### e) `setResourceSponsorship(bool enabled)`
- **UI Usage**: Line 8476 - Enables/disables sponsorship
- **Fix Needed**: Remove from UI (not in simplified contract)

#### f) `updateFee(uint256 newFee)`
- **UI Usage**: Line 8379 - Updates general fee
- **Fix Needed**: Should call `updateServiceFee(uint256)`

### 2. Function Name Mismatches

#### Document Creation
- **Contract Has**: 
  - `createDocumentNotice(...)` 
  - `createTextNotice(...)`
- **UI Expects**: These are correct ✓

#### Notice Acceptance
- **Contract Has**: `acceptNotice(uint256 noticeId)`
- **UI Also Calls**: `acknowledgeAlert(uint256 alertId)` (legacy)
- **Status**: Contract has backward compatibility ✓

### 3. Legacy Functions Still Called

The UI still references old dual-NFT system functions:
- `alerts()` - Returns legacy format ✓ (backward compatible)
- `alertNotices()` - Returns legacy format ✓ (backward compatible)
- `getAlertDetails()` - Returns legacy format ✓ (backward compatible)
- `recipientAlerts()` - Returns recipient notices ✓ (backward compatible)

### 4. Parameter Mismatches

#### Fee Exemption
- **UI Calls**: `setFeeExemption(address, bool, bool)`
- **Better Option**: `setLawEnforcementExemption(address, string)` for law enforcement

## Recommended Fixes

### Contract Additions Needed

```solidity
// Add to contract:
function totalNotices() external view returns (uint256) {
    return _noticeIdCounter.current() - 1; // Minus 1 because counter starts at 1
}

// These aliases would help:
function getUserNotices(address user) external view returns (uint256[] memory) {
    return getRecipientNotices(user);
}

function getServerNotices(address server) external view returns (uint256[] memory) {
    return getSenderNotices(server);
}
```

### UI Fixes Needed

```javascript
// Replace these calls:

// 1. Replace updateFee with updateServiceFee
await legalContract.updateServiceFee(feeInSun).send({...});

// 2. Remove resource sponsorship UI elements
// Remove lines 8461-8485 (resource sponsorship toggle)

// 3. Fix getUserNotices/getServerNotices
// Replace with getRecipientNotices/getSenderNotices

// 4. For totalNotices, we can use the notice counter
// Or track locally after each creation
```

## Functions That Work Correctly

✓ `createDocumentNotice()`
✓ `createTextNotice()` 
✓ `acceptNotice()`
✓ `grantRole()`
✓ `hasRole()`
✓ `calculateFee()`
✓ `setLawEnforcementExemption()`
✓ `lawEnforcementExemptions()`
✓ `lawEnforcementAgencies()`
✓ All fee update functions
✓ All backward compatibility functions

## Summary

Most critical functions work correctly. Main issues are:
1. Missing `totalNotices()` counter function
2. Different names for get notices functions  
3. Resource sponsorship UI needs removal
4. Minor function name differences

The contract maintains good backward compatibility for the legacy alert system.