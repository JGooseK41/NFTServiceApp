# Legal Service NFT Platform

A blockchain-based legal document service platform that enables law enforcement to serve legal documents as NFTs with verifiable proof of delivery.

## Features

- 📄 **Document Conversion**: Supports PDF, Word, and image files
- 🔐 **Dual NFT System**: Preview NFT for wallets + Full document NFT upon acceptance
- 🌐 **Multi-chain Support**: TRON, Ethereum, Polygon, and BSC
- ✅ **Proof of Service**: Blockchain-verified delivery and acceptance
- 🖼️ **Readable Previews**: High-quality document previews visible in any wallet

## Live Demo

- Testnet: [Your Netlify URL]
- Contract: [TKNNQhLqwE2k9botmQs2LuC3msno8YkLfY](https://nile.tronscan.org/#/contract/TKNNQhLqwE2k9botmQs2LuC3msno8YkLfY)

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Blockchain**: TRON (TRC-721), Web3.js for EVM chains
- **Storage**: IPFS via Pinata
- **Document Processing**: PDF.js, Mammoth.js, html2canvas

## Setup

1. Clone the repository
2. Set up environment variables in Netlify:
   - `PINATA_API_KEY`: Your Pinata API key
   - `PINATA_SECRET_KEY`: Your Pinata secret key

3. Deploy to Netlify (automatic via GitHub integration)

## Smart Contract

The platform uses a dual-NFT system:
- **Service NFT**: Automatically sent to recipient's wallet with document preview
- **Document NFT**: Full document access granted upon recipient acceptance

### Contract Addresses

- **TRON Nile Testnet**: `TKNNQhLqwE2k9botmQs2LuC3msno8YkLfY`
- **TRON Mainnet**: Coming soon
- **Ethereum**: Coming soon
- **Polygon**: Coming soon

## Usage

1. **For Law Enforcement**:
   - Connect wallet (TronLink for TRON, MetaMask for EVM)
   - Upload legal document (PDF/Word/Image)
   - Enter recipient wallet address
   - Submit to create service NFT

2. **For Recipients**:
   - View service NFT in wallet
   - Read document preview
   - Accept service to receive full document
   - Access complete document via IPFS

## Development

### Local Development
```bash
# No build process required - pure HTML/CSS/JS
# Open index.html in a browser
```

### Contract Development
```bash
cd contracts
npm install
tronbox compile
node deploy_legal_service_v2.js
```

## Security

- Private keys are never exposed in the frontend
- All sensitive operations happen through wallet providers
- Documents are stored on IPFS for decentralization
- Smart contracts are audited and optimized for gas efficiency

## License

MIT License - see LICENSE file for details

## Support

For issues or questions, please open a GitHub issue.