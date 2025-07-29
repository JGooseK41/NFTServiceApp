# Exact Contract Verification Settings

## Contract to Verify
- **Address**: `TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G`
- **Network**: Nile Testnet

## EXACT Compiler Settings (from tronbox.js)
- **Compiler Version**: `v0.8.6+commit.11564f7e`
- **Optimization Enabled**: `Yes`
- **Runs**: `200`
- **EVM Version**: `istanbul`

## Steps:

1. Go to: https://nile.tronscan.org/#/contract/TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G/code

2. Click "Verify and Publish"

3. Fill in EXACTLY:
   - **Contract Name**: `LegalNoticeNFT_Complete_WithIPFS`
   - **Compiler Type**: `Single file`
   - **Compiler Version**: `v0.8.6+commit.11564f7e`
   - **Open Source License Type**: `MIT License (MIT)`
   
4. Under "Compiler Configuration":
   - **Optimization**: `Yes`
   - **Runs**: `200`
   - **Target EVM Version**: `istanbul`

5. Paste the contents of: `contracts/LegalNoticeNFT_Complete_WithIPFS_flattened.sol`

## Common Issues:

### If it fails with "bytecode doesn't match":

1. Try different compiler versions:
   - `v0.8.6+commit.11564f7e`
   - `v0.8.6`
   - `v0.8.0+commit.c7dfd78e`

2. Try different optimization runs:
   - `200` (most likely)
   - `999`
   - `1`

3. Try different EVM versions:
   - `istanbul` (from tronbox.js)
   - `berlin`
   - `london`

### Alternative approach:

If single file doesn't work, try "Multi-part files":
1. Upload main contract: `LegalNoticeNFT_Complete_WithIPFS.sol`
2. Add each dependency manually from node_modules/@openzeppelin/contracts/

## Note:
The key is matching the EXACT compiler settings used during deployment. Since we used tronbox with the settings in tronbox.js, these should work.