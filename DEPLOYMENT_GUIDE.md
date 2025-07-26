# Deployment Guide for Optimized LegalNoticeNFT Contract

## Prerequisites

1. **Node.js and npm installed**
2. **TronLink wallet with TRX balance**
   - Testnet: At least 100 TRX
   - Mainnet: At least 500 TRX (for deployment and initial operations)
3. **Private key from TronLink**

## Step 1: Setup Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your values:
```env
# Your TronLink private key (64 characters, no 0x prefix)
TRON_PRIVATE_KEY=your_private_key_here

# Your wallet address to receive fees
FEE_COLLECTOR=TYourWalletAddressHere

# Network: nile (testnet), shasta (testnet), or mainnet
NETWORK=nile
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Compile the Contract

The contract has already been compiled and optimized to 24,427 bytes (under the 24KB limit).

If you need to recompile:
```bash
node compile_contract.js
```

## Step 4: Deploy the Contract

### For Testnet (Nile):
```bash
node deploy_optimized.js
```

### For Mainnet:
```bash
NETWORK=mainnet node deploy_optimized.js
```

## Step 5: Verify Deployment

After successful deployment, you'll see:
```
✅ Contract deployed successfully!
📋 Contract Address: TXxxxxxxxxxxxxxxxxxxxxx
```

The script will automatically:
- Deploy the contract
- Set the fee collector address
- Update config.js with the new address
- Save deployment info to deployments.json

## Step 6: Update Frontend

1. The deployment script automatically updates `config.js`
2. Verify the contract address is correct in the config
3. Test the frontend connection

## Step 7: Post-Deployment Setup

### Grant Admin Roles (if needed):
Use the admin panel in the UI or interact directly with the contract to:
1. Grant process server roles
2. Set law enforcement exemptions
3. Configure fees if different from defaults

### Default Fee Structure:
- Document Notice: 150 TRX
- Text Notice: 15 TRX
- Process Server Fee: 75 TRX
- Sponsorship Fee: 2 TRX

## Contract Size Information

The optimized contract is **24,427 bytes**, which is safely under the 24,576 byte limit for TRON mainnet deployment.

### Optimizations Made:
- Removed redundant functions
- Consolidated batch operations
- Shortened error messages
- Removed unused features
- Optimized with low compiler runs (10)

## Troubleshooting

### "Insufficient balance" error:
- Ensure you have enough TRX in your wallet
- Testnet: Get free TRX from faucet
- Mainnet: Transfer TRX to your deployment wallet

### "Contract too large" error:
- The contract has been optimized and should not have this error
- If it occurs, ensure you're using the compiled version from `build/contracts/`

### Network connection issues:
- Check your internet connection
- Try a different network endpoint
- Verify the network setting in .env

## Security Checklist

Before mainnet deployment:
- [ ] Private key is secure and not committed to git
- [ ] Fee collector address is correct
- [ ] Contract has been tested on testnet
- [ ] All admin roles are properly configured
- [ ] Fees are set appropriately for your use case

## Next Steps

1. Test all functionality on testnet first
2. Document the contract address for users
3. Set up monitoring for contract events
4. Configure process servers and exemptions as needed