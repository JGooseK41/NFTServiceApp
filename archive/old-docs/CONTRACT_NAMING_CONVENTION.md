# Contract Naming Convention

## Standard Format
`LegalNoticeNFT_v{VERSION}`

## Examples:
- `LegalNoticeNFT_v1` - First version
- `LegalNoticeNFT_v2` - Second version with IPFS support
- `LegalNoticeNFT_v3` - Third version with additional features

## File Structure:
```
contracts/
├── LegalNoticeNFT_v1.sol         # Source code
├── LegalNoticeNFT_v1.abi         # ABI file
├── LegalNoticeNFT_v1.bin         # Bytecode
└── LegalNoticeNFT_v1_flattened.sol  # For verification

deployments/
├── deployment_v1_nile.json       # Testnet deployment
└── deployment_v1_mainnet.json    # Mainnet deployment

deploy_scripts/
└── deploy_v1.js                  # Deployment script
```

## Benefits:
1. **Clear versioning** - Easy to track which contract is deployed
2. **No confusion** - Contract name in code matches deployment info
3. **Easy verification** - TronScan verification uses exact contract name
4. **Better tracking** - Can see evolution of contracts over time

## Current Situation:
- **Deployed Contract**: `LegalNoticeNFT_Complete` (should be v1)
- **Address**: `TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G`
- **Issue**: Deployment info says "WithIPFS" but actual contract is without

## Going Forward:
1. Next deployment should be `LegalNoticeNFT_v2`
2. Keep all file names consistent with version number
3. Document changes between versions in CHANGELOG.md
4. Never reuse version numbers

## Version History Template:
```markdown
## v2 (Date)
- Added: IPFS metadata support
- Fixed: NFT visibility in wallets
- Changed: Token URI implementation

## v1 (2025-07-29)
- Initial deployment
- Basic legal notice NFT functionality
- Complete ERC721 implementation
```