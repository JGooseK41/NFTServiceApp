# Contract Verification Guide for Tronscan

## Contract Details
- **Address**: TXyXo57jpquJM4cTkVBw6uUJxrxon2gQP8
- **Network**: Nile Testnet
- **Contract Name**: LegalNoticeNFT_Hybrid

## Compiler Settings Used During Deployment
Based on the compile_hybrid.js script, these are the EXACT settings used:

1. **Compiler Version**: 0.8.20 or higher (check available versions on Tronscan)
2. **Optimization**: Enabled
3. **Optimizer Runs**: 10 (NOT 200!)
4. **Via IR**: Yes (if available in Tronscan's interface)

## Steps to Verify

1. Go to: https://nile.tronscan.org/#/contract/TXyXo57jpquJM4cTkVBw6uUJxrxon2gQP8/code

2. Click "Verify and Publish"

3. Enter these settings:
   - **Contract Address**: TXyXo57jpquJM4cTkVBw6uUJxrxon2gQP8
   - **Contract Name**: LegalNoticeNFT_Hybrid
   - **Compiler Type**: Solidity (Single file)
   - **Compiler Version**: v0.8.20+commit.a1b79de6 (or closest available)
   - **Open Source License Type**: MIT
   
4. Optimization Settings:
   - **Optimization**: Yes
   - **Optimization Runs**: 10
   - **Via IR**: Yes (if available)

5. Upload the flattened source code from: `LegalNoticeNFT_Hybrid_flattened.sol`

## Common Issues

If verification fails with "Please confirm the correct parameters":

1. **Wrong optimizer runs**: We used 10, not the default 200
2. **Missing Via IR**: The contract was compiled with Via IR enabled
3. **Wrong compiler version**: Try different 0.8.x versions if 0.8.20 isn't available
4. **Source code mismatch**: Make sure you're using the flattened file

## Alternative: Try Without Via IR

If Tronscan doesn't support Via IR, try recompiling without it:
1. Edit compile_hybrid.js and set `viaIR: false`
2. Recompile the contract
3. Deploy the new version
4. Verify with the new bytecode