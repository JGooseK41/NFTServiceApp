# Redeployment Guide for Verified Contract

## Steps for TronScan Compilation and Deployment

### 1. Compile on TronScan
1. Use the flattened source: `contracts/LegalNoticeNFT_Complete_flattened.sol`
2. Compiler settings:
   - Version: `0.8.6`
   - Optimization: `Enabled`
   - Runs: `200`
   - License: `MIT`
3. Download the compiled bytecode from TronScan

### 2. Update Deployment Script
Create a new deployment script that uses the TronScan-compiled bytecode:
- `deploy_verified_v2.js`
- Use the bytecode from TronScan
- Keep the same ABI from `contracts/LegalNoticeNFT_Complete.abi`

### 3. Before Deploying
1. **Document the current state** - Note any important data from current contract
2. **Test on testnet first** - Ensure everything works
3. **Update naming convention** - Use `LegalNoticeNFT_v2` for clarity

### 4. After Deployment
1. **Update index.html** with new contract address
2. **Verify immediately** on TronScan with same settings
3. **Test all functionality**
4. **Update deployment documentation**

### 5. Benefits of Redeploying
- ✅ Guaranteed verification on TronScan
- ✅ NFTs will show properly in wallets
- ✅ Public can view/verify contract code
- ✅ Better trust and transparency
- ✅ Can use v2 naming convention going forward

### 6. Migration Considerations
- Current contract has minted NFTs - these won't transfer
- Consider if you need to track or reference old contract
- Update any external references to the contract address

## Deployment Checklist
- [ ] Compile on TronScan
- [ ] Download bytecode
- [ ] Create new deployment script
- [ ] Test deployment on testnet
- [ ] Deploy to mainnet/nile
- [ ] Verify contract
- [ ] Update UI with new address
- [ ] Test all functions
- [ ] Document the deployment