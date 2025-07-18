# 🚀 Deployment Checklist

## Pre-Deployment

- [ ] **Test on Nile Testnet**
  - [ ] Deploy ViewGated contract
  - [ ] Update contract address in index.html
  - [ ] Test complete flow with test TRX
  - [ ] Verify wallet compatibility

- [ ] **Security Review**
  - [ ] Remove any console.log statements
  - [ ] Ensure no private keys in code
  - [ ] Verify .gitignore is complete
  - [ ] Check for sensitive data

## Contract Deployment

### Option 1: TronLink Web Compiler (Easiest)

1. [ ] Go to: https://nile.tronscan.org/#/contracts/contract-compiler
2. [ ] Copy contract from: `contracts/LegalNoticeNFT_ViewGated.sol`
3. [ ] Settings:
   - Compiler: 0.8.6
   - Optimization: ON (200 runs)
4. [ ] Deploy with 1500 TRX fee limit
5. [ ] Save contract address: _________________

### Option 2: Command Line

```bash
# Install dependencies
cd deploy
npm install

# Deploy to testnet
PRIVATE_KEY_NILE=your_key_here npm run deploy:nile

# Deploy to mainnet (careful!)
PRIVATE_KEY_MAINNET=your_key_here npm run deploy:mainnet
```

## Update Application

1. [ ] Update contract address in `index.html` (line ~3290):
```javascript
contractAddress: 'YOUR_NEW_CONTRACT_ADDRESS',
```

2. [ ] Update contract ABI if changed

3. [ ] Update network in chain selector

## Web Deployment

### GitHub Pages (Free)

```bash
# Initialize git
git init
git add .
git commit -m "Initial deployment"

# Create repository on GitHub
# Then:
git remote add origin https://github.com/YOUR_USERNAME/NFTServiceApp.git
git push -u origin main

# Enable Pages in Settings → Pages
```

### Netlify (Recommended)

1. [ ] Create account at netlify.com
2. [ ] Connect GitHub repository
3. [ ] Environment variables:
   ```
   VITE_IPFS_PROJECT_ID=your_infura_project_id
   VITE_IPFS_PROJECT_SECRET=your_infura_secret
   ```
4. [ ] Deploy

### Custom Domain

1. [ ] Purchase domain
2. [ ] Add to Netlify/GitHub Pages
3. [ ] Configure DNS:
   - A Record: Point to hosting IP
   - CNAME: www to main domain
4. [ ] Enable HTTPS

## Post-Deployment Testing

- [ ] **Functionality Tests**
  - [ ] Connect wallet
  - [ ] Upload document
  - [ ] Create notice (small test)
  - [ ] Check recipient wallet
  - [ ] Test acceptance flow
  - [ ] Verify document access

- [ ] **Cross-Browser Testing**
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Mobile browsers

- [ ] **Wallet Testing**
  - [ ] TronLink
  - [ ] TronLink Pro
  - [ ] TokenPocket

## Production Setup

- [ ] **Contract Configuration**
  - [ ] Send initial TRX to contract for sponsorship
  - [ ] Set up admin roles
  - [ ] Configure fee exemptions

- [ ] **Monitoring**
  - [ ] Set up TronScan alerts
  - [ ] Monitor contract balance
  - [ ] Track usage metrics

- [ ] **Documentation**
  - [ ] Update README with contract address
  - [ ] Create user guide
  - [ ] Document API endpoints

## Launch Announcement

- [ ] Announce on social media
- [ ] Contact potential users
- [ ] Submit to DApp directories
- [ ] Create demo video

## Emergency Procedures

If issues arise:
1. Admin can update fees
2. Users can always withdraw NFTs
3. Keep private keys secure
4. Have rollback plan ready

---

**Remember**: Test everything on testnet first! 

Contract deployment is permanent on mainnet.