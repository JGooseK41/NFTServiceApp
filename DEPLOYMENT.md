# Deployment Guide for LegalNotice NFT App

## Prerequisites

1. Install TronLink wallet extension
2. Have TRX for deployment (minimum 1500 TRX for contract deployment)
3. Node.js installed

## Quick Deployment Steps

### 1. Deploy the View-Gated Contract

#### Option A: Using TronLink (Recommended for beginners)

1. Open TronLink and switch to Nile Testnet (or Mainnet)
2. Go to https://nile.tronscan.org/#/contracts/contract-compiler (or mainnet equivalent)
3. Copy the content of `contracts/LegalNoticeNFT_ViewGated.sol`
4. Paste into the compiler
5. Set compiler version to 0.8.6
6. Enable optimization (200 runs)
7. Compile and Deploy
8. Copy the contract address

#### Option B: Using TronBox (For developers)

```bash
# Install TronBox globally
npm install -g tronbox

# Install dependencies
npm install

# Set your private key in .env file
echo "PRIVATE_KEY_NILE=your_private_key_here" > .env

# Compile contracts
tronbox compile

# Deploy to Nile testnet
tronbox migrate --network nile

# Deploy to Mainnet (be careful!)
tronbox migrate --network mainnet
```

### 2. Update the Application

1. Open `index.html`
2. Find the contract configuration section (around line 3290)
3. Update the contract address:

```javascript
const CHAIN_CONFIG = {
    tron: {
        nile: {
            contractAddress: 'YOUR_NEW_CONTRACT_ADDRESS_HERE',
            // ... rest of config
        }
    }
}
```

### 3. Deploy the Web Application

#### Option A: GitHub Pages (Free)

1. Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial deployment"
git remote add origin https://github.com/yourusername/nft-service-app.git
git push -u origin main
```

2. Go to Settings → Pages in your GitHub repository
3. Select "Deploy from a branch"
4. Choose "main" branch and "/ (root)" folder
5. Click Save
6. Your app will be available at: `https://yourusername.github.io/nft-service-app`

#### Option B: Netlify (Recommended)

1. Create account at netlify.com
2. Drag and drop your project folder
3. Configure environment variables:
   - `VITE_IPFS_PROJECT_ID`: Your Infura IPFS project ID
   - `VITE_IPFS_PROJECT_SECRET`: Your Infura IPFS secret
4. Deploy!

#### Option C: Custom Domain

1. Purchase domain (e.g., legalnotice.app)
2. Use Cloudflare Pages:
```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages publish . --project-name=legalnotice
```

### 4. Post-Deployment Setup

1. **Test the Contract**:
   - Connect wallet
   - Try creating a test notice with small amount
   - Verify it appears in recipient's wallet

2. **Enable Sponsorship** (Optional):
   - Send TRX to contract address for sponsorship pool
   - This allows free acceptance for recipients

3. **Configure Admin Access**:
   - Your deployer address is automatically admin
   - Grant additional admin roles as needed

## Security Checklist

- [ ] Private keys are never committed to git
- [ ] Contract has been tested on testnet first
- [ ] IPFS credentials are kept secret
- [ ] HTTPS is enabled for production
- [ ] Contract address is verified on TronScan

## Mainnet Deployment Costs

- Contract deployment: ~1000-1500 TRX
- Each notice creation: ~20-22 TRX (with sponsorship)
- Sponsorship pool: Recommended 100+ TRX initial deposit

## Support

For issues or questions:
- Contract issues: Check TronScan for transaction details
- IPFS issues: Verify Infura credentials
- UI issues: Check browser console for errors

## Emergency Procedures

If something goes wrong:
1. Admin can update fee structure
2. Admin can pause specific functions
3. Users can always withdraw their NFTs
4. Contract is immutable - plan accordingly