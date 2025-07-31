# Complete Legal Notice NFT System Flow

## What Recipients See and Experience:

### 1. **Initial NFT Receipt**
When a legal notice is served, the recipient receives:
- ✅ **An NFT in their wallet** (visible after adding contract or using v5 with enumerable)
- ✅ **2 TRX payment** to cover acceptance fees (if sponsor fees enabled)
- ❌ **NO memo with TRX** (TRON doesn't support memos on native TRX transfers)

### 2. **NFT Appearance in Wallet**
The NFT shows:
- ✅ **Sealed document thumbnail** with:
  - "SEALED" stamp
  - "ACTION REQUIRED" banner
  - Lock icon
  - Step-by-step instructions overlay
- ✅ **Detailed description** including:
  - How to access the document
  - Website URL
  - Legal implications
  - Warning about default judgment
- ✅ **Metadata attributes**:
  - Status: "Sealed - Signature Required"
  - Case type and number
  - Issuing agency
  - "Action Required" indicator

### 3. **Access Process**
When recipient clicks the NFT:
1. **"View on Website" link** takes them to: `https://nftserviceapp.netlify.app/#notice-{ID}`
2. They connect their wallet
3. They see notice details and "Accept Notice" button
4. Clicking "Accept" prompts wallet signature
5. After signing:
   - Document NFT transfers from contract to recipient
   - Encryption key is revealed
   - Document automatically decrypts and displays
   - Acceptance is recorded on blockchain

### 4. **The Two-NFT System**
Each notice creates TWO NFTs:
- **Alert NFT** (#5 in your test): 
  - Goes directly to recipient
  - Contains sealed thumbnail and instructions
  - Always visible in wallet
- **Document NFT** (#6 in your test):
  - Held by contract until accepted
  - Transfers to recipient upon acceptance
  - Contains the actual document access

## Current Limitations & Solutions:

### TRX Memo Issue:
**Problem**: Can't send memo with TRX transfers
**Current Solution**: All instructions are in the NFT metadata
**Alternative Options**:
1. Deploy a TRC10 token for notifications with memo support
2. Use wallet notification APIs (if available)
3. Email/SMS notifications (requires recipient info)

### Wallet Visibility:
**V4 Issue**: Manual contract import required
**V5 Solution**: Enumerable support = automatic visibility

### Instructions Clarity:
**Enhanced in V5**: 
- Thumbnail has instructions directly on image
- Description has step-by-step guide
- External URL clearly marked

## Complete Flow Summary:

1. **Server creates notice** → 
2. **Uploads sealed thumbnail + metadata to IPFS** →
3. **Mints NFT with IPFS metadata URI** →
4. **Recipient sees NFT with sealed image** →
5. **Image shows clear instructions** →
6. **Recipient follows link and signs** →
7. **Document decrypts and displays** →
8. **Blockchain records acceptance**

The system successfully delivers legal notices as NFTs with visual indicators and instructions, though without TRX memo capability.