# UI Fixes Required for Optimized Contract

## Summary of Removed Functionality

### Functions Removed (No UI Impact):
1. **`withdraw()`** - Redundant with `withdrawTRX()`
2. **`getUserNotices()`** - UI uses `getRecipientNotices()` directly
3. **`getServerNotices()`** - UI uses `getSenderNotices()` directly  
4. **`getNoticesByStatus()`** - Filtering done client-side
5. **`getNoticesByDateRange()`** - Not used by UI
6. **`getServerStats()`** - Not used by UI
7. **`removeProcessServer()` & `addProcessServer()`** - UI uses role management directly
8. **`updateFee()`** - UI uses specific fee update functions
9. **Process server discount** - Not used by UI

### Functions Removed (UI Impact - Already Fixed):
1. **`documentNoticeFee`** → Changed to use `serviceFee`
2. **`getRecipientAlerts()`** → Changed to use `getRecipientNotices()`

### Functions Removed (UI Impact - Need Manual Fix):
1. **`alerts()` mapping** - Used for getting preview images
   - Lines: 5162, 7545, 7731, 8076
   - These calls try to get `previewImage` which doesn't exist in the new contract
   - **Recommendation**: Remove these preview image sections or replace with `getNoticeInfo()`

## Code Changes Already Applied:

```javascript
// Line 5049 - Fixed
const docFeeRaw = await legalContract.serviceFee().call();

// Line 7627 - Fixed  
const alerts = await legalContract.getRecipientNotices(tronWeb.defaultAddress.base58).call();
```

## Remaining Manual Fixes Needed:

### 1. Remove Preview Image Code (lines 5160-5169)
The alerts() function was used to get preview images, but this feature doesn't exist in the optimized contract.

```javascript
// Remove or comment out:
try {
    const alert = await legalContract.alerts(details.alertTokenId).call();
    if (alert.previewImage) {
        document.getElementById('acceptPreviewImage').src = `data:image/jpeg;base64,${alert.previewImage}`;
        document.getElementById('acceptPreview').style.display = 'block';
    }
} catch (e) {
    console.log('No preview available');
}
```

### 2. Update Notice Display Logic
Replace `alerts()` calls with `getNoticeInfo()` where needed:

```javascript
// Instead of:
const alert = await legalContract.alerts(alertId).call();

// Use:
const noticeInfo = await legalContract.getNoticeInfo(noticeId).call();
```

## Features That Continue to Work:
- All core notice creation (text and document)
- Notice acceptance
- Fee management
- Role management  
- Process server registration
- Law enforcement exemptions
- Batch operations (through consolidated function)
- Notice querying and display

## Features Lost:
- Preview images in alerts (wasn't implemented anyway)
- Date range filtering (can be done client-side)
- Server statistics aggregation (can be calculated client-side)
- Notice status filtering (can be done client-side)

## Overall Impact:
**Minimal** - The optimization primarily removed redundant functions and features that weren't actively used. All core functionality remains intact.