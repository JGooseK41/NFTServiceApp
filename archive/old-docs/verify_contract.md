# How to Verify the Contract on TronScan

## Why NFTs Might Not Show in Wallets

1. **Contract Not Verified** - Unverified contracts often don't display NFTs properly
2. **Missing Metadata** - The Complete contract may not return proper token URIs
3. **Wallet Limitations** - Some wallets only show NFTs from verified contracts

## Steps to Verify Contract on Nile Testnet

1. **Visit the contract on TronScan**:
   https://nile.tronscan.org/#/contract/TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G

2. **Click "Contract" tab** then "Verify and Publish"

3. **Fill in verification details**:
   - Contract Name: `LegalNoticeNFT_Complete`
   - Compiler Version: `0.8.6`
   - Optimization: `Yes`
   - Runs: `200`

4. **Paste the flattened contract code**
   - You'll need the full contract source including all dependencies
   - Use: `npx truffle-flattener contracts/LegalNoticeNFT_Complete.sol`

## Alternative Ways to Check NFTs

### 1. Direct Contract Queries (in Console)
```javascript
// Check if NFT exists
const owner = await legalContract.ownerOf(TOKEN_ID).call();
console.log('Owner:', owner);

// Check recipient balance
const balance = await legalContract.balanceOf(RECIPIENT_ADDRESS).call();
console.log('Balance:', balance);

// Get token by index
const tokenId = await legalContract.tokenOfOwnerByIndex(RECIPIENT_ADDRESS, 0).call();
console.log('Token ID:', tokenId);
```

### 2. Check Contract Events
Even without verification, you can check the "Event Logs" tab on TronScan to see Transfer events.

### 3. Use TronWeb to Query
```javascript
// Get all tokens owned by address
async function getOwnedTokens(address) {
    const balance = await legalContract.balanceOf(address).call();
    const tokens = [];
    for (let i = 0; i < balance; i++) {
        const tokenId = await legalContract.tokenOfOwnerByIndex(address, i).call();
        tokens.push(tokenId.toString());
    }
    return tokens;
}
```

## Quick Workaround

While the contract is unverified, you can:

1. Use the app's "Audit" feature to see your notices
2. Check the "Recent Activities" tab
3. Look at the transaction on TronScan to confirm it succeeded
4. Use the direct notice link: `https://nftserviceapp.netlify.app/#notice-{ID}`

## Next Steps

1. Contact the contract deployer to verify the contract
2. Or deploy a new contract with verification
3. Consider using a contract that emits proper events for better tracking