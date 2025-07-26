const TronWeb = require('tronweb');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    // Your contract address on Nile testnet
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS_HERE',
    
    // Nile testnet configuration
    NILE_FULLNODE: 'https://nile.trongrid.io',
    NILE_SOLIDITYNODE: 'https://nile.trongrid.io',
    NILE_EVENTSERVER: 'https://nile.trongrid.io',
    
    // Faucet URL
    FAUCET_URL: 'https://nileex.io/api/faucet',
    
    // Log file
    LOG_FILE: path.join(__dirname, 'faucet-requests.log'),
    
    // Minimum balance threshold (in TRX) - request when below this
    MIN_BALANCE_THRESHOLD: 10000,
    
    // Amount to request from faucet (usually fixed by faucet)
    FAUCET_AMOUNT: 10000 // 10,000 TRX typical for Nile faucet
};

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: CONFIG.NILE_FULLNODE,
    headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
});

// Logging function
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
    
    console.log(logMessage.trim());
    
    // Append to log file
    fs.appendFileSync(CONFIG.LOG_FILE, logMessage);
}

// Check contract balance
async function checkBalance(address) {
    try {
        const balance = await tronWeb.trx.getBalance(address);
        const balanceInTRX = tronWeb.fromSun(balance);
        return parseFloat(balanceInTRX);
    } catch (error) {
        log(`Error checking balance: ${error.message}`, 'error');
        return 0;
    }
}

// Request TRX from faucet
async function requestFromFaucet(address) {
    try {
        log(`Requesting TRX from faucet for address: ${address}`);
        
        // Different faucets have different APIs, this is a common pattern
        const response = await axios.post(CONFIG.FAUCET_URL, {
            address: address
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000 // 30 second timeout
        });
        
        if (response.data && response.data.success) {
            log(`Successfully requested ${CONFIG.FAUCET_AMOUNT} TRX from faucet`, 'success');
            return true;
        } else {
            log(`Faucet request failed: ${JSON.stringify(response.data)}`, 'error');
            return false;
        }
    } catch (error) {
        // Handle rate limiting
        if (error.response && error.response.status === 429) {
            log('Faucet rate limit reached. Will retry in next cycle.', 'warning');
        } else {
            log(`Error requesting from faucet: ${error.message}`, 'error');
        }
        return false;
    }
}

// Alternative faucet implementation for nileex.io
async function requestFromNileExFaucet(address) {
    try {
        log(`Requesting TRX from NileEx faucet for address: ${address}`);
        
        // NileEx faucet might require visiting the website
        // This is a placeholder - actual implementation depends on faucet API
        const response = await axios.get(`https://nileex.io/join/getJoinPage`, {
            params: { address: address },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        log('Faucet request sent. Check balance in a few minutes.', 'info');
        return true;
    } catch (error) {
        log(`Error with NileEx faucet: ${error.message}`, 'error');
        return false;
    }
}

// Main function to check and request TRX
async function checkAndRequestTRX() {
    try {
        log('Starting automated faucet check...');
        
        // Check current balance
        const currentBalance = await checkBalance(CONFIG.CONTRACT_ADDRESS);
        log(`Current contract balance: ${currentBalance} TRX`);
        
        // Check if we need to request TRX
        if (currentBalance < CONFIG.MIN_BALANCE_THRESHOLD) {
            log(`Balance below threshold (${CONFIG.MIN_BALANCE_THRESHOLD} TRX), requesting from faucet...`);
            
            // Try primary faucet method
            let success = await requestFromFaucet(CONFIG.CONTRACT_ADDRESS);
            
            // If primary fails, try alternative
            if (!success) {
                log('Primary faucet failed, trying alternative...', 'warning');
                success = await requestFromNileExFaucet(CONFIG.CONTRACT_ADDRESS);
            }
            
            if (success) {
                // Wait a bit and check new balance
                setTimeout(async () => {
                    const newBalance = await checkBalance(CONFIG.CONTRACT_ADDRESS);
                    log(`New balance after faucet request: ${newBalance} TRX`);
                }, 30000); // Check after 30 seconds
            }
        } else {
            log(`Balance sufficient, no faucet request needed.`);
        }
        
    } catch (error) {
        log(`Unexpected error in main function: ${error.message}`, 'error');
    }
}

// Manual trigger function
async function manualRequest() {
    log('Manual faucet request triggered');
    await checkAndRequestTRX();
}

// Start the automated process
function start() {
    log('Starting Nile Testnet Auto-Faucet Service', 'info');
    log(`Monitoring contract: ${CONFIG.CONTRACT_ADDRESS}`);
    log(`Balance threshold: ${CONFIG.MIN_BALANCE_THRESHOLD} TRX`);
    log(`Schedule: Every 24 hours at 00:00`);
    
    // Run immediately on start
    checkAndRequestTRX();
    
    // Schedule to run every 24 hours at midnight
    cron.schedule('0 0 * * *', () => {
        log('Scheduled faucet check triggered');
        checkAndRequestTRX();
    });
    
    // Also check every 6 hours in case of failures
    cron.schedule('0 */6 * * *', () => {
        log('Backup faucet check triggered');
        checkAndRequestTRX();
    });
    
    log('Auto-faucet service is running. Press Ctrl+C to stop.');
}

// Export functions for external use
module.exports = {
    checkBalance,
    requestFromFaucet,
    checkAndRequestTRX,
    manualRequest
};

// Run if called directly
if (require.main === module) {
    // Check if contract address is provided
    if (CONFIG.CONTRACT_ADDRESS === 'YOUR_CONTRACT_ADDRESS_HERE') {
        console.error('Please set CONTRACT_ADDRESS environment variable or update the config.');
        process.exit(1);
    }
    
    // Handle process termination
    process.on('SIGINT', () => {
        log('Shutting down auto-faucet service...', 'info');
        process.exit(0);
    });
    
    // Start the service
    start();
}