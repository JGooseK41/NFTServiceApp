// Telegram Bot for Legal Notice Notifications
// This would run on a separate server

const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require('mongodb');
const TronWeb = require('tronweb');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const TRON_FULL_HOST = 'https://nile.trongrid.io';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// Initialize
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const tronWeb = new TronWeb({ fullHost: TRON_FULL_HOST });
let db;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI, { useUnifiedTopology: true })
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db('legalnotices');
    });

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const message = 
`Welcome to Legal Notice Notifications! 🔔

To receive notifications when you get legal notices:

1. Send me your TRON wallet address
2. I'll notify you when you receive a legal notice
3. You'll get a direct link to view the notice

Your wallet address should start with 'T' and be 34 characters long.

Example: TAbcdef123456789012345678901234567`;
    
    bot.sendMessage(chatId, message);
});

// Handle wallet address
bot.onText(/^T[A-Za-z1-9]{33}$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const walletAddress = match[0];
    
    try {
        // Validate address
        if (!tronWeb.isAddress(walletAddress)) {
            bot.sendMessage(chatId, '❌ Invalid TRON address. Please check and try again.');
            return;
        }
        
        // Save to database
        await db.collection('users').updateOne(
            { address: walletAddress },
            {
                $set: {
                    telegramChatId: chatId,
                    telegramUsername: msg.from.username,
                    enabled: true,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        
        bot.sendMessage(chatId, 
            `✅ Success! Your wallet is now linked.

` +
            `Address: \`${walletAddress}\`

` +
            `You'll receive notifications here when legal notices are sent to this address.

` +
            `Commands:
` +
            `/status - Check your notification status
` +
            `/stop - Stop notifications
` +
            `/help - Get help`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('Error saving user:', error);
        bot.sendMessage(chatId, '❌ An error occurred. Please try again later.');
    }
});

// Status command
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const user = await db.collection('users').findOne({ telegramChatId: chatId });
        
        if (user) {
            bot.sendMessage(chatId,
                `📊 Your Notification Status

` +
                `Wallet: \`${user.address}\`
` +
                `Notifications: ${user.enabled ? '✅ Enabled' : '❌ Disabled'}
` +
                `Linked since: ${user.createdAt.toLocaleDateString()}`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, 'You haven\'t linked a wallet yet. Send me your TRON address to get started!');
        }
    } catch (error) {
        bot.sendMessage(chatId, '❌ Error checking status.');
    }
});

// Stop notifications
bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        await db.collection('users').updateOne(
            { telegramChatId: chatId },
            { $set: { enabled: false } }
        );
        
        bot.sendMessage(chatId, '🔕 Notifications disabled. Use /start to re-enable.');
    } catch (error) {
        bot.sendMessage(chatId, '❌ Error disabling notifications.');
    }
});

// Function to send notification (called by webhook)
async function sendNotification(recipientAddress, noticeId, noticeType) {
    try {
        const user = await db.collection('users').findOne({ 
            address: recipientAddress,
            enabled: true 
        });
        
        if (user && user.telegramChatId) {
            const message = 
`🔔 *Legal Notice Received!*

📋 Notice ID: #${noticeId}
📑 Type: ${noticeType}
👤 Recipient: \`${recipientAddress}\`

⚠️ *Action Required*
You have received an encrypted legal document that requires your attention.

🔐 The document is encrypted and only you can decrypt it with your wallet.

Click below to view your notice:`;
            
            await bot.sendMessage(user.telegramChatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: '📄 View Notice', 
                            url: `https://nftserviceapp.netlify.app/#notice-${noticeId}` 
                        }
                    ]]
                }
            });
            
            console.log(`Notification sent to ${recipientAddress} for notice ${noticeId}`);
        }
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

// Export for webhook integration
module.exports = { sendNotification };

// Blockchain event monitoring (separate process)
const monitorBlockchain = async () => {
    const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
    
    // Watch for NoticeCreated events
    contract.NoticeCreated().watch((err, event) => {
        if (err) {
            console.error('Error in event watcher:', err);
            return;
        }
        
        if (event && event.result) {
            const { noticeId, recipient, sender } = event.result;
            console.log(`New notice created: ${noticeId} for ${recipient}`);
            
            // Send notification
            sendNotification(recipient, noticeId, 'Legal Notice');
        }
    });
};

// Start monitoring if running standalone
if (require.main === module) {
    monitorBlockchain();
    console.log('Legal Notice Telegram Bot is running...');
}