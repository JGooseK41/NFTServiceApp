# LegalNoticeNFT Deployment Guide

## Contract Ready for Deployment

Your complete contract is compiled and ready:
- **Contract**: `LegalNoticeNFT_Complete.sol`
- **Binary**: `LegalNoticeNFT_Complete_sol_LegalNoticeNFT.bin` (25.4 KB)
- **ABI**: `LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi`

## Deployment Options

### Option 1: TronScan Web Interface (Recommended for First Time)

1. **For Testnet (Shasta):**
   - Go to: https://shasta.tronscan.org/#/contracts/contract-compiler
   - Get test TRX from: https://www.trongrid.io/faucet

2. **For Mainnet:**
   - Go to: https://tronscan.org/#/contracts/contract-compiler
   - Ensure you have at least 150 TRX for deployment

3. **Steps:**
   - Copy the entire contents of `contracts/LegalNoticeNFT_Complete.sol`
   - Paste into the contract compiler
   - Settings:
     - Solidity Version: `0.8.6`
     - Optimization: `Enabled`
     - Runs: `200`
   - Click "Compile"
   - Click "Deploy"
   - Confirm transaction in TronLink

### Option 2: Command Line Deployment

1. **Install TronWeb:**
   ```bash
   npm install tronweb
   ```

2. **Set your private key:**
   ```bash
   export PRIVATE_KEY="your_private_key_here"
   ```

3. **Deploy to testnet:**
   ```bash
   NETWORK=shasta node deploy_contract.js
   ```

4. **Deploy to mainnet:**
   ```bash
   NETWORK=mainnet node deploy_contract.js
   ```

### Option 3: Using Remix IDE

1. **Install TronLink Remix Plugin:**
   - Go to https://remix.ethereum.org
   - Install the TronLink plugin from the plugin manager

2. **Load Contract:**
   - Create new file: `LegalNoticeNFT.sol`
   - Copy contract code
   - Compile with Solidity 0.8.6

3. **Deploy:**
   - Connect TronLink wallet
   - Select TVM environment
   - Deploy contract

## After Deployment

1. **Update Frontend:**
   ```javascript
   // In index.html, update line ~40:
   const CONTRACT_ADDRESS = 'YOUR_NEW_CONTRACT_ADDRESS';
   ```

2. **Verify Deployment:**
   - Check contract on TronScan
   - Test basic functions:
     - Check admin: `admin()`
     - Check service fee: `serviceFee()`

3. **Grant Roles (if needed):**
   ```javascript
   // Grant server role to addresses that can serve notices
   const SERVER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SERVER_ROLE"));
   await contract.grantRole(SERVER_ROLE, serverAddress);
   ```

## Deployment Costs

- **Testnet**: Free (use faucet)
- **Mainnet**: 
  - Contract deployment: ~100-150 TRX
  - Each notice served: 20-22 TRX (configurable)

## Post-Deployment Checklist

- [ ] Contract deployed and verified on TronScan
- [ ] Frontend updated with new contract address
- [ ] Test notice creation works
- [ ] Test notice acceptance works
- [ ] Test view-gated documents work
- [ ] Configure fee settings if needed
- [ ] Set up resource sponsorship if desired

## Troubleshooting

**"Insufficient energy"**: Increase fee limit or enable resource sponsorship
**"Contract creation failed"**: Ensure you have enough TRX (150+ recommended)
**"Invalid address"**: Make sure TronLink is connected to the correct network