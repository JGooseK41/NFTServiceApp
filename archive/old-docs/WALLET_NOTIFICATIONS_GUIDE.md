# Wallet Push Notification Implementation Guide

## Overview
Push notifications through wallet apps require integration with wallet providers or blockchain monitoring services.

## Approach 1: TronLink Notification API (If Available)

### Current Status
- TronLink automatically shows NFT received notifications
- No direct API for custom push notifications
- Limited to built-in NFT transfer alerts

### Potential Integration
```javascript
// If TronLink exposes notification API in future
const sendTronLinkNotification = async (address, message) => {
    // Would require API key from TronLink
    await tronlink.notifications.send({
        to: address,
        title: "Legal Notice Received",
        body: message,
        action: "View Notice",
        url: `https://nftserviceapp.netlify.app/#notice-${noticeId}`
    });
};
```

## Approach 2: Web3 Push Protocol Services

### Push Protocol (formerly EPNS)
- Decentralized notification protocol
- Supports multiple blockchains
- Users must opt-in to channels

```javascript
// Implementation with Push Protocol
import { PushAPI } from '@pushprotocol/restapi';

const sendPushNotification = async (recipientAddress, noticeId) => {
    const signer = await tronWeb.trx.sign();
    const userAlice = await PushAPI.initialize(signer, { env: 'prod' });
    
    await userAlice.channel.send([recipientAddress], {
        notification: {
            title: 'Legal Notice Received',
            body: `You have a new legal notice #${noticeId}`
        },
        payload: {
            title: 'Legal Notice - Action Required',
            body: 'Click to view and decrypt your legal document',
            cta: `https://nftserviceapp.netlify.app/#notice-${noticeId}`,
            img: ''
        }
    });
};
```

## Approach 3: Blockchain Event Monitoring Service

### Using services like Alchemy, Moralis, or QuickNode
```javascript
// Set up webhook for NFT transfers
const setupWebhook = async () => {
    const webhook = await alchemy.notify.createWebhook({
        url: "https://your-server.com/webhook",
        type: AlchemyWebhookType.NFT_TRANSFER,
        filters: [{
            contractAddress: LEGAL_NOTICE_CONTRACT,
            toAddress: recipientAddress
        }]
    });
};

// Webhook handler on your server
app.post('/webhook', async (req, res) => {
    const { toAddress, tokenId } = req.body;
    
    // Send push notification via:
    // - Email (SendGrid, AWS SES)
    // - SMS (Twilio)
    // - Push Protocol
    // - Telegram Bot
    
    await sendNotificationToUser(toAddress, tokenId);
});
```

## Approach 4: Telegram Integration

### Most Practical Current Solution
```javascript
// Users link their wallet to Telegram bot
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(token, {polling: true});

// Registration flow
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        "Welcome! Please send your TRON wallet address to receive notifications."
    );
});

bot.onText(/^T[A-Za-z1-9]{33}$/, async (msg, match) => {
    const walletAddress = match[0];
    const chatId = msg.chat.id;
    
    // Store mapping
    await db.saveUserNotificationPreference({
        address: walletAddress,
        telegramChatId: chatId,
        enabled: true
    });
    
    bot.sendMessage(chatId, "✅ Wallet linked! You'll receive notifications here.");
});

// Send notification when notice created
const notifyViaTelegram = async (recipientAddress, noticeId) => {
    const user = await db.getUserByAddress(recipientAddress);
    if (user?.telegramChatId) {
        await bot.sendMessage(user.telegramChatId, 
            `🔔 Legal Notice Received!\n\n` +
            `Notice ID: #${noticeId}\n\n` +
            `View your notice: https://nftserviceapp.netlify.app/#notice-${noticeId}`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: "View Notice", url: `https://nftserviceapp.netlify.app/#notice-${noticeId}` }
                    ]]
                }
            }
        );
    }
};
```

## Approach 5: Progressive Web App (PWA) Notifications

### Browser-based push notifications
```javascript
// In the main app
const enablePushNotifications = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
        
        // Save subscription to backend
        await saveSubscription(tronWeb.defaultAddress.base58, subscription);
    }
};

// Service worker (sw.js)
self.addEventListener('push', event => {
    const data = event.data.json();
    
    self.registration.showNotification('Legal Notice Received', {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: { url: data.url }
    });
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
```

## Implementation Recommendations

### Phase 1: Telegram Bot (Quickest)
1. Create Telegram bot for notifications
2. Add "Link Telegram" option in app settings
3. Store wallet-to-telegram mappings
4. Send notifications on notice creation

### Phase 2: Push Protocol Integration
1. Create Push Protocol channel
2. Add opt-in UI in app
3. Send decentralized notifications
4. Works across multiple wallets

### Phase 3: PWA Notifications
1. Convert app to PWA
2. Implement service worker
3. Add push notification opt-in
4. Works on mobile and desktop

### Phase 4: Webhook Monitoring
1. Set up blockchain monitoring
2. Create notification server
3. Integrate multiple channels
4. Most comprehensive solution

## Smart Contract Event Emission

```solidity
// Already implemented in contract
event NoticeCreated(uint256 indexed noticeId, address indexed recipient, address indexed sender);

// Could add notification preferences
mapping(address => NotificationPrefs) public notificationPrefs;

struct NotificationPrefs {
    bool emailEnabled;
    bool smsEnabled;
    bool telegramEnabled;
    string encryptedContact; // Encrypted email/phone
}
```

## Privacy Considerations

1. **No Personal Data On-Chain**: Never store emails/phones on blockchain
2. **Opt-In Only**: Users must explicitly enable notifications
3. **Encrypted Storage**: Encrypt contact info in off-chain database
4. **Minimal Data**: Notifications should not reveal document contents
5. **Secure Channels**: Use HTTPS/TLS for all communications

## Cost Estimates

- **Telegram Bot**: Free (hosting costs only)
- **Push Protocol**: Gas fees for channel creation
- **PWA**: Free (hosting costs only)  
- **Webhook Service**: $50-500/month depending on volume
- **SMS (Twilio)**: $0.0075 per SMS
- **Email (SendGrid)**: Free up to 100 emails/day

## Recommended Starting Point

1. **Implement Telegram Bot** (1-2 days)
   - Easiest to implement
   - No additional costs
   - High delivery rate
   - Users already familiar with Telegram

2. **Add PWA Support** (3-5 days)
   - Works on all devices
   - No third-party dependencies
   - Native-like experience

3. **Integrate Push Protocol** (1 week)
   - Decentralized solution
   - Cross-wallet compatibility
   - Web3-native approach