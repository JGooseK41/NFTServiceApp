# Hybrid Contract UI Changes

## Contract Address
- **Network**: TRON Nile Testnet
- **Address**: TXyXo57jpquJM4cTkVBw6uUJxrxon2gQP8

## Key Changes

### 1. Enhanced Metadata
Recipients now see full legal notice details directly in their wallets:
- Notice type and case number
- Clear action required text
- Instructions to call acceptNotice() for documents

### 2. Batch Operations
The hybrid contract supports batch operations for up to 20 recipients at once.

### 3. Limitations

#### Process Server Registration
- Server IDs are auto-assigned when PROCESS_SERVER_ROLE is granted
- Process servers cannot update their name/agency on-chain after registration
- Registration data is saved locally for record-keeping

#### Removed Functions
- `registerProcessServer()` - Not available in hybrid contract
- `setProcessServerStatus()` - Cannot toggle server active/inactive status
- `pause()` and `unpause()` - Replaced with single `setPaused(bool)`

## UI Adaptations

1. **Registration Modal**: Added notice about limitations
2. **Local Storage**: Registration data saved locally since on-chain updates aren't supported
3. **Wallet Status**: Shows server ID but name/agency from local storage only

## Benefits

Despite the limitations, the hybrid contract provides:
- ✅ Full notice visibility in recipient wallets (priority #1)
- ✅ Batch operations for efficiency
- ✅ All core functionality intact
- ✅ Under 24KB size limit for mainnet deployment
