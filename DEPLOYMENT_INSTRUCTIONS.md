# Deployment Instructions for Simplified Contract

## Quick Deployment Options

### Option 1: TronScan (Easiest) ⭐

1. **Go to TronScan Compiler:**
   - Nile Testnet: https://nile.tronscan.org/#/contracts/contract-compiler
   - Mainnet: https://tronscan.org/#/contracts/contract-compiler

2. **Upload Contract:**
   - Click "Upload .sol files"
   - Select `LegalNoticeNFT_Simplified.sol`
   - Or copy/paste the contract code

3. **Configure Compilation:**
   - Contract Name: `LegalNoticeNFT_Simplified`
   - Compiler Version: `0.8.0` (or latest 0.8.x)
   - Optimization: `Yes` (200 runs)

4. **Add OpenZeppelin Imports:**
   You'll need to add these contracts too:
   - ERC721.sol
   - ERC721URIStorage.sol
   - AccessControl.sol
   - Counters.sol
   - ReentrancyGuard.sol
   
   Or use flattened version (see below)

5. **Compile & Deploy:**
   - Click "Compile"
   - Click "Deploy"
   - Confirm in TronLink
   - Fee: ~1000-1500 TRX

6. **Save the Contract Address!**

### Option 2: Pre-flattened Contract

To make it easier, here's a command to flatten the contract:

```bash
# Install flattener
npm install -g truffle-flattener

# Flatten the contract
cd contracts
truffle-flattener LegalNoticeNFT_Simplified.sol > LegalNoticeNFT_Simplified_Flat.sol
```

Then upload the flattened file to TronScan.

### Option 3: Using Remix

1. **Open Remix:** https://remix.ethereum.org

2. **Create Contract:**
   - New file: `LegalNoticeNFT_Simplified.sol`
   - Paste contract code

3. **Install OpenZeppelin:**
   - In Remix, the imports should auto-resolve
   - If not, install OpenZeppelin contracts

4. **Compile:**
   - Compiler tab
   - Version: 0.8.0+
   - Enable optimization

5. **Deploy via TronLink:**
   - Deploy tab
   - Environment: "Injected Web3" 
   - Connect TronLink
   - Deploy

## After Deployment

### 1. Update Frontend

Edit `index.html` and update the CONTRACT_ADDRESS:

```javascript
const CONTRACT_ADDRESS = 'T...your_new_contract_address...';
```

### 2. Verify Basic Functions

Test on TronScan:
- `documentNoticeFee`: Should return 150000000 (150 TRX)
- `textOnlyFee`: Should return 15000000 (15 TRX)
- `feeCollector`: Should be your address

### 3. Grant Process Server Role (Optional)

If you have process servers who need discounted fees:

```javascript
// In TronScan or via script
contract.grantRole(PROCESS_SERVER_ROLE, "TProcessServerAddress")
```

### 4. Test the System

1. Create a text notice (15 TRX)
2. Create a document notice (150 TRX)
3. Accept and view as recipient

## Contract Addresses

After deployment, save your addresses here:

**Nile Testnet:**
- Contract: `T...`
- Deployed: `date`
- Deployer: `T...`

**Mainnet:**
- Contract: `T...`
- Deployed: `date`
- Deployer: `T...`

## Troubleshooting

**"Cannot import contracts"**
- Use the flattened version
- Or manually add OpenZeppelin contracts

**"Insufficient Energy"**
- Deployment needs ~50M energy
- Have at least 1500 TRX

**"Compilation Error"**
- Check Solidity version (0.8.0+)
- Ensure all imports are resolved

**"Transaction Reverted"**
- Check you have enough TRX
- Verify compiler settings match

## Gas Estimates

- Deployment: ~1000-1500 TRX
- Create Document Notice: ~35 TRX (energy)
- Create Text Notice: ~25 TRX (energy)
- Accept Notice: ~20 TRX (energy)