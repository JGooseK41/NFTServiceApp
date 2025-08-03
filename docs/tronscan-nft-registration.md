# TronScan NFT Registration Guide

## Making Your TRC-721 NFT Visible on TronScan

Your contract is deployed at: `TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN`

### Steps to Register Your NFT:

1. **Go to Token Tracker Submission**
   - Visit: https://tronscan.org/#/tokens/create/Type
   - Select "TRC-721" as the token type

2. **Fill Out Token Information**
   - **Token Name**: Legal Notice NFT
   - **Token Symbol**: LEGAL
   - **Token Introduction**: Blockchain-based legal notice serving system for process servers
   - **Total Supply**: Dynamic (leave blank or enter 0)
   - **Decimals**: 0 (NFTs don't have decimals)
   - **Contract Address**: TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN

3. **Add Token Logo**
   - Upload a logo image (recommended: 200x200px PNG)
   - Or use this SVG data URI for a simple legal document icon:
   ```
   data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMxZjJiM2QiLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMDAsIDEwMCkiPgogICAgPHJlY3QgeD0iLTUwIiB5PSItNjAiIHdpZHRoPSIxMDAiIGhlaWdodD0iMTIwIiByeD0iNSIgZmlsbD0iI2ZmZmZmZiIvPgogICAgPHJlY3QgeD0iLTM1IiB5PSItNDUiIHdpZHRoPSI3MCIgaGVpZ2h0PSI1IiBmaWxsPSIjMzQ5OGRiIi8+CiAgICA8cmVjdCB4PSItMzUiIHk9Ii0zMCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUiIGZpbGw9IiMzNDk4ZGIiLz4KICAgIDxyZWN0IHg9Ii0zNSIgeT0iLTE1IiB3aWR0aD0iNzAiIGhlaWdodD0iNSIgZmlsbD0iIzM0OThkYiIvPgogICAgPHJlY3QgeD0iLTM1IiB5PSIwIiB3aWR0aD0iNDAiIGhlaWdodD0iNSIgZmlsbD0iIzM0OThkYiIvPgogICAgPGNpcmNsZSBjeD0iMjAiIGN5PSIzNSIgcj0iMTUiIGZpbGw9IiMyZWNjNzEiLz4KICAgIDxwYXRoIGQ9Ik0gMTIgMzUgTCAxOCA0MCBMIDI4IDI4IiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMyIgZmlsbD0ibm9uZSIvPgogIDwvZz4KPC9zdmc+
   ```

4. **Add Social Links & Website**
   - **Official Website**: https://nft-legal-service.netlify.app
   - **GitHub**: https://github.com/yourusername/NFTServiceApp
   - Add any other relevant links

5. **Email & Description**
   - Provide a contact email
   - Add detailed description of the NFT use case

6. **Submit for Review**
   - Click "Submit"
   - TronScan team will review (usually 1-3 business days)

### Additional Steps for Better Visibility:

1. **Verify Token Information**
   - After approval, go to your token page
   - Click "Update Token Information" if needed

2. **Add Token to DApp Browser**
   - Your NFTs will show in users' wallets after verification
   - Users can view their legal notices as NFTs

3. **Enable NFT Metadata**
   - Ensure your contract's `tokenURI` function returns proper metadata
   - Format: 
   ```json
   {
     "name": "Legal Notice #1234",
     "description": "Official legal notice served on blockchain",
     "image": "ipfs://QmXxx...",
     "attributes": [
       {"trait_type": "Notice Type", "value": "Summons"},
       {"trait_type": "Issuing Agency", "value": "Court Name"}
     ]
   }
   ```

### Checking Registration Status:

1. Visit: https://tronscan.org/#/contract/TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN
2. Look for "Token Tracker" section
3. Once approved, you'll see token information displayed

### Important Notes:

- Registration is free
- Approval typically takes 1-3 business days
- Make sure contract is verified (source code visible)
- NFTs will be visible in TronLink wallet after approval
- Users can view their legal notices as collectible NFTs

### For Process Server Branding:

Consider creating a collection page that shows:
- Total notices served
- Verification statistics  
- Agency partnerships
- Legal compliance information

This makes your legal notice NFTs more professional and trustworthy.