# NFT Visibility Fix Required

## Problem Identified:
The NFTs are being minted successfully, but they're not visible in wallets because:

1. **No Image in Metadata** - The tokenURI function returns JSON without an "image" field
2. **Data URI Instead of IPFS** - Wallets prefer IPFS URLs over data URIs
3. **No Base64 Encoding** - The _encodeBase64 function just returns the data as-is

## Current tokenURI Output:
```json
{
  "name": "Summons #1",
  "description": "Agency - Case123",
  "attributes": [...]
  // MISSING: "image": "ipfs://..."
}
```

## Solutions:

### Option 1: Deploy Contract v3 with Fixed Metadata
Create a new contract that:
- Stores IPFS metadata URLs during minting
- Returns proper tokenURI with image field
- Uses the IPFS hash from the notice creation

### Option 2: External Metadata Service
- Deploy a metadata service that serves proper JSON
- Update contract to point to this service
- Include image generation for each NFT

### Option 3: Use the IPFS Data Already Being Stored
The UI is already uploading metadata to IPFS when creating notices. We need to:
1. Store this IPFS hash in the contract
2. Return it in tokenURI

## Immediate Workaround:
The NFTs exist on-chain but won't show in wallets until metadata is fixed. You can still:
- See them on TronScan under the contract
- Query ownership via contract calls
- Transfer them programmatically

## Recommended Action:
Deploy v3 with proper metadata support that includes:
```json
{
  "name": "Legal Notice #1",
  "description": "...",
  "image": "ipfs://QmXxx...", // Required for visibility!
  "attributes": [...]
}
```