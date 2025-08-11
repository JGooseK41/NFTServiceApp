/**
 * EMERGENCY FEE FIX
 * Prevents excessive fees and makes costs transparent
 * BLOCKS any transaction over $10 USD
 */

console.log('🚨 EMERGENCY FEE FIX LOADING...');

// Current TRX price (update as needed)
const TRX_PRICE_USD = 0.24; // Approximate current price
const MAX_ALLOWED_USD = 10; // Maximum allowed transaction in USD
const MAX_ALLOWED_TRX = MAX_ALLOWED_USD / TRX_PRICE_USD; // About 41 TRX

// CORRECT fee structure (from smart contract)
const CORRECT_FEES = {
    creationFee: 25, // 25 TRX for creating notice
    sponsorshipFee: 10, // 10 TRX per recipient if sponsoring
    energyRental: 88 // Typical energy rental cost
};

// Override ALL transaction sends to check fees
if (window.tronWeb) {
    const originalContract = window.tronWeb.contract;
    window.tronWeb.contract = function(...args) {
        const contract = originalContract.apply(this, args);
        
        // Intercept all contract methods
        const methods = ['serveNotice', 'serveNoticeBatch', 'createNotice', 'createBatchNotices'];
        
        methods.forEach(methodName => {
            if (contract[methodName]) {
                const original = contract[methodName];
                contract[methodName] = function(...methodArgs) {
                    const result = original.apply(this, methodArgs);
                    
                    // Intercept send
                    const originalSend = result.send;
                    result.send = async function(options) {
                        console.log('🔍 CHECKING TRANSACTION FEES...');
                        
                        // Check callValue
                        const callValueSUN = options.callValue || 0;
                        const callValueTRX = callValueSUN / 1_000_000;
                        const callValueUSD = callValueTRX * TRX_PRICE_USD;
                        
                        console.log('📊 TRANSACTION COST BREAKDOWN:');
                        console.log(`   Call Value: ${callValueTRX} TRX ($${callValueUSD.toFixed(2)} USD)`);
                        console.log(`   Fee Limit: ${(options.feeLimit / 1_000_000).toFixed(2)} TRX`);
                        
                        // BLOCK if too expensive
                        if (callValueTRX > MAX_ALLOWED_TRX) {
                            const errorMsg = `
🚫 TRANSACTION BLOCKED - TOO EXPENSIVE!

Requested: ${callValueTRX.toFixed(2)} TRX ($${callValueUSD.toFixed(2)} USD)
Maximum allowed: ${MAX_ALLOWED_TRX.toFixed(2)} TRX ($${MAX_ALLOWED_USD} USD)

This appears to be an error. The correct fees should be:
- Creation fee: 25 TRX
- Sponsorship fee: 10 TRX per recipient (if enabled)
- Total should be around $5-10 USD, NOT $${callValueUSD.toFixed(2)}!

TRANSACTION CANCELLED TO PROTECT YOUR FUNDS.
                            `.trim();
                            
                            alert(errorMsg);
                            console.error(errorMsg);
                            throw new Error('Transaction blocked - excessive fee detected');
                        }
                        
                        // Fix incorrect fees
                        if (callValueTRX > 100) {
                            console.warn('⚠️ Detected incorrect fee, auto-correcting...');
                            
                            // Calculate correct fee based on method
                            let correctFee = CORRECT_FEES.creationFee;
                            if (methodName.includes('Batch')) {
                                const recipientCount = methodArgs[0]?.length || 1;
                                const sponsorFees = methodArgs[0]?.[0]?.[8] || false;
                                correctFee = CORRECT_FEES.creationFee + 
                                           (sponsorFees ? CORRECT_FEES.sponsorshipFee * recipientCount : 0);
                            }
                            
                            options.callValue = correctFee * 1_000_000; // Convert to SUN
                            console.log(`✅ Corrected fee to ${correctFee} TRX`);
                        }
                        
                        // Show clear cost breakdown
                        const finalTRX = options.callValue / 1_000_000;
                        const finalUSD = finalTRX * TRX_PRICE_USD;
                        
                        const confirmMsg = `
📋 TRANSACTION SUMMARY:

Service: Create Legal Notice NFT
Cost: ${finalTRX} TRX ($${finalUSD.toFixed(2)} USD)

Do you want to proceed?
                        `.trim();
                        
                        if (!confirm(confirmMsg)) {
                            throw new Error('Transaction cancelled by user');
                        }
                        
                        return await originalSend.call(this, options);
                    };
                    
                    return result;
                };
            }
        });
        
        return contract;
    };
}

// Monitor and block energy rentals if transaction will fail
if (window.EnergyRental) {
    const originalRent = window.EnergyRental.rentFromJustLend;
    window.EnergyRental.rentFromJustLend = async function(energyNeeded, userAddress) {
        console.log('⚡ Energy rental requested...');
        
        // Check if we have a valid transaction ready
        if (!window.currentTransactionData) {
            console.warn('⚠️ No transaction data - blocking energy rental');
            alert('Please complete the notice form before renting energy.');
            return { success: false, error: 'No transaction ready' };
        }
        
        // Check fees are reasonable
        const data = window.currentTransactionData.data;
        const creationFee = parseFloat(data?.creationFee) || 0;
        
        if (creationFee > 100) {
            console.error('❌ BLOCKING ENERGY RENTAL - Fee calculation error detected');
            alert(`
⚠️ FEE ERROR DETECTED!

The system is trying to charge ${creationFee} TRX which is incorrect.
The correct fee should be 25 TRX.

Energy rental blocked to save your 88 TRX.
Please refresh the page and try again.
            `.trim());
            
            return { success: false, error: 'Fee calculation error' };
        }
        
        // Show energy rental cost
        const rentalCost = 88; // TRX
        const rentalUSD = rentalCost * TRX_PRICE_USD;
        
        if (!confirm(`
⚡ ENERGY RENTAL

Cost: ${rentalCost} TRX ($${rentalUSD.toFixed(2)} USD)
Purpose: Reduce transaction fees

Proceed with energy rental?
        `.trim())) {
            return { success: false, error: 'User cancelled' };
        }
        
        return await originalRent.call(this, energyNeeded, userAddress);
    };
}

// Add fee display to the UI
function addFeeDisplay() {
    const existingDisplay = document.getElementById('emergency-fee-display');
    if (existingDisplay) return;
    
    const display = document.createElement('div');
    display.id = 'emergency-fee-display';
    display.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #1a1a1a;
        border: 2px solid #00ff00;
        color: #00ff00;
        padding: 15px;
        border-radius: 5px;
        font-family: monospace;
        z-index: 100000;
        max-width: 300px;
    `;
    
    display.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">
            💰 FEE PROTECTION ACTIVE
        </div>
        <div style="font-size: 12px;">
            ✅ Max transaction: $${MAX_ALLOWED_USD} USD<br>
            ✅ Creation fee: 25 TRX (~$6)<br>
            ✅ Energy rental: 88 TRX (~$21)<br>
            ❌ Blocking fees over ${MAX_ALLOWED_TRX.toFixed(0)} TRX<br>
            <br>
            <span style="color: yellow;">
                ⚠️ If asked for $200+, it's an ERROR!<br>
                This system will block it.
            </span>
        </div>
    `;
    
    document.body.appendChild(display);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        display.style.opacity = '0.3';
    }, 10000);
}

// Initialize fee display when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFeeDisplay);
} else {
    addFeeDisplay();
}

console.log('✅ EMERGENCY FEE FIX ACTIVE!');
console.log('   🛡️ Blocking transactions over $10 USD');
console.log('   💰 Correct fees: 25 TRX creation + 10 TRX/recipient sponsorship');
console.log('   ⚡ Energy rental: 88 TRX');
console.log('   🚫 Will prevent $200+ transactions (those are ERRORS)');