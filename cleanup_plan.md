# Contract Cleanup Plan

## Current Contract (KEEP)
- **Address**: TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G
- **Name**: LegalNoticeNFT_Complete_WithIPFS
- **Files to keep**:
  - contracts/LegalNoticeNFT_Complete.abi (current ABI in use)
  - contracts/LegalNoticeNFT_Complete.bin (current bytecode)
  - contracts/LegalNoticeNFT_Complete_WithIPFS.sol (source for reference)
  - deploy_complete_ipfs.js (deployment script)
  - deployment_complete_ipfs_nile.json (deployment info)

## Previous Contract (KEEP as backup)
- **Address**: TEZxBmj16pKdsJh3aDE9Y4RLSuXuBuUSp8
- **Name**: LegalNoticeNFT_Optimized
- **Files to keep**:
  - contracts/LegalNoticeNFT_Optimized.abi
  - deploy_optimized_enumerable.js
  - deployment_optimized_enumerable.json

## Files to DELETE:
### Old Contract Source Files:
- contracts/LegalNoticeNFT_Enhanced_Metadata.sol
- contracts/LegalNoticeNFT_Enumerable_Test.sol
- contracts/LegalNoticeNFT_Hybrid.sol
- contracts/LegalNoticeNFT_Hybrid.abi
- contracts/LegalNoticeNFT_Hybrid_Enumerable.sol
- contracts/LegalNoticeNFT_Hybrid_Minimal_Tracking.sol
- contracts/LegalNoticeNFT_Hybrid_TotalSupply.sol
- contracts/LegalNoticeNFT_Hybrid_WithTotalSupply.sol
- contracts/LegalNoticeNFT_Hybrid_flattened.sol
- contracts/LegalNoticeNFT_Optimized_NoViaIR.sol
- contracts/LegalNoticeNFT_Simplified.sol
- contracts/LegalNoticeNFT_Simplified_Restricted.sol
- contracts/LegalNoticeNFT_Simplified_Restricted_Optimized.sol
- contracts/LegalNoticeNFT_WithIPFS.sol
- contracts/LegalNoticeToken.sol
- contracts/out/LegalNoticeNFT_Hybrid_flat.sol

### Old Deployment Scripts:
- deploy-instructions.js
- deploy-viewgated-simple.js
- deploy_complete_contract.js
- deploy_contract.js
- deploy_hybrid.js
- deploy_optimized.js
- deploy_optimized_enumerable_v2.js
- deploy_restricted.js
- deploy_simplified.js
- scripts/deploy_complete_contract.js

### Old Deployment Info:
- deployment_complete.json
- deployment_complete_final.json
- deployment_hybrid.json
- deployment_optimized.json
- deployment_restricted.json
- deployments.json

### Other:
- deploy/ directory (if empty)