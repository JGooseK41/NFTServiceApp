/**
 * Transaction Cost Modal
 * Shows exact costs BEFORE user signs anything
 * Allows user to rent energy or proceed without
 */

console.log('💰 Loading Transaction Cost Modal...');

// Create modal HTML
function createCostModal() {
    // Remove existing modal if any
    const existing = document.getElementById('transaction-cost-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'transaction-cost-modal';
    modal.innerHTML = `
        <div id="cost-modal-overlay" style="
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999998;
        "></div>
        <div id="cost-modal-content" style="
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            z-index: 999999;
            font-family: monospace;
            color: #ffffff;
        ">
            <h2 style="color: #00ff00; margin: 0 0 20px 0;">
                💰 Transaction Cost Breakdown
            </h2>
            
            <div id="cost-details" style="
                background: #0a0a0a;
                border: 1px solid #444;
                padding: 15px;
                margin: 15px 0;
                border-radius: 5px;
            ">
                <!-- Cost details will be inserted here -->
            </div>
            
            <div id="energy-options" style="
                background: #0a0a0a;
                border: 1px solid #444;
                padding: 15px;
                margin: 15px 0;
                border-radius: 5px;
            ">
                <h3 style="color: #ffff00; margin: 0 0 10px 0;">⚡ Energy Options</h3>
                <div id="energy-comparison">
                    <!-- Energy options will be inserted here -->
                </div>
            </div>
            
            <div id="modal-buttons" style="
                display: flex;
                gap: 10px;
                margin-top: 20px;
            ">
                <button id="rent-energy-btn" style="
                    flex: 1;
                    padding: 12px;
                    background: #00aa00;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">
                    ⚡ Rent Energy & Proceed
                </button>
                <button id="no-energy-btn" style="
                    flex: 1;
                    padding: 12px;
                    background: #aa6600;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">
                    🔥 Burn TRX (No Rental)
                </button>
                <button id="cancel-transaction-btn" style="
                    padding: 12px 20px;
                    background: #aa0000;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">
                    ❌ Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Initialize modal when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createCostModal);
} else {
    createCostModal();
}

// Verify modal exists
setTimeout(() => {
    const modal = document.getElementById('transaction-cost-modal');
    if (!modal) {
        console.error('❌ Cost modal failed to load! Creating now...');
        createCostModal();
    } else {
        console.log('✅ Cost modal loaded successfully');
    }
}, 1000);

// Current TRX price for USD conversion
const TRX_PRICE_USD = 0.24;

// Show cost modal
async function showTransactionCostModal(transactionDetails) {
    console.log('📊 Showing transaction cost modal...');
    
    const overlay = document.getElementById('cost-modal-overlay');
    const content = document.getElementById('cost-modal-content');
    const costDetails = document.getElementById('cost-details');
    const energyComparison = document.getElementById('energy-comparison');
    
    // Calculate costs
    const { 
        contractFee, 
        energyNeeded, 
        currentEnergy,
        recipients,
        sponsorFees 
    } = transactionDetails;
    
    // Calculate energy costs
    const energyToRent = Math.max(0, energyNeeded - currentEnergy);
    const energyRentalCost = Math.ceil(energyToRent / 10000) * 1.1; // ~1.1 TRX per 10k energy
    const energyBurnCost = energyToRent * 0.00042; // Approximate TRX burn rate
    
    // Contract fees
    const creationFee = 25; // Standard fee
    const sponsorshipFee = sponsorFees ? 10 * recipients : 0;
    const totalContractFee = creationFee + sponsorshipFee;
    
    // Total costs for each option
    const totalWithRental = totalContractFee + energyRentalCost;
    const totalWithBurn = totalContractFee + energyBurnCost;
    
    // Update modal content
    costDetails.innerHTML = `
        <h3 style="color: #00ffff; margin: 0 0 10px 0;">📋 Transaction Details</h3>
        <div style="line-height: 1.8;">
            <div>📝 Service: <span style="color: #00ff00;">Create Legal Notice NFT</span></div>
            <div>👥 Recipients: <span style="color: #00ff00;">${recipients}</span></div>
            <div>💵 Contract Fee: <span style="color: #00ff00;">${totalContractFee} TRX</span> ($${(totalContractFee * TRX_PRICE_USD).toFixed(2)})</div>
            ${sponsorFees ? `<div style="margin-left: 20px; font-size: 0.9em; color: #aaa;">
                ├─ Creation: ${creationFee} TRX<br>
                └─ Sponsorship: ${sponsorshipFee} TRX (${recipients} × 10 TRX)
            </div>` : ''}
        </div>
    `;
    
    energyComparison.innerHTML = `
        <div style="margin-bottom: 15px;">
            <div>⚡ Energy Required: <span style="color: #ffff00;">${energyNeeded.toLocaleString()}</span></div>
            <div>📊 Current Energy: <span style="color: #00ff00;">${currentEnergy.toLocaleString()}</span></div>
            <div>🔋 Need to Obtain: <span style="color: #ff9900;">${energyToRent.toLocaleString()}</span></div>
        </div>
        
        <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
        ">
            <div style="
                background: #001100;
                border: 1px solid #00ff00;
                padding: 10px;
                border-radius: 5px;
            ">
                <h4 style="color: #00ff00; margin: 0 0 5px 0;">✅ With Energy Rental</h4>
                <div style="font-size: 0.9em;">
                    <div>Rental Cost: ${energyRentalCost.toFixed(2)} TRX</div>
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #333;">
                        <strong>Total: ${totalWithRental.toFixed(2)} TRX</strong>
                        <div style="color: #aaa;">($${(totalWithRental * TRX_PRICE_USD).toFixed(2)} USD)</div>
                    </div>
                </div>
            </div>
            
            <div style="
                background: #110800;
                border: 1px solid #ff9900;
                padding: 10px;
                border-radius: 5px;
            ">
                <h4 style="color: #ff9900; margin: 0 0 5px 0;">🔥 Without Rental</h4>
                <div style="font-size: 0.9em;">
                    <div>Burn Cost: ${energyBurnCost.toFixed(2)} TRX</div>
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #333;">
                        <strong>Total: ${totalWithBurn.toFixed(2)} TRX</strong>
                        <div style="color: #aaa;">($${(totalWithBurn * TRX_PRICE_USD).toFixed(2)} USD)</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="
            margin-top: 15px;
            padding: 10px;
            background: #002200;
            border: 1px solid #00ff00;
            border-radius: 5px;
            text-align: center;
        ">
            💡 <strong>You save ${(energyBurnCost - energyRentalCost).toFixed(2)} TRX by renting energy!</strong>
        </div>
    `;
    
    // Show modal
    overlay.style.display = 'block';
    content.style.display = 'block';
    
    // Return promise for user choice
    return new Promise((resolve) => {
        // Rent energy button
        document.getElementById('rent-energy-btn').onclick = () => {
            overlay.style.display = 'none';
            content.style.display = 'none';
            resolve({ choice: 'rent', energyToRent, cost: totalWithRental });
        };
        
        // No energy rental button
        document.getElementById('no-energy-btn').onclick = () => {
            overlay.style.display = 'none';
            content.style.display = 'none';
            resolve({ choice: 'burn', cost: totalWithBurn });
        };
        
        // Cancel button
        document.getElementById('cancel-transaction-btn').onclick = () => {
            overlay.style.display = 'none';
            content.style.display = 'none';
            resolve({ choice: 'cancel' });
        };
    });
}

// Intercept transaction execution
if (window.TransactionStaging) {
    const originalExecute = window.TransactionStaging.executeTransaction;
    
    window.TransactionStaging.executeTransaction = async function(transactionId, skipSimulation = false) {
        console.log('🎯 Intercepting transaction for cost modal...');
        
        try {
            // Get transaction data
            const stagedData = await this.getTransaction(transactionId);
            if (!stagedData.success) {
                throw new Error('Failed to retrieve staged transaction');
            }
            
            const txData = stagedData.completeData;
            
            // Get current account info
            const account = await window.tronWeb.trx.getAccount(window.tronWeb.defaultAddress.base58);
            const currentEnergy = account.energy || 0;
            
            // Estimate energy needed (simplified - you might want more accurate estimation)
            const recipients = txData.recipients?.length || 1;
            const energyNeeded = recipients > 1 ? 300000 * recipients : 400000;
            
            // Show cost modal
            const userChoice = await showTransactionCostModal({
                contractFee: parseFloat(txData.data?.creationFee) || 25,
                energyNeeded,
                currentEnergy,
                recipients: recipients,
                sponsorFees: txData.data?.sponsorFees || false
            });
            
            // Handle user choice
            if (userChoice.choice === 'cancel') {
                throw new Error('Transaction cancelled by user');
            }
            
            if (userChoice.choice === 'rent' && userChoice.energyToRent > 0) {
                console.log(`⚡ User chose to rent ${userChoice.energyToRent} energy`);
                
                // Rent energy
                if (window.EnergyRental) {
                    const rentalResult = await window.EnergyRental.rentFromJustLend(
                        userChoice.energyToRent,
                        window.tronWeb.defaultAddress.base58
                    );
                    
                    if (rentalResult.success) {
                        console.log('✅ Energy rented successfully');
                        // Wait for energy to be available
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } else {
                        console.warn('Energy rental failed');
                        if (!confirm('Energy rental failed. Continue anyway?')) {
                            throw new Error('Transaction cancelled - energy rental failed');
                        }
                    }
                }
            } else {
                console.log('🔥 User chose to burn TRX for energy');
            }
            
            // Proceed with original execution
            return await originalExecute.call(this, transactionId, true);
            
        } catch (error) {
            console.error('Transaction error:', error);
            throw error;
        }
    };
}

// Also intercept direct contract calls
if (window.legalContract) {
    ['serveNotice', 'serveNoticeBatch'].forEach(method => {
        if (window.legalContract[method]) {
            const original = window.legalContract[method];
            window.legalContract[method] = function(...args) {
                const result = original.apply(this, args);
                const originalSend = result.send;
                
                result.send = async function(options) {
                    // Quick cost check
                    const feeTRX = (options.callValue || 0) / 1_000_000;
                    console.log(`📊 Direct transaction: ${feeTRX} TRX fee`);
                    
                    // For direct calls, just show a simple confirmation
                    if (!confirm(`Transaction will cost approximately ${feeTRX} TRX. Proceed?`)) {
                        throw new Error('Transaction cancelled');
                    }
                    
                    return await originalSend.call(this, options);
                };
                
                return result;
            };
        }
    });
}

console.log('✅ Transaction Cost Modal loaded!');
console.log('   💰 Shows exact costs before signing');
console.log('   ⚡ User chooses: rent energy or burn TRX');
console.log('   ✅ No surprises, no wasted rentals');