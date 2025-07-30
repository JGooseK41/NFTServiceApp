# V4 Directory Structure

This directory contains everything needed for the v4 contract implementation in one organized location.

```
v4/
│
├── Contract Files
│   ├── LegalNoticeNFT_v4_Final.sol          # Source code (for reference)
│   ├── LegalNoticeNFT_v4_Final_flattened.sol # For deployment (use this on TronScan)
│   └── LegalNoticeNFT_v4_Final.abi          # Contract ABI (used by UI)
│
├── UI Files
│   ├── index_v4.html                        # Complete UI with v4 features
│   └── config.js                            # Configuration file
│
├── JavaScript Dependencies
│   └── js/
│       ├── simple-encryption.js             # Encryption utilities
│       ├── thumbnail-generator.js           # NFT thumbnail generation
│       ├── documentConverter.js             # Document processing
│       └── simplified-integration.js        # Integration helpers
│
└── Documentation
    ├── README_V4.md                         # Comprehensive v4 documentation
    ├── CONTRACT_V4_INFO.json                # Contract deployment details
    ├── QUICK_REFERENCE_V4.md                # Quick function reference
    ├── DEPLOYMENT_GUIDE_V4.md               # Deployment instructions
    └── DIRECTORY_STRUCTURE.md               # This file
```

## Key Information

### Contract Address
`TSQZgUdYGm7LYSoZqr4SCKs8nb4C98ckn5`

### Main UI File
`index_v4.html` - This is the complete UI with all v4 features integrated

### Important Notes
1. All v4 dependencies are in this directory
2. The UI file has the correct contract address hardcoded
3. The ABI is embedded in the UI for easy deployment
4. JavaScript files are included for full functionality

## Usage
1. Open `index_v4.html` in a web browser
2. Connect TronLink wallet
3. All v4 features are ready to use:
   - IPFS metadata for NFT visibility
   - Batch serving (up to 10 recipients)
   - Server ID display
   - Service attempt tracking

## Why This Structure?
- **No Confusion**: Everything v4-related is in one place
- **Self-Contained**: Can deploy this directory anywhere
- **Version Clear**: No mixing with other contract versions
- **Easy Updates**: Just update files in this directory