# Contract Deployment Guide

## Prerequisites

1. **Install TronBox** (TRON's Truffle):
```bash
npm install -g tronbox
```

2. **Install Dependencies**:
```bash
npm install tronweb
```

## Step 1: Compile the Contract

First, we need to create a TronBox configuration:

```bash
# Initialize tronbox (if not already done)
tronbox init
```

Create `tronbox.js` in project root:
```javascript
module.exports = {
  networks: {
    development: {
      privateKey: process.env.PRIVATE_KEY,
      fullHost: "https://api.trongrid.io",
      network_id: "1"
    },
    nile: {
      privateKey: process.env.PRIVATE_KEY,
      fullHost: "https://nile.trongrid.io",
      network_id: "3"
    }
  },
  compilers: {
    solc: {
      version: '0.8.6',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "istanbul"
      }
    }
  }
};
```

Compile the contract:
```bash
tronbox compile --all
```

## Step 2: Deploy the Contract

### Option A: Using TronBox (Recommended)

1. Set your private key:
```bash
export PRIVATE_KEY=your_private_key_here
```

2. Deploy to testnet (Nile):
```bash
tronbox migrate --reset --network nile
```

3. Deploy to mainnet:
```bash
tronbox migrate --reset --network development
```

### Option B: Using Deployment Script

1. Set environment variables:
```bash
export DEPLOYER_PRIVATE_KEY=your_private_key_here
export TRON_NETWORK=nile  # or mainnet
```

2. Run deployment:
```bash
node scripts/deploy_complete_contract.js
```

## Step 3: Verify Deployment

1. Check the contract on TronScan:
   - Testnet: https://nile.tronscan.org/#/contract/YOUR_CONTRACT_ADDRESS
   - Mainnet: https://tronscan.org/#/contract/YOUR_CONTRACT_ADDRESS

2. Verify basic functions are working:
   - Contract name: "Legal Notice NFT"
   - Symbol: "NOTICE"
   - Check fee settings

## Step 4: Post-Deployment Setup

1. **Update Frontend Configuration**:
   - Open `index.html`
   - Update the contract address in the connection function
   - The deployment script creates `js/contract-config.js` automatically

2. **Grant Admin Roles** (if needed):
   ```javascript
   // In browser console after connecting wallet
   const adminRole = tronWeb.sha3('ADMIN_ROLE');
   await legalContract.grantRole(adminRole, 'YOUR_ADDRESS').send();
   ```

3. **Set Fee Collector**:
   ```javascript
   await legalContract.setFeeCollector('FEE_COLLECTOR_ADDRESS').send();
   ```

4. **Configure Exemptions** (if needed):
   ```javascript
   await legalContract.setLawEnforcementExemption('ADDRESS', true, 'AGENCY_NAME').send();
   ```

## Deployment Costs

Estimated costs:
- Testnet: Free (use faucet for test TRX)
- Mainnet: ~500-1000 TRX for deployment
- Energy: ~50M-100M (contract is large)

## Troubleshooting

1. **"Insufficient energy"**: 
   - Freeze TRX for energy or
   - Increase feeLimit in deployment

2. **"Contract too large"**:
   - Already optimized with `via-ir` disabled
   - May need to split features if still too large

3. **"Invalid private key"**:
   - Ensure private key is 64 characters (no 0x prefix)
   - Check it matches your wallet

## Quick Deploy Commands

```bash
# Full deployment sequence
npm install -g tronbox
npm install tronweb

# Compile
tronbox compile --all

# Deploy to testnet
export PRIVATE_KEY=your_key_here
tronbox migrate --reset --network nile

# Get testnet TRX from faucet
# https://nileex.io/join/getJoinPage
```

## Contract Addresses

After deployment, save your contract addresses here:

- **Nile Testnet**: `T...` (pending)
- **Mainnet**: `T...` (pending)

## Next Steps

1. Test all functions on testnet first
2. Ensure you have enough TRX for mainnet deployment
3. Deploy to mainnet when ready
4. Update all frontend references to new contract