# NFT Visibility Troubleshooting

## Quick Checks:

### 1. Check Transaction on TronScan
- Go to your transaction on TronScan
- Look for "Token Transfers" section
- Verify the NFT transfer shows there

### 2. Check Contract's tokenURI Function
The NFT might not be visible because the tokenURI might not be returning proper metadata.

### 3. Debug Steps in Browser Console:

```javascript
// 1. Check if you own any NFTs
const balance = await legalContract.balanceOf('YOUR_WALLET_ADDRESS').call();
console.log('NFT Balance:', balance);

// 2. Get your alert IDs
const alerts = await legalContract.getRecipientAlerts('YOUR_WALLET_ADDRESS').call();
console.log('Alert IDs:', alerts);

// 3. Check if tokenURI returns metadata
if (alerts.length > 0) {
    const tokenId = alerts[0];
    const uri = await legalContract.tokenURI(tokenId).call();
    console.log('Token URI:', uri);
}

// 4. Check notice details
if (alerts.length > 0) {
    const notice = await legalContract.notices(alerts[0]).call();
    console.log('Notice:', notice);
}
```

### 4. Common Issues:
1. **No tokenURI implementation** - The contract might not return metadata
2. **Wrong token ID** - The NFT ID might not match what wallets expect
3. **Metadata format** - The metadata might not be in the correct format

### 5. Manual Check on TronScan:
1. Go to: https://nile.tronscan.org/#/token721/TTGvPTRmVqz23G3FqiWPg3hiu3mLPVcc6x
2. Check if your NFTs are listed there
3. Click on your address to see owned tokens