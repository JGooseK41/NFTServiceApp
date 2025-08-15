# V3 Deployment Checklist

## Pre-Deployment
- [x] Create v3 contract with IPFS support
- [x] Add metadataURI parameter to serveNotice
- [x] Implement proper tokenURI with image support
- [x] Create flattened version for TronScan
- [x] Organize contracts into version folders
- [x] Audit v3 against UI expectations
- [x] Add all missing UI functions (Complete version)
- [x] Create flattened Complete version

## TronScan Deployment Steps

### 1. Go to TronScan Deploy Page
- Nile: https://nile.tronscan.org/#/contracts/deploy
- Choose "Upload Contract Files"

### 2. Upload Contract
- File: `contracts/v3_with_ipfs/LegalNoticeNFT_v3_Complete_flattened.sol`
- Contract Name: `LegalNoticeNFT_v3_Complete`

### 3. Compiler Settings
- Compiler Version: `0.8.6`
- Optimization: `Enabled`
- Runs: `200`
- License: `MIT`

### 4. Deploy
- Review gas costs
- Confirm deployment
- Save transaction hash

## Post-Deployment

### 1. Verify Contract
- Should verify automatically since deployed through TronScan
- Contract will be verified immediately

### 2. Update UI (index.html)
- [ ] Update contract address to v3 address
- [ ] Add metadataURI parameter to serveNotice call (see UI_UPDATE_FOR_V3.md)
- [ ] Test with a real notice

### 3. Update Documentation
- [ ] Update deployment_v3_nile.json with new address
- [ ] Update CONTRACT_VERSIONS.md with deployed address
- [ ] Commit and push to GitHub

## Expected Result
- NFTs will have proper metadata with images
- NFTs will be visible in TronLink and other wallets
- Metadata will be stored on IPFS
- Contract will be verified on TronScan

## Important Notes
1. This is the CORRECT contract with IPFS support
2. The serveNotice function now accepts metadataURI
3. Default images are included for fallback
4. Make sure to update the UI to pass metadataURI!
5. Using the Complete version ensures all UI functions work without errors
6. Complete version includes:
   - Role member tracking for admin panel
   - Fee update functions
   - Contract pausability
   - Emergency withdrawal
   - UI compatibility functions (alerts, getUserNotices)