# Recipient Notification & Access Guide

## How Recipients Are Notified and Access Documents

### 1. Primary Notification - NFT in Wallet
- Recipients receive an NFT in their TRON wallet
- NFT name: Custom name set by sender (e.g., "Court Summons #12345")
- NFT description: "LEGAL NOTICE - ACTION REQUIRED | View at: https://nftserviceapp.netlify.app/#notice-[ID]"
- Visible in TronLink wallet and on Tronscan

### 2. Direct Access Link
The NFT contains a direct link that:
- Takes recipient directly to the app with the notice ID
- Shows instructions on how to view their notice
- Auto-highlights their specific notice

### 3. Access Process
1. Recipient clicks link from NFT or navigates to app
2. Connects their wallet (must be same address that received NFT)
3. Goes to "My Notices" tab
4. Sees their notice highlighted
5. Clicks "Accept & View" to decrypt and view document

### 4. Additional Notification Methods (Future)

#### Email Notifications (Optional)
- Process servers could collect email during service
- Send notification with link to app
- Email would NOT contain sensitive documents

#### SMS Notifications (Optional)
- Similar to email but via text message
- Contains link to app

#### QR Code on Physical Service
- If physical service is also performed
- QR code links to specific notice in app

### 5. Security & Privacy
- Documents remain encrypted until accepted
- Only the recipient's wallet can decrypt
- Acceptance is recorded on blockchain
- Sender cannot see if/when document is viewed

### 6. Wallet Notification Features
- TronLink shows NFT received notification
- Most wallets notify users of new NFTs
- NFT appears in "Collectibles" or "NFTs" section

### 7. Implementation Status
- ✅ NFT with direct link in description
- ✅ Direct link handling in app
- ✅ Auto-highlight specific notice
- ✅ Welcome modal for recipients
- ⏳ Email notifications (planned)
- ⏳ SMS notifications (planned)
- ⏳ QR codes (planned)

### 8. Best Practices for Process Servers
1. Inform recipients to check their wallet
2. Provide app URL: https://nftserviceapp.netlify.app
3. Explain the NFT will appear in their wallet
4. Note they need their wallet to decrypt documents

### 9. Fallback Access
If recipient loses the direct link:
1. Go to https://nftserviceapp.netlify.app
2. Connect wallet
3. Click "My Notices" tab
4. Find notice by ID or date
5. Accept & view document