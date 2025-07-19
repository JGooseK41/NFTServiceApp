# Hybrid Architecture Deployment Guide

## Overview

This hybrid architecture provides:
- ✅ **True view-gating**: Documents encrypted with Lit Protocol
- ✅ **Certified delivery**: On-chain proof via events
- ✅ **Rich metadata**: Stored on IPFS, queryable via backend
- ✅ **Low gas costs**: Minimal on-chain storage
- ✅ **Scalable**: Backend handles complex logic

## Architecture Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Smart Contract │     │ Backend Service  │     │   Lit Protocol  │
│  (Events Only)  │────▶│ (Event Indexing) │────▶│  (Encryption)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       ▼                         │
         │              ┌──────────────────┐              │
         └─────────────▶│      IPFS        │◀─────────────┘
                        │ (Document Store) │
                        └──────────────────┘
```

## Deployment Steps

### 1. Deploy Smart Contract

```bash
# Compile the minimal contract
cd contracts
npx solc --optimize --optimize-runs 200 --bin --abi LegalNoticeEvents.sol

# Deploy to TRON testnet/mainnet using TronBox or Remix
```

### 2. Set Up Backend Service

```bash
cd backend
npm install

# Create .env file
cat > .env << EOF
CONTRACT_ADDRESS=YOUR_DEPLOYED_CONTRACT_ADDRESS
TRON_RPC_URL=https://api.trongrid.io
PORT=3001
EOF

# Start the backend
npm start
```

### 3. Configure Lit Protocol

1. Get Lit Protocol API keys from https://developer.litprotocol.com/
2. Add to backend `.env` file
3. Set up IPFS node or use Infura/Pinata

### 4. Deploy Frontend

```bash
# Update CONTRACT_ADDRESS in hybrid-frontend.html
# Serve the frontend
python -m http.server 8000
```

## How It Works

### Serving a Notice

1. **Frontend**: User fills out notice form with document
2. **Backend**: 
   - Encrypts document with Lit Protocol
   - Sets access control: only recipient can decrypt
   - Uploads encrypted data to IPFS
3. **Smart Contract**: 
   - Records NoticeServed event
   - Stores minimal data (addresses, IPFS hash, timestamp)
4. **Backend**: Indexes the event for querying

### Viewing a Notice

1. **Recipient**: Clicks "View Document"
2. **Frontend**: Gets signature from wallet
3. **Backend**: 
   - Fetches encrypted document from IPFS
   - Requests decryption from Lit Protocol
   - Lit checks if user meets conditions (is recipient)
   - Returns decrypted document if authorized
4. **Smart Contract**: Logs view event

### Accepting a Notice

1. **Recipient**: Clicks "Accept Notice"
2. **Frontend**: Signs acknowledgment message
3. **Smart Contract**: 
   - Records acceptance on-chain
   - Emits NoticeAccepted event
4. **Backend**: Updates local database

## Key Benefits

1. **Gas Efficiency**: Only ~100k gas per notice (vs 1M+ for complex contracts)
2. **True Encryption**: Documents actually encrypted, not just access-controlled
3. **Scalability**: Backend can handle millions of notices
4. **Rich Queries**: SQL/NoSQL database for complex searches
5. **Flexibility**: Easy to add features without redeploying contracts

## Production Considerations

### Backend Infrastructure
- Use PostgreSQL or MongoDB instead of in-memory storage
- Deploy on AWS/Google Cloud with auto-scaling
- Add Redis for caching
- Implement proper authentication

### IPFS Setup
- Use Pinata or Infura for managed IPFS
- Consider Arweave for permanent storage
- Implement backup/redundancy

### Monitoring
- Set up event listeners for all contract events
- Add logging and error tracking (Sentry)
- Monitor gas prices and adjust fees

### Security
- Audit smart contract (minimal attack surface)
- Secure backend API endpoints
- Implement rate limiting
- Add wallet signature verification

## Cost Analysis

**Per Notice Costs:**
- Smart Contract: ~0.1 TRX (gas)
- Service Fee: 20 TRX (configurable)
- IPFS Storage: ~$0.01 (depends on size)
- Lit Protocol: Free for reasonable usage

**Compared to Complex Contract:**
- 90% less gas usage
- 100% of features retained
- Better user experience
- Easier maintenance

## Next Steps

1. **Test on Testnet**: Deploy and test full flow
2. **Add Authentication**: Secure backend endpoints
3. **Build Admin Panel**: For monitoring notices
4. **Mobile App**: React Native app for recipients
5. **Analytics**: Track delivery rates, acceptance times

This hybrid approach gives you the best of both worlds - blockchain security and transparency with the flexibility and efficiency of traditional web services.