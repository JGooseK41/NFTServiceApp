# Update Frontend with New Contract Address

## After deploying your contract on TronScan:

### 1. Get your contract address from TronScan
It will look like: `TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Update the main app
Edit `index.html` and find this line (around line 40):
```javascript
const CONTRACT_ADDRESS = 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';
```

Replace with your new address:
```javascript
const CONTRACT_ADDRESS = 'YOUR_NEW_CONTRACT_ADDRESS_HERE';
```

### 3. Test the deployment
1. Open `verify_deployment.html` in your browser
2. Enter your contract address
3. Click "Verify Contract"
4. You should see:
   - ✅ Contract admin: (your address)
   - ✅ Service fee: 20 TRX
   - ✅ Admin balance: 0 alerts

### 4. Test the full app
1. Open `index.html`
2. Try serving a test notice
3. Check that all functions work

## Contract is ready with ALL features:
- ✅ View-gated documents with encryption support
- ✅ Alert NFTs with full metadata
- ✅ Fee sponsorship
- ✅ Delivery proof
- ✅ All admin functions
- ✅ Legacy compatibility

The contract address is the only thing you need to update!