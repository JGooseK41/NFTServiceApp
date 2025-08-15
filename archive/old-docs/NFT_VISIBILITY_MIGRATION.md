# NFT Visibility Migration Plan

## Current Issue
NFTs are not showing up in wallet apps (TronLink, etc.) because:
1. Current contract uses data URIs instead of IPFS URIs for metadata
2. Missing required `image` field in metadata JSON
3. Wallet apps need proper IPFS-hosted metadata to display NFTs

## What We've Implemented
1. **Thumbnail Generator** (`js/thumbnail-generator.js`)
   - Creates sealed/confidential preview images
   - Generates proper NFT metadata JSON with all required fields
   - Uploads both thumbnail and metadata to IPFS

2. **Updated Contract** (`contracts/LegalNoticeNFT_WithIPFS.sol`)
   - Accepts metadata URI in the notice request
   - Sets proper IPFS URI as tokenURI

## Migration Steps

### Option 1: Deploy New Contract (Recommended)
1. Deploy `LegalNoticeNFT_WithIPFS.sol` to TRON
2. Update frontend to use new contract address
3. All new NFTs will be visible in wallets

### Option 2: Workaround with Current Contract
1. Create a metadata hosting service that:
   - Intercepts tokenURI calls
   - Returns proper IPFS metadata instead of data URIs
   - Maps notice IDs to IPFS metadata

### Option 3: Manual NFT Addition
1. Recipients can manually add the NFT contract to TronLink
2. Even then, without proper metadata, display will be limited

## Technical Details

### Current Metadata (Not Visible)
```json
data:application/json,{"name":"Legal Notice #123","description":"LEGAL NOTICE - ACTION REQUIRED | View at: https://nftserviceapp.netlify.app/#notice-123"}
```

### Required Metadata (Visible)
```json
{
  "name": "Legal Notice #123",
  "description": "SEALED LEGAL DOCUMENT - Action Required",
  "image": "ipfs://QmXXX...", // Sealed thumbnail
  "external_url": "https://nftserviceapp.netlify.app/#notice-123",
  "attributes": [...]
}
```

## Immediate Actions
1. Test thumbnail generation locally
2. Verify IPFS uploads work correctly
3. Plan contract migration timeline
4. Consider interim solutions for existing NFTs

## Benefits After Migration
- NFTs appear immediately in wallet collectibles
- Sealed thumbnail creates urgency without revealing content
- Proper metadata improves discoverability
- Standard-compliant implementation ensures compatibility