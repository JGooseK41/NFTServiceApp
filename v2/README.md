# LegalNotice v2 - Clean Architecture

A complete rebuild of the LegalNotice NFT service with clean, modular architecture.

## Features

### Core Functionality
- **Multiple PDF Consolidation**: Upload multiple PDFs that get merged into one document
- **Alert NFT Generation**: Creates Base64-encoded thumbnail as Alert NFT for maximum visibility
- **Document Encryption**: Optional encryption for sensitive documents
- **IPFS Storage**: Full documents stored on IPFS with metadata
- **Admin Dashboard**: Complete contract management interface
- **Energy Management**: Built-in energy rental integration

### Key Improvements from v1
- Clean modular architecture (10 focused modules vs 166 scattered files)
- Single consolidated document workflow
- Base64 thumbnail embedded directly in NFT metadata
- Clear separation of concerns
- No circular dependencies or stack overflow issues

## Quick Start

1. Open `v2/index.html` in a web browser
2. Connect your TronLink wallet
3. For admin functions, wallet must be contract owner

## Architecture

### Modules
- **wallet.js**: TronLink connection and transactions
- **contract.js**: Smart contract interactions and admin functions
- **documents.js**: PDF processing, consolidation, and thumbnail generation
- **notices.js**: Complete notice creation workflow
- **admin.js**: Contract administration interface
- **storage.js**: Local and backend data persistence
- **energy.js**: Energy rental and monitoring
- **cases.js**: Case management system
- **receipts.js**: Receipt generation and viewing

### File Structure
```
v2/
├── index.html           # Main application
├── js/
│   ├── config.js       # Configuration
│   ├── app.js          # Main controller
│   └── modules/        # Feature modules
├── css/
│   └── main.css        # Styling
└── backend/            # API endpoints (uses existing backend)
```

## Workflow

### Creating an Alert NFT with Documents

1. **Upload Multiple PDFs**: Select all PDFs to include
2. **Automatic Processing**:
   - PDFs are consolidated into single document
   - First page becomes Base64 thumbnail
   - Document optionally encrypted
   - Upload to IPFS
3. **Alert NFT Creation**:
   - Thumbnail embedded as Base64 in metadata
   - Access instructions included
   - Links to blockserved.com for full document
4. **Receipt Generation**: Court-ready proof of service

### Admin Functions

- Update service fees
- Grant/revoke roles
- View statistics
- Manage server registrations

## Configuration

Edit `js/config.js` to customize:
- Network settings (mainnet/testnet)
- Backend URLs
- IPFS gateways
- Energy rental providers
- Feature flags

## Integration with Existing System

This v2 app is designed to work alongside your existing system:
- Uses same smart contract
- Compatible with existing backend
- Preserves all data
- Can run in parallel with v1

## Contract Details

- **Contract**: LegalNoticeNFT v5 Enumerable
- **Address**: `TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN`
- **Network**: TRON Mainnet
- **Features**: TRC721 Enumerable, IPFS support, Batch serving, Server ID system

## Testing

1. Connect wallet (must be contract admin for admin functions)
2. Test complete workflow:
   - Multiple PDF upload
   - Alert NFT creation
   - Document viewing at blockserved.com
   - Admin functions

## Benefits of v2 Architecture

1. **Maintainability**: Clean separation of concerns
2. **Performance**: No circular dependencies or stack issues
3. **Reliability**: Proper error handling throughout
4. **Extensibility**: Easy to add new features
5. **Debugging**: Clear module boundaries

## Migration Path

1. Run v2 alongside v1 initially
2. Test all workflows
3. Gradually migrate users
4. Keep v1 as backup/reference