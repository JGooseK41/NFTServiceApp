# LegalNotice NFT - Blockchain Legal Document Service

A revolutionary blockchain-based system for serving legal documents with certified delivery proof. Features view-gated notices that display complete information while protecting document privacy until acceptance.

## 🚀 Key Features

- 🔒 **View-Gated Notices**: Recipients see agency, case number, and details before accepting
- 📄 **Multi-Format Support**: PDF, Word documents, and images with automatic conversion
- ✅ **Certified Delivery**: Blockchain proof of service and acceptance with timestamps
- 💰 **Zero Fees for Recipients**: Process servers can sponsor acceptance costs
- 🌐 **Universal Wallet Support**: Works with any wallet supporting TRC-721 NFTs
- 🔍 **Complete Tracking**: Real-time delivery status and audit trail

## 🎯 Perfect For

- **Law Enforcement**: Serving seizure notices, subpoenas, and legal holds
- **Courts**: Delivering summons and court orders
- **Process Servers**: Certified service of legal documents
- **Government Agencies**: Official notifications requiring proof of delivery

## 📸 How It Works

### For Process Servers:
1. **Upload Document** - PDF, Word, or image files
2. **Enter Details** - Agency, case number, recipient info
3. **Send Notice** - Pay ~22 TRX (includes recipient's fees)
4. **Track Delivery** - Monitor acceptance status

### For Recipients:
1. **Receive Alert** - NFT appears in wallet with full details
2. **Review Info** - See agency, case number, and rights
3. **Accept Notice** - Sign transaction (free if sponsored)
4. **Access Document** - View encrypted document

## 💰 Fee Structure

| Service | Cost | Purpose |
|---------|------|---------|
| Base Fee | 20 TRX | Contract execution |
| Sponsorship | 2 TRX | Recipient's fees |
| **Total** | **22 TRX** | Complete service |

## 🛠️ Technology Stack

- **Blockchain**: TRON (TRC-721 NFTs)
- **Smart Contracts**: Solidity 0.8.6 with view-gating
- **Storage**: IPFS (encrypted documents)
- **Frontend**: Pure JavaScript, no frameworks
- **Document Processing**: PDF.js, Mammoth.js
- **Wallet Integration**: TronLink

## 🚀 Quick Start

### Deploy to Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yourusername/NFTServiceApp)

### Local Development
```bash
# Clone repository
git clone https://github.com/yourusername/NFTServiceApp.git
cd NFTServiceApp

# Run local server
python3 -m http.server 8000
# Visit http://localhost:8000
```

## 📄 Smart Contract

### Current Deployments
- **TRON Nile Testnet**: `TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh` (Basic)
- **TRON Mainnet**: [Deploy ViewGated contract]

### Features
- View-gated document access
- Comprehensive metadata storage
- Sponsorship mechanism
- Certified delivery tracking

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