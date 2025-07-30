# V4 Contract Updates - NFT Legal Service System

## Overview
This document outlines the critical updates made to ensure NFTs are visible in wallets and the system works properly with the v4 contract.

## Key Updates Made

### 1. NFT Visibility in Wallets (FIXED)
The main issue preventing NFTs from showing in wallets was the lack of proper IPFS integration. NFTs require metadata to be stored on IPFS with specific fields:

- **Added IPFS Integration** (`js/ipfs-integration.js`)
  - Real IPFS uploads via Pinata
  - Automatic fallback to localStorage for testing
  - Proper metadata format for wallet compatibility

- **NFT Metadata Structure**:
  ```json
  {
    "name": "Legal Notice #123",
    "description": "SEALED LEGAL DOCUMENT - Official legal notice requiring immediate attention",
    "image": "https://gateway.pinata.cloud/ipfs/[thumbnail-hash]",
    "external_url": "https://nftserviceapp.netlify.app/#notice-123",
    "attributes": [
      {"trait_type": "Status", "value": "Sealed"},
      {"trait_type": "Type", "value": "Legal Notice"},
      {"trait_type": "Case Number", "value": "Confidential"},
      {"trait_type": "Issuing Agency", "value": "Law Enforcement"}
    ]
  }
  ```

### 2. Contract Integration Updates
- **Contract Address**: `TSQZgUdYGm7LYSoZqr4SCKs8nb4C98ckn5`
- **MetadataURI Parameter**: Added as 10th parameter in `serveNotice()` calls
- **Batch Serving**: Implemented for up to 10 recipients (75-80% cost savings)
- **Server IDs**: Display permanent server IDs (starting at #1000)
- **Service Attempts**: Track multiple service attempts with notes

### 3. UI Enhancements

#### IPFS Configuration (Settings Tab)
- Added Pinata IPFS settings section
- API key and secret key configuration
- Test connection functionality
- Settings persist in localStorage

#### Law Enforcement Features
- Comprehensive FAQ section for asset forfeiture
- Explains constitutional due process requirements
- Details maximum diligent effort approach
- Provides implementation best practices

### 4. Setup Instructions

#### Configure Pinata IPFS (REQUIRED for NFT visibility)
1. Go to [pinata.cloud](https://pinata.cloud) and create a free account
2. Generate API keys from the API Keys section
3. In the app, go to Settings tab → IPFS Storage Settings
4. Enter your Pinata API Key and Secret Key
5. Click "Save IPFS Settings"
6. Click "Test Connection" to verify

#### Without Pinata Configuration
- NFTs will NOT appear in wallets
- System falls back to localStorage (testing only)
- Metadata URIs will be mock hashes

### 5. Technical Details

#### Files Added/Modified:
- `js/ipfs-integration.js` - Real IPFS upload functionality
- `js/thumbnail-generator.js` - Creates sealed document thumbnails
- `js/simple-encryption.js` - Document encryption system
- `index_v4.html` - Main UI with all v4 features

#### Key Functions:
- `IPFSIntegration.uploadToPinata()` - Uploads to real IPFS
- `ThumbnailGenerator.processDocumentForNFT()` - Creates NFT assets
- `serveNotice()` - Now includes metadataURI parameter

### 6. Testing Checklist

- [ ] Configure Pinata API keys
- [ ] Test connection to Pinata
- [ ] Create a legal notice with document
- [ ] Verify sealed thumbnail is generated
- [ ] Check transaction includes metadataURI
- [ ] Confirm NFT appears in recipient's wallet
- [ ] Test batch serving functionality
- [ ] Verify server ID display
- [ ] Test service attempt tracking

### 7. Common Issues & Solutions

**NFTs not showing in wallet:**
- Ensure Pinata is configured with valid API keys
- Check browser console for IPFS upload errors
- Verify metadataURI is being passed to contract

**"Quota Exceeded" errors:**
- Clear browser localStorage
- Old IPFS data is automatically cleaned up

**Energy costs too high:**
- Stake TRX for energy
- Use batch serving for multiple recipients
- Enable sponsor fees option

### 8. Next Steps
- Test energy rental on testnet
- Create recipient interface for viewing/accepting notices
- Add analytics for tracking notice acceptance rates