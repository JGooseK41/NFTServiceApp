# How to Verify the Current Contract on TronScan

## Contract Details
- **Contract Address**: `TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G`
- **Contract Name**: `LegalNoticeNFT_Complete_WithIPFS`
- **Network**: Nile Testnet

## Steps to Verify

1. **Visit the contract on TronScan**:
   https://nile.tronscan.org/#/contract/TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G

2. **Click "Contract" tab**, then click "Verify and Publish"

3. **Fill in the verification form**:
   - **Contract Name**: `LegalNoticeNFT_Complete_WithIPFS`
   - **Compiler Version**: `0.8.6` (or check the exact version in the source)
   - **Optimization**: `Yes`
   - **Runs**: `200`
   - **License**: `MIT`

4. **Upload the flattened source code**:
   - Use the file: `contracts/LegalNoticeNFT_Complete_WithIPFS_flattened.sol`
   - This file contains all dependencies in a single file

5. **Constructor Arguments** (if required):
   - The contract has no constructor arguments

## Alternative Method

If the flattened file doesn't work, you may need to:
1. Upload the main contract file: `contracts/LegalNoticeNFT_Complete_WithIPFS.sol`
2. Add each OpenZeppelin dependency file manually
3. Ensure all import paths match exactly

## Benefits of Verification

Once verified:
- NFTs will display properly in wallets
- Contract source code will be publicly viewable
- Users can interact with the contract directly on TronScan
- Increased trust and transparency

## Troubleshooting

If verification fails:
1. Check compiler version matches exactly
2. Ensure optimization settings match deployment
3. Try different optimization runs (200, 999, etc.)
4. Make sure all dependencies are included