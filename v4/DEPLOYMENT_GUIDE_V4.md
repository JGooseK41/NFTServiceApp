# V4 Deployment Guide

## Contract Already Deployed!
The v4 contract is already deployed at: **TSQZgUdYGm7LYSoZqr4SCKs8nb4C98ckn5**

## If You Need to Redeploy

### 1. Prepare for Deployment
- File: `LegalNoticeNFT_v4_Final_flattened.sol`
- Go to: https://tronscan.org/#/contracts/deploy

### 2. Deployment Settings
```
Contract Name: LegalNoticeNFT_v4_Final
Compiler: 0.8.6
Optimization: Enabled
Runs: 200
License: MIT
```

### 3. Deployment Cost
- Approximately: 1,150 TRX
- Energy: ~76,000

### 4. Post-Deployment Steps

#### Update UI Contract Address
In `index_v4.html`, update line containing:
```javascript
const CONTRACT_ADDRESS = 'TSQZgUdYGm7LYSoZqr4SCKs8nb4C98ckn5';
```

#### Verify on TronScan
1. Go to contract page on TronScan
2. Click "Contract" tab
3. Click "Verify and Publish"
4. Upload the flattened source code

## Using the Existing Deployment

### 1. Open UI
Simply open `index_v4.html` in your browser

### 2. Connect Wallet
- TronLink required
- Ensure correct network (Mainnet/Testnet)

### 3. Check Connection
The UI will show:
- Contract address
- Your role (Admin/Process Server/None)
- Server ID (if applicable)
- Fee status

## Admin Functions

### Grant Process Server Role
```javascript
const PROCESS_SERVER_ROLE = tronWeb.sha3('PROCESS_SERVER_ROLE');
await contract.grantRole(PROCESS_SERVER_ROLE, serverAddress).send();
```

### Update Fees
```javascript
await contract.updateServiceFee(newFee).send();
await contract.updateCreationFee(newFee).send();
await contract.updateSponsorshipFee(newFee).send();
```

### Set Fee Exemptions
```javascript
await contract.setFeeExemption(
    userAddress,
    true,  // serviceFeeExempt
    false  // fullFeeExempt
).send();
```

## Common Issues

### "Contract not connected"
- Check network (Mainnet vs Testnet)
- Ensure wallet is connected
- Verify contract address is correct

### "Insufficient fee"
- Base fee: 25 TRX (20 service + 5 creation)
- Sponsorship adds 2 TRX
- Batch multiplies by recipient count

### NFTs not visible
- Ensure metadataURI is provided
- Check IPFS gateway is accessible
- Verify metadata includes "image" field

## Support Files in This Directory

- `CONTRACT_V4_INFO.json` - All deployment details
- `README_V4.md` - Comprehensive documentation
- `QUICK_REFERENCE_V4.md` - Quick function reference
- Contract source and ABI files