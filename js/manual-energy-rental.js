/**
 * MANUAL ENERGY RENTAL MODULE
 * Rent energy BEFORE transactions from reliable marketplaces
 * Shows exactly how much energy you're getting
 */

console.log('⚡ Loading Manual Energy Rental Module...');

window.ManualEnergyRental = {
    
    // Known energy rental services with duration options
    RENTAL_SERVICES: {
        TRON_PULSE: {
            name: 'TronPulse Energy',
            url: 'https://energy.tronpulse.io',
            contract: 'TQAg2T2vJcHAX9TVT2KTVgdJsBDPLWQpwF',
            minOrder: 100000,
            durations: ['1 hour', '3 hours', '1 day', '3 days'],
            pricing: {
                '1h': 0.000020,  // TRX per energy unit
                '3h': 0.000025,
                '1d': 0.000030,
                '3d': 0.000035
            },
            note: 'Cheaper for short rentals'
        },
        TOKEN_GOODIES: {
            name: 'Token Goodies',
            url: 'https://www.tokengoodies.com',
            contract: 'TKTDrPMFhJXHxvRvKsQM6BfR4K7Y6EkGNa',
            minOrder: 100000,
            durations: ['1 day', '3 days', '7 days', '14 days'],
            pricing: {
                '1d': 0.000028,
                '3d': 0.000032,
                '7d': 0.000038,
                '14d': 0.000045
            },
            note: 'Good for medium-term rentals'
        },
        FEEE_ENERGY: {
            name: 'Feee.io',
            url: 'https://www.feee.io',
            contract: 'TZ7KbNNTa3vnet4KLjEeWWBhNgFWcJmXEe',
            minOrder: 65000,
            durations: ['1 hour', '6 hours', '1 day', '3 days', '7 days'],
            pricing: {
                '1h': 0.000018,
                '6h': 0.000022,
                '1d': 0.000025,
                '3d': 0.000030,
                '7d': 0.000035
            },
            note: 'Cheapest for quick transactions'
        },
        TRON_STATION: {
            name: 'TronStation (Official)',
            url: 'https://www.tronstation.io',
            contract: 'TPjGUuQfq6R3FMBmsacd6Z5dvAgrD2rz5n',
            minOrder: 32000,
            durations: ['1 day', '3 days', '7 days', '30 days'],
            pricing: {
                '1d': 0.000032,
                '3d': 0.000038,
                '7d': 0.000045,
                '30d': 0.000060
            },
            note: 'Official TRON service, most reliable'
        }
    },
    
    // Check current energy status with detailed breakdown
    async checkEnergyStatus() {
        console.log('📊 Checking detailed energy status...');
        
        try {
            const address = window.tronWeb.defaultAddress.base58;
            
            // Get account info
            const account = await window.tronWeb.trx.getAccount(address);
            const resources = await window.tronWeb.trx.getAccountResources(address);
            
            // Calculate different energy sources
            const ownedEnergy = resources.EnergyLimit || 0;
            const usedEnergy = resources.EnergyUsed || 0;
            const availableOwned = Math.max(0, ownedEnergy - usedEnergy);
            
            // Check for delegated energy (from rentals)
            const delegatedEnergy = resources.DelegatedEnergyLimit || 0;
            const delegatedUsed = resources.DelegatedEnergyUsed || 0;
            const availableDelegated = Math.max(0, delegatedEnergy - delegatedUsed);
            
            // Total available
            const totalAvailable = availableOwned + availableDelegated;
            
            // Get bandwidth too
            const bandwidth = resources.NetLimit || 0;
            const bandwidthUsed = resources.NetUsed || 0;
            const availableBandwidth = Math.max(0, bandwidth - bandwidthUsed);
            
            const status = {
                energy: {
                    owned: availableOwned,
                    delegated: availableDelegated,
                    total: totalAvailable,
                    used: usedEnergy + delegatedUsed
                },
                bandwidth: {
                    available: availableBandwidth,
                    used: bandwidthUsed
                },
                frozen: {
                    energy: account.frozen_supply_balance || 0,
                    bandwidth: account.frozen_balance || 0
                }
            };
            
            console.log('📊 Energy Breakdown:');
            console.log(`  Owned Energy: ${status.energy.owned.toLocaleString()}`);
            console.log(`  Delegated Energy: ${status.energy.delegated.toLocaleString()}`);
            console.log(`  Total Available: ${status.energy.total.toLocaleString()}`);
            console.log(`  Bandwidth: ${status.bandwidth.available.toLocaleString()}`);
            
            return status;
            
        } catch (error) {
            console.error('Error checking energy:', error);
            return null;
        }
    },
    
    // Calculate how much energy is needed for transaction
    calculateEnergyNeeded(documentSizeMB = 0, recipientCount = 1) {
        // Base energy for smart contract call
        const baseEnergy = 400000;
        
        // Energy for document storage (rough estimate)
        const documentBytes = documentSizeMB * 1024 * 1024;
        const storageEnergy = Math.floor(documentBytes * 2.5);
        
        // Energy per recipient in batch
        const recipientEnergy = recipientCount * 50000;
        
        // Total with some buffer
        const total = Math.floor((baseEnergy + storageEnergy + recipientEnergy) * 1.1);
        
        console.log('⚡ Energy Calculation:');
        console.log(`  Base: ${baseEnergy.toLocaleString()}`);
        console.log(`  Storage (${documentSizeMB}MB): ${storageEnergy.toLocaleString()}`);
        console.log(`  Recipients (${recipientCount}): ${recipientEnergy.toLocaleString()}`);
        console.log(`  Total Needed: ${total.toLocaleString()}`);
        
        return total;
    },
    
    // Get rental recommendations with duration options
    async getRentalRecommendations(energyNeeded, preferredDuration = '1h') {
        const status = await this.checkEnergyStatus();
        const currentEnergy = status?.energy?.total || 0;
        const deficit = Math.max(0, energyNeeded - currentEnergy);
        
        if (deficit === 0) {
            return {
                needsRental: false,
                message: '✅ You have sufficient energy!'
            };
        }
        
        const recommendations = [];
        
        for (const [key, service] of Object.entries(this.RENTAL_SERVICES)) {
            const unitsToRent = Math.max(service.minOrder, deficit);
            
            // Calculate costs for different durations
            const durationOptions = [];
            for (const [duration, pricePerUnit] of Object.entries(service.pricing)) {
                const cost = unitsToRent * pricePerUnit;
                durationOptions.push({
                    duration,
                    cost: cost.toFixed(2),
                    costUSD: (cost * 0.24).toFixed(2),
                    pricePerUnit
                });
            }
            
            // Find best price for immediate use (1 hour or 1 day)
            const shortTermOption = durationOptions.find(d => d.duration === '1h') || 
                                   durationOptions.find(d => d.duration === '1d') || 
                                   durationOptions[0];
            
            recommendations.push({
                service: service.name,
                url: service.url,
                units: unitsToRent,
                note: service.note,
                bestPrice: shortTermOption,
                allDurations: durationOptions
            });
        }
        
        // Sort by best short-term price
        recommendations.sort((a, b) => parseFloat(a.bestPrice.cost) - parseFloat(b.bestPrice.cost));
        
        return {
            needsRental: true,
            deficit,
            currentEnergy,
            energyNeeded,
            recommendations
        };
    },
    
    // Create rental UI
    createRentalUI() {
        // Remove existing UI
        const existing = document.getElementById('energy-rental-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'energy-rental-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            background: linear-gradient(135deg, #1a1a2e, #0f0f1e);
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 20px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 10000;
            box-shadow: 0 0 20px rgba(0,255,0,0.3);
        `;
        
        panel.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #00ff00;">⚡ Energy Management</h3>
            
            <div style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <div id="energy-status">Checking energy...</div>
            </div>
            
            <div style="margin: 15px 0;">
                <label style="display: block; margin-bottom: 5px;">Document Size (MB):</label>
                <input type="number" id="doc-size-input" value="2.5" step="0.1" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid #00ff00;
                    color: white;
                    border-radius: 3px;
                ">
            </div>
            
            <div style="margin: 15px 0;">
                <label style="display: block; margin-bottom: 5px;">Number of Recipients:</label>
                <input type="number" id="recipient-count-input" value="3" min="1" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid #00ff00;
                    color: white;
                    border-radius: 3px;
                ">
            </div>
            
            <button onclick="ManualEnergyRental.calculateAndShowRental()" style="
                width: 100%;
                padding: 10px;
                background: linear-gradient(135deg, #00ff00, #00aa00);
                color: black;
                border: none;
                border-radius: 5px;
                font-weight: bold;
                cursor: pointer;
                margin: 10px 0;
            ">
                📊 Calculate Energy Needs
            </button>
            
            <div id="rental-recommendations" style="
                display: none;
                background: rgba(0,0,0,0.5);
                padding: 10px;
                border-radius: 5px;
                margin-top: 15px;
            "></div>
            
            <button onclick="ManualEnergyRental.checkEnergyStatus().then(s => ManualEnergyRental.updateStatusDisplay(s))" style="
                width: 100%;
                padding: 8px;
                background: #444;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 10px;
            ">
                🔄 Refresh Status
            </button>
            
            <button onclick="document.getElementById('energy-rental-panel').style.display='none'" style="
                width: 100%;
                padding: 8px;
                background: #aa0000;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 5px;
            ">
                ❌ Close
            </button>
        `;
        
        document.body.appendChild(panel);
        
        // Initial status check
        this.checkEnergyStatus().then(status => this.updateStatusDisplay(status));
    },
    
    // Update status display
    updateStatusDisplay(status) {
        const statusDiv = document.getElementById('energy-status');
        if (!statusDiv) return;
        
        if (!status) {
            statusDiv.innerHTML = '❌ Unable to check energy';
            return;
        }
        
        const energyColor = status.energy.total > 1000000 ? '#00ff00' : 
                           status.energy.total > 500000 ? '#ffff00' : '#ff0000';
        
        statusDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <div style="color: #888; font-size: 0.9em;">Owned Energy</div>
                    <div style="color: ${energyColor}; font-weight: bold;">
                        ${status.energy.owned.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div style="color: #888; font-size: 0.9em;">Delegated</div>
                    <div style="color: #00ffff; font-weight: bold;">
                        ${status.energy.delegated.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div style="color: #888; font-size: 0.9em;">Total Available</div>
                    <div style="color: ${energyColor}; font-size: 1.2em; font-weight: bold;">
                        ${status.energy.total.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div style="color: #888; font-size: 0.9em;">Bandwidth</div>
                    <div style="color: #ffff00; font-weight: bold;">
                        ${status.bandwidth.available.toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Calculate and show rental options
    async calculateAndShowRental() {
        const docSize = parseFloat(document.getElementById('doc-size-input').value) || 0;
        const recipients = parseInt(document.getElementById('recipient-count-input').value) || 1;
        
        const energyNeeded = this.calculateEnergyNeeded(docSize, recipients);
        const recommendations = await this.getRentalRecommendations(energyNeeded);
        
        const recDiv = document.getElementById('rental-recommendations');
        recDiv.style.display = 'block';
        
        if (!recommendations.needsRental) {
            recDiv.innerHTML = `
                <div style="color: #00ff00; text-align: center; font-weight: bold;">
                    ✅ ${recommendations.message}
                </div>
            `;
            return;
        }
        
        let html = `
            <h4 style="color: #ff0000; margin: 0 0 10px 0;">⚠️ Energy Rental Needed</h4>
            <div style="margin-bottom: 10px;">
                <div>Current: ${recommendations.currentEnergy.toLocaleString()}</div>
                <div>Needed: ${recommendations.energyNeeded.toLocaleString()}</div>
                <div style="color: #ff0000;">Deficit: ${recommendations.deficit.toLocaleString()}</div>
            </div>
            <h4 style="color: #00ff00; margin: 10px 0;">💰 Rental Options:</h4>
        `;
        
        for (const rec of recommendations.recommendations) {
            html += `
                <div style="
                    background: rgba(0,255,0,0.1);
                    padding: 10px;
                    margin: 5px 0;
                    border-radius: 5px;
                    border: 1px solid #00ff00;
                ">
                    <div style="font-weight: bold;">${rec.service}</div>
                    <div style="font-size: 0.8em; color: #aaa; margin: 2px 0;">${rec.note}</div>
                    <div style="font-size: 0.9em; margin: 5px 0;">
                        ${rec.units.toLocaleString()} energy needed
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin: 5px 0;">
                        ${rec.allDurations.map(d => `
                            <div style="background: rgba(255,255,255,0.05); padding: 3px 5px; border-radius: 3px; font-size: 0.85em;">
                                <strong>${d.duration}:</strong> ${d.cost} TRX
                            </div>
                        `).join('')}
                    </div>
                    <div style="color: #ffff00; font-size: 0.9em; margin: 5px 0;">
                        💡 Best for quick use: ${rec.bestPrice.duration} = ${rec.bestPrice.cost} TRX
                    </div>
                    <a href="${rec.url}" target="_blank" style="
                        display: inline-block;
                        margin-top: 5px;
                        color: #00ffff;
                        text-decoration: none;
                        font-size: 0.9em;
                    ">🔗 Rent from ${rec.service} →</a>
                </div>
            `;
        }
        
        html += `
            <div style="
                margin-top: 15px;
                padding: 10px;
                background: rgba(255,255,0,0.1);
                border: 1px solid #ffff00;
                border-radius: 5px;
            ">
                <strong>💡 How to Rent:</strong><br>
                1. Click a rental service link<br>
                2. Enter your wallet address<br>
                3. Rent ${recommendations.deficit.toLocaleString()} energy<br>
                4. Wait 10-30 seconds<br>
                5. Click "Refresh Status" to verify
            </div>
        `;
        
        recDiv.innerHTML = html;
    },
    
    // Initialize
    init() {
        console.log('⚡ Manual Energy Rental Module initialized');
        
        // Add button to show panel
        const btn = document.createElement('button');
        btn.innerHTML = '⚡ Energy Manager';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #00ff00, #00aa00);
            color: black;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            z-index: 9999;
            box-shadow: 0 0 10px rgba(0,255,0,0.5);
        `;
        
        btn.onclick = () => this.createRentalUI();
        document.body.appendChild(btn);
        
        // Check energy on load
        this.checkEnergyStatus().then(status => {
            if (status?.energy?.total < 500000) {
                console.warn('⚠️ Low energy detected! Click "⚡ Energy Manager" to rent energy.');
                this.createRentalUI();
            }
        });
    }
};

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ManualEnergyRental.init());
} else {
    ManualEnergyRental.init();
}

console.log('✅ Manual Energy Rental Module loaded');
console.log('Click "⚡ Energy Manager" button to manage energy');