# Contract Version Summary

## v1 - Original Deployment (WITHOUT IPFS)
- **Address**: TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G
- **Status**: Deployed but NFTs not visible
- **Issue**: No IPFS metadata support, no image in tokenURI
- **Location**: `contracts/v1_without_ipfs/`

## v2 - Redeployment (WITHOUT IPFS) 
- **Address**: TTGvPTRmVqz23G3FqiWPg3hiu3mLPVcc6x
- **Status**: Deployed and verified but NFTs still not visible
- **Issue**: Accidentally deployed same contract as v1
- **Location**: `contracts/v2_without_ipfs/`

## v3 - IPFS Support (WITH IPFS) ✅
- **Address**: NOT YET DEPLOYED
- **Status**: Ready for deployment
- **Features**: 
  - IPFS metadata URI support in serveNotice function
  - Proper tokenURI with image field
  - Stores IPFS URIs on-chain
  - Fallback metadata with default images
- **Location**: `contracts/v3_with_ipfs/`
- **Files**:
  - `LegalNoticeNFT_v3.sol` - Basic v3 with IPFS
  - `LegalNoticeNFT_v3_flattened.sol` - Flattened basic v3
  - `LegalNoticeNFT_v3_Complete.sol` - Full UI-compatible version with all features
  - `LegalNoticeNFT_v3_Complete_flattened.sol` - For TronScan deployment (RECOMMENDED)

## Key Differences in v3:
1. **serveNotice** function accepts `metadataURI` parameter
2. **_tokenURIs** mapping stores IPFS URIs for each token
3. **tokenURI** returns stored IPFS URI or generates proper JSON with image
4. Default images included for visibility when IPFS not set

## Additional Features in v3 Complete:
1. **Role Member Tracking** - getRoleMemberCount(), getRoleMember()
2. **Fee Management** - updateServiceFee(), updateCreationFee(), updateSponsorshipFee()
3. **Emergency Controls** - pause(), unpause(), withdrawTRX()
4. **UI Compatibility** - alerts() function, getUserNotices()
5. **Fee Collector** - updateFeeCollector()
6. **Total Supply** - totalSupply() for batch operations

## v4 - Final Production Version ✅
- **Address**: NOT YET DEPLOYED
- **Status**: Ready for deployment
- **Features**:
  - All v3 features PLUS:
  - Batch serving (up to 10 recipients)
  - Server ID system (#1000+)
  - Service attempt tracking
  - Optimized to fit size limit
- **Location**: `contracts/v4_final/`
- **Files**:
  - `LegalNoticeNFT_v4_Final.sol` - Source code
  - `LegalNoticeNFT_v4_Final_flattened.sol` - For TronScan deployment

## Key Improvements by Version:
- **v1**: Basic functionality (no IPFS)
- **v2**: Same as v1 (deployment error)
- **v3**: Added IPFS metadata support
- **v4**: Added batch serving, server IDs, attempt tracking

## Deployment Instructions:
1. Use `LegalNoticeNFT_v4_Final_flattened.sol` on TronScan (RECOMMENDED)
2. Compiler: 0.8.6
3. Optimization: Enabled, 200 runs
4. License: MIT
5. Contract name: `LegalNoticeNFT_v4_Final`