# LegalNoticeNFT v4 Final - Production Contract

## Overview
This is the final production version of the Legal Notice NFT contract with all features optimized to fit within TRON's contract size limits.

## Key Features

### Core Functionality
- ✅ **IPFS Metadata Support** - NFTs visible in wallets with custom thumbnails
- ✅ **Batch Serving** - Serve up to 10 notices in one transaction (75-80% cost savings)
- ✅ **Server ID System** - Permanent IDs (#1000+) for professional tracking
- ✅ **Service Attempt Tracking** - Document failed delivery attempts for legal compliance
- ✅ **Full UI Compatibility** - All functions expected by the current UI

### Contract Details
- **Size**: 24,542 bytes (99.9% of 24KB limit)
- **Remaining Space**: 34 bytes
- **Compiler**: Solidity 0.8.6
- **Optimization**: Enabled (200 runs)

## Deployment Instructions

### For TronScan Deployment:
1. Navigate to: https://nile.tronscan.org/#/contracts/deploy
2. Choose "Upload Contract Files"
3. Upload: `LegalNoticeNFT_v4_Final_flattened.sol`
4. Settings:
   - Contract Name: `LegalNoticeNFT_v4_Final`
   - Compiler: `0.8.6`
   - Optimization: `Enabled`
   - Runs: `200`
   - License: `MIT`
5. Deploy and save the contract address

### Post-Deployment:
1. Update `index.html` with new contract address
2. Ensure UI passes `metadataURI` parameter in serveNotice calls
3. Test NFT visibility in TronLink

## V4 Specific Features

### 1. Batch Serving
```solidity
// Serve multiple notices in one transaction
BatchNotice[] memory notices = new BatchNotice[](3);
// ... populate notices
serveNoticeBatch(notices);
```

### 2. Server IDs
```solidity
// Automatic ID assignment when role granted
grantRole(PROCESS_SERVER_ROLE, serverAddress);
// Server gets ID like #1001, #1002, etc.
uint256 id = getServerId(serverAddress);
```

### 3. Service Attempts
```solidity
// Record failed delivery attempts
recordServiceAttempt(noticeId, "No one at residence - 2nd attempt");
// Check attempts: serviceAttempts[noticeId]
```

## Cost Comparison

### Single Notice:
- Gas + Base Fee: ~25-27 TRX

### Batch (10 notices):
- Without Batch: 10 × 27 = 270 TRX
- With Batch: ~50-70 TRX
- **Savings: 200 TRX (75%)**

## Migration Notes
- V4 maintains full backward compatibility
- All existing UI functions work without modification
- New features (batch, attempts) are additive only

## Support
For issues or questions about v4 deployment, refer to the main project documentation.