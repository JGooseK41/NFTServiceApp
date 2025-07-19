# UI Updates for LegalNoticeNFT_Complete Contract

## Critical Updates Required

### 1. Update Contract Address
After deploying the new contract, update these locations in `index.html`:
- Line 2315: Update the value in the contract address input field
- Line 2319: Update the TronScan link
- Line 3968: Update the contractAddress in TRON_NETWORKS.nile

### 2. Update Contract ABI
Replace the entire CONTRACT_ABI with the contents of `contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi`

### 3. Function Call Updates

#### Fee-related updates:
- `legalContract.creationFee()` → Keep as is (now supported)
- `legalContract.feeExemptions(address)` → Remove, use `serviceFeeExemptions` and `fullFeeExemptions`
- Fee calculation: Now supports dynamic fees with `serviceFee`, `creationFee`, and `sponsorshipFee`

#### Notice tracking:
- `legalContract.getUserAlerts()` → `legalContract.getRecipientAlerts()` (already fixed)
- NEW: Can use `legalContract.getServerNotices(address)` to get notices by server
- `legalContract.alerts(id)` now returns the full alert data with previewImage field

#### Admin functions:
- `updateFee()` → Now updates service fee
- NEW: `updateServiceFee()`, `updateCreationFee()`, `updateSponsorshipFee()`
- NEW: `updateFeeCollector()` to change where fees go
- `setFeeExemption()` now takes two booleans: serviceFeeExempt and fullFeeExempt

### 4. Event Handling Updates

Add listeners for new events:
```javascript
// New events to listen for
legalContract.LegalNoticeCreated().watch((err, event) => {
    if (!err) {
        console.log('Legal notice created:', event.result);
        // Update UI accordingly
    }
});

legalContract.FeeUpdated().watch((err, event) => {
    if (!err) {
        console.log('Fee updated:', event.result);
        // Refresh fee displays
    }
});

legalContract.FeeCollectorUpdated().watch((err, event) => {
    if (!err) {
        console.log('Fee collector updated:', event.result);
    }
});
```

### 5. Fee Display Updates

Update fee calculations to use the new dynamic fee structure:

```javascript
async function calculateTotalFee(userAddress, sponsorFees = false) {
    const serviceFee = await legalContract.serviceFee().call();
    const creationFee = await legalContract.creationFee().call();
    const sponsorshipFee = await legalContract.sponsorshipFee().call();
    
    // Check exemptions
    const isServiceExempt = await legalContract.serviceFeeExemptions(userAddress).call();
    const isFullExempt = await legalContract.fullFeeExemptions(userAddress).call();
    
    let totalFee = creationFee;
    
    if (isFullExempt) {
        // Only pay creation fee
    } else if (isServiceExempt) {
        totalFee = totalFee.add(serviceFee.div(2)); // 50% discount
    } else {
        totalFee = totalFee.add(serviceFee); // Full service fee
    }
    
    if (sponsorFees) {
        totalFee = totalFee.add(sponsorshipFee);
    }
    
    return totalFee;
}
```

### 6. Remove Non-Functional UI Elements

Remove or update these elements that don't exist in the old contract:
- Dynamic fee update forms (unless using new contract)
- Fee collector update (unless using new contract)
- Sponsorship fee updates (unless using new contract)

### 7. Backwards Compatibility

The new contract maintains compatibility with these existing functions:
- `serveNotice()` - Main function remains the same
- `acceptNotice()` - Works as before
- `viewDocument()` - Enhanced but backwards compatible
- `getRecipientAlerts()` - Same functionality
- `SERVICE_FEE()` - Now returns dynamic value instead of constant

### 8. New Features to Add (Optional)

1. **Server Notice Tracking**: Add UI to show all notices served by a process server
2. **Fee Management Panel**: Add controls for updating different fee types
3. **Fee Collector Management**: Add UI to update fee collector address
4. **Enhanced Alert Display**: Use the previewImage field from alerts

## Testing Checklist

After updates:
1. [ ] Test creating a notice with regular fees
2. [ ] Test creating a notice with fee exemptions
3. [ ] Test creating a notice with sponsorship
4. [ ] Verify alert displays correctly
5. [ ] Test accepting/acknowledging notices
6. [ ] Test viewing documents
7. [ ] Test admin functions (fee updates, role management)
8. [ ] Verify event listeners work correctly
9. [ ] Check fee calculations are accurate
10. [ ] Test withdrawal functions