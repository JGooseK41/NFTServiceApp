# Contract Compilation and Deployment Options

## Option 1: TronBox (Recommended)
Since you already have TronBox installed:

```bash
# 1. Make sure contract is in contracts/ directory
cp contracts/LegalNoticeNFT_Complete.sol contracts/LegalNoticeNFT_v2.sol

# 2. Compile with TronBox
tronbox compile --all

# 3. Deploy with TronBox
tronbox migrate --network nile --reset
```

## Option 2: Remix IDE + TronLink
1. Go to: https://remix.ethereum.org
2. Create new file: `LegalNoticeNFT_v2.sol`
3. Paste the contract code
4. Compile with:
   - Compiler: 0.8.6
   - Optimization: Enabled
   - Runs: 200
5. Deploy using TronLink in Remix

## Option 3: TronIDE
1. Go to: https://www.tronide.io/
2. Upload `LegalNoticeNFT_Complete.sol`
3. Compile with same settings
4. Deploy directly from TronIDE

## Option 4: Direct TronScan Deployment
1. Go to: https://nile.tronscan.org/#/contracts/deploy
2. Choose "Upload Contract Files"
3. Upload the .sol file
4. Set compiler options
5. Deploy directly

## Option 5: Use Existing Compiled Bytecode
We already have compiled bytecode in:
- `contracts/LegalNoticeNFT_Complete.bin`
- `contracts/LegalNoticeNFT_Complete.abi`

## Best Approach for Verification:
1. Use **TronIDE** or **Remix** with TronLink
2. These will produce bytecode that TronScan can verify
3. Make sure to use EXACT same compiler settings when verifying

## After Deployment:
The contract should verify immediately on TronScan with the same compiler settings used during deployment.