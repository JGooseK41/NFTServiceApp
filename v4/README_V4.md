# LegalNoticeNFT v4 - Complete Package

## Overview
This directory contains all v4-specific files to avoid version confusion. Everything needed to work with the v4 contract is here.

## Contract Information
- **Contract Address**: TSQZgUdYGm7LYSoZqr4SCKs8nb4C98ckn5
- **Network**: TRON (Mainnet/Testnet)
- **Compiler**: Solidity 0.8.6
- **Size**: 24,542 bytes (99.9% of limit)

## Directory Contents

### Contract Files
- `LegalNoticeNFT_v4_Final.sol` - Source code
- `LegalNoticeNFT_v4_Final_flattened.sol` - For TronScan deployment
- `LegalNoticeNFT_v4_Final.abi` - Contract ABI for UI integration

### UI Files
- `index_v4.html` - Complete UI updated for v4 contract
- All UI components are integrated in this single file for simplicity

### Supporting Files
- `CONTRACT_V4_INFO.json` - Contract deployment details and configuration

## v4 Key Features

### 1. IPFS Metadata Support
- NFTs visible in wallets with custom thumbnails
- `metadataURI` parameter in serveNotice function
- Proper tokenURI implementation with image field

### 2. Batch Serving (75-80% Cost Savings)
```solidity
serveNoticeBatch(BatchNotice[] memory batchNotices)
```
- Serve up to 10 notices in one transaction
- Significant gas savings for bulk operations

### 3. Server ID System
- Permanent IDs starting at #1000
- Automatic assignment when role granted
- `getServerId(address)` returns server's unique ID

### 4. Service Attempt Tracking
```solidity
recordServiceAttempt(uint256 noticeId, string memory note)
```
- Document failed delivery attempts
- Legal compliance for service of process
- Track attempt count and notes

## UI Integration Points

### Key Contract Functions Used
1. `serveNotice()` - 10 parameters including metadataURI
2. `serveNoticeBatch()` - For bulk operations
3. `getServerId()` - Display server IDs
4. `recordServiceAttempt()` - Track service attempts
5. `serviceAttempts()` - Get attempt count
6. `lastAttemptNote()` - Get last attempt details

### Important UI Updates
- All serveNotice calls include metadataURI parameter
- Batch mode uses serveNoticeBatch for efficiency
- Server ID displayed in wallet status
- Service attempts shown in audit view

## Quick Start

1. **Deploy Contract** (if not already deployed)
   - Use `LegalNoticeNFT_v4_Final_flattened.sol` on TronScan
   - Contract address: TSQZgUdYGm7LYSoZqr4SCKs8nb4C98ckn5

2. **Use the UI**
   - Open `index_v4.html` in a web browser
   - Connect TronLink wallet
   - All v4 features are integrated

3. **Key Parameters**
   - Service Fee: 20 TRX
   - Creation Fee: 5 TRX  
   - Sponsorship Fee: 2 TRX
   - Batch limit: 10 recipients

## Migration Notes
- v4 maintains backward compatibility
- Existing UI functions work without modification
- New features are additive only

## Contract ABI Reference
The complete ABI is in `LegalNoticeNFT_v4_Final.abi` and embedded in `index_v4.html`

Key new functions in v4:
- `serveNoticeBatch(tuple[])` 
- `getServerId(address)`
- `recordServiceAttempt(uint256,string)`
- `serverIds(address)`
- `serviceAttempts(uint256)`
- `lastAttemptNote(uint256)`