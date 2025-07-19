# TronScan Deployment Guide for LegalNoticeNFT_Complete

## Contract Details

**Contract Name:** `LegalNoticeNFT_Complete`  
**Solidity Version:** `0.8.0`  
**License:** MIT

## Files Needed

1. **Source Code:** `/home/jesse/projects/NFTServiceApp/contracts/LegalNoticeNFT_Complete.sol`
2. **ABI:** `/home/jesse/projects/NFTServiceApp/contracts/LegalNoticeNFT_Complete.abi`
3. **Bytecode:** `/home/jesse/projects/NFTServiceApp/contracts/LegalNoticeNFT_Complete.bin`

## Deployment Steps on TronScan

1. Go to [Nile TronScan](https://nile.tronscan.org)
2. Connect your wallet (use the same wallet: `TDbeaZQ25WzZ4Aqn4RJAZxmo6BeHdMeXGf`)
3. Navigate to "Contracts" → "Deploy Contract"
4. Select "Upload Contract"
5. Fill in the details:
   - **Contract Name:** `LegalNoticeNFT_Complete`
   - **Compiler Version:** `0.8.0`
   - **Optimization:** Enabled (200 runs)
   - **License:** MIT License
6. Upload the `LegalNoticeNFT_Complete.sol` file
7. Set constructor parameters: None (empty constructor)
8. Set fee limit: 1500 TRX (1,500,000,000 SUN)
9. Deploy the contract

## Important Notes

- This is the COMPLETE version with all features:
  - Dynamic fee management (serviceFee, creationFee, sponsorshipFee)
  - Fee collector address management
  - 3-parameter setFeeExemption function
  - Unified notice tracking
  - Resource sponsorship system
  - All events for tracking
  
- The contract has NO constructor parameters
- Make sure you have enough TRX for deployment (at least 1500 TRX recommended)

## After Deployment

1. Copy the new contract address
2. Update the UI with: `CONTRACT_ADDRESS = 'YOUR_NEW_ADDRESS'`
3. The ABI is already updated in index.html
4. Test all functions to ensure proper deployment

## Key Functions to Test

- `serviceFee()` - should return 20000000 (20 TRX in SUN)
- `creationFee()` - should return 0
- `sponsorshipFee()` - should return 2000000 (2 TRX in SUN)
- `feeCollector()` - should return your admin address
- `SERVICE_FEE()` - should return same as serviceFee
- `totalNotices()` - should return 0
- `resourceSponsorshipEnabled()` - should return true