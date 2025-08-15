# UI Updates Required for v3 Contract

## Main Change: serveNotice Function Signature

### v2 (Current):
```javascript
await legalContract.serveNotice(
    recipient,          // address
    encryptedIPFS,      // string
    encryptionKey,      // string
    issuingAgency,      // string
    noticeType,         // string
    caseNumber,         // string
    caseDetails,        // string
    legalRights,        // string
    sponsorFees         // bool
).send({...})
```

### v3 (New):
```javascript
await legalContract.serveNotice(
    recipient,          // address
    encryptedIPFS,      // string
    encryptionKey,      // string
    issuingAgency,      // string
    noticeType,         // string
    caseNumber,         // string
    caseDetails,        // string
    legalRights,        // string
    sponsorFees,        // bool
    metadataURI         // string - NEW PARAMETER!
).send({...})
```

## UI Code to Update (index.html):

### Line ~8320 - Update serveNotice call:
```javascript
const tx = await legalContract.serveNotice(
    noticeRequest.recipient,
    noticeRequest.encryptedIPFS || '',
    noticeRequest.encryptionKey || '',
    noticeRequest.issuingAgency || '',
    noticeRequest.noticeType || '',
    noticeRequest.caseNumber || '',
    noticeRequest.publicText || '',
    (typeof legalRights === 'string' ? legalRights : legalRights?.value) || '',
    sponsorFees,
    nftAssets?.metadataURI || ''  // ADD THIS LINE!
).send({
```

## The metadataURI Should Be:
- The IPFS URI created when uploading NFT metadata with thumbnail
- Format: `ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- This is what makes NFTs visible in wallets!

## After v3 Deployment:
1. Update contract address in index.html
2. Add the metadataURI parameter to serveNotice call
3. NFTs should finally be visible in wallets!