# TRON Nile Testnet Deployment Guide

## Prerequisites

1. **Node.js and npm** installed
2. **TronBox** for contract compilation
3. **Test TRX** from Nile faucet
4. **Private key** for deployment account

## Step 1: Install Dependencies

```bash
# Install TronBox globally
npm install -g tronbox

# Install project dependencies
cd /home/jesse/projects/NFTServiceApp/contracts
npm init -y
npm install tronweb
```

## Step 2: Create TronBox Configuration

Create a file named `tronbox.js` in the contracts directory:

```javascript
module.exports = {
  networks: {
    nile: {
      privateKey: process.env.TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1500000000,
      fullHost: 'https://nile.trongrid.io',
      network_id: '3'
    }
  },
  compilers: {
    solc: {
      version: '0.8.6',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
```

## Step 3: Prepare Contract for Compilation

1. Copy the optimized contract to the contracts directory:
```bash
# The contract should be in contracts/LegalServiceNFT.sol
# Use either LegalServiceNFT_TRON.sol or LegalServiceNFT_V2.sol
```

2. Create a `contracts` subdirectory if needed:
```bash
mkdir -p contracts
cp LegalServiceNFT_V2.sol contracts/LegalServiceNFT.sol
```

## Step 4: Get Test TRX

1. Go to Nile Faucet: https://nileex.io/join/getJoinPage
2. Enter your wallet address
3. Request test TRX (you'll need at least 1000 TRX for deployment)

## Step 5: Compile the Contract

```bash
# In the contracts directory
tronbox compile
```

This will create a `build/contracts` directory with compiled contract JSON files.

## Step 6: Set Environment Variables

```bash
# Set your private key (from TronLink wallet)
export TRON_PRIVATE_KEY=your_private_key_here

# Set fee collector address (optional, will use default if not set)
export FEE_COLLECTOR=your_fee_collector_address
```

⚠️ **Security Note**: Never commit your private key to git!

## Step 7: Deploy the Contract

```bash
# Run the deployment script
node deploy_legal_service_v2.js
```

You should see output like:
```
🚀 Deploying Legal Service NFT V2 to TRON Nile Testnet

📍 Deployer Address: TYour_Deployer_Address
💰 Deployer Balance: 1000 TRX

📋 Contract Details:
- Name: LegalServiceNFT
- Fee Collector: TYour_Fee_Collector
- Initial Fee: 10 TRX

🔨 Deploying contract...

✅ Contract deployed successfully!
📍 Contract Address: TYour_Contract_Address
🔗 View on NileScan: https://nile.tronscan.org/#/contract/TYour_Contract_Address
```

## Step 8: Update Frontend Configuration

After deployment, update your `index.html` file:

```javascript
// Find the CHAIN_CONFIG section and update:
nile: {
    name: 'TRON Nile Testnet',
    contractAddress: 'TYour_New_Contract_Address', // <-- Update this
    explorerUrl: 'https://nile.tronscan.org',
    nativeToken: 'TRX',
    chainId: null
}
```

## Step 9: Verify Deployment

1. Check on NileScan: Visit the contract URL shown in deployment output
2. Test basic functions:
   - Connect wallet to Nile testnet
   - Try uploading a test document
   - Check transaction on explorer

## Step 10: Authorize Law Enforcement Servers

Use TronLink or a script to call:
```javascript
// Authorize a server address
contract.authorizeServer('TServer_Address', true).send({
    feeLimit: 100000000
});
```

## Common Issues and Solutions

### Issue: "Insufficient balance"
**Solution**: Get more test TRX from the faucet

### Issue: "Contract compilation failed"
**Solution**: Check Solidity version in tronbox.js matches contract pragma

### Issue: "Transaction failed"
**Solution**: Increase feeLimit in deployment script

### Issue: "Cannot find module"
**Solution**: Run `npm install` in the contracts directory

## Testing the Deployed Contract

1. **Connect Wallet**: Use TronLink on Nile testnet
2. **Upload Document**: Test with a PDF or Word file
3. **Check Service NFT**: Should appear in recipient's wallet
4. **Accept Document**: Test the acceptance flow
5. **Verify on Explorer**: Check all transactions on NileScan

## Production Deployment

For mainnet deployment:
1. Change network configuration to mainnet
2. Use real TRX (deployment costs ~800-1200 TRX)
3. Thoroughly test on testnet first
4. Consider using multisig for admin functions
5. Implement monitoring and alerts

## Support

- TRON Documentation: https://developers.tron.network/
- TronBox Guide: https://github.com/tronprotocol/tronbox
- Nile Testnet Info: https://nileex.io/