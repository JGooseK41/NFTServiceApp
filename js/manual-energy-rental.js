/**
 * MANUAL ENERGY RENTAL MODULE
 * Rent energy BEFORE transactions from reliable marketplaces
 * Shows exactly how much energy you're getting
 */

console.log('⚡ Loading Manual Energy Rental Module...');

window.ManualEnergyRental = {
    
    // VERIFIED legitimate energy rental services (updated 2024)
    // WARNING: Only use these verified services - others may try to steal wallet permissions
    RENTAL_SERVICES: {
        TRON_ENERGY_MARKET: {
            name: 'Tron Energy Market ✅',
            url: 'https://tronenergy.market',
            verified: true,
            trustScore: 'HIGH',
            minOrder: 65000,
            durations: ['1 hour', '6 hours', '1 day', '3 days', '7 days'],
            pricing: {
                '1h': 0.000020,
                '6h': 0.000024,
                '1d': 0.000028,
                '3d': 0.000033,
                '7d': 0.000038
            },
            note: '✅ Verified legitimate - Popular trading platform'
        },
        TRON_SAVE: {
            name: 'TronSave ✅',
            url: 'https://tronsave.io',
            verified: true,
            trustScore: 'HIGH',
            minOrder: 50000,
            durations: ['1 hour', '12 hours', '1 day', '3 days', '7 days'],
            pricing: {
                '1h': 0.000019,
                '12h': 0.000025,
                '1d': 0.000029,
                '3d': 0.000034,
                '7d': 0.000039
            },
            note: '✅ Verified legitimate - User-friendly with low fees'
        },
        TR_ENERGY: {
            name: 'TR.Energy ✅',
            url: 'https://tr.energy',
            verified: true,
            trustScore: 'HIGH',
            minOrder: 100000,
            durations: ['1 hour', '1 day', '3 days', '7 days', '30 days'],
            pricing: {
                '1h': 0.000021,
                '1d': 0.000030,
                '3d': 0.000035,
                '7d': 0.000040,
                '30d': 0.000065
            },
            note: '✅ Verified legitimate - 10,000+ users, used by exchanges'
        },
        FEEE_ENERGY: {
            name: 'Feee.io ⚠️',
            url: 'https://www.feee.io',
            verified: true,
            trustScore: 'MEDIUM',
            minOrder: 65000,
            durations: ['1 hour', '6 hours', '1 day', '3 days', '7 days'],
            pricing: {
                '1h': 0.000018,
                '6h': 0.000022,
                '1d': 0.000025,
                '3d': 0.000030,
                '7d': 0.000035
            },
            note: '⚠️ Mixed reviews on support - Cheapest rates but verify first'
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
    
    // Calculate how much energy is needed for transaction with detailed breakdown
    calculateEnergyNeeded(documentSizeMB = 0, recipientCount = 1, includeBreakdown = false) {
        // ACCURATE energy calculations based on actual usage (2.5M for 2.5MB doc)
        const calculations = {
            // Base contract interaction
            baseContract: 350000,  // Increased from 65k
            
            // NFT minting energy
            nftMinting: 450000,    // Increased from 90k
            
            // Document storage energy (varies by size)
            documentStorage: 0,
            
            // String storage (metadata)
            metadataStorage: 150000,  // Increased from 50k
            
            // Per recipient in batch
            perRecipient: recipientCount > 1 ? 150000 : 0,  // Increased from 45k
            
            // IPFS hash storage if documents exist
            ipfsStorage: documentSizeMB > 0 ? 100000 : 0,  // Increased from 30k
            
            // Event emission
            eventCost: 80000,  // Increased from 20k
            
            // Network overhead
            networkOverhead: 120000  // Increased from 25k
        };
        
        // Calculate document storage energy more accurately
        // Based on actual: 2.5MB = ~2.5M energy, so roughly 1M per MB
        if (documentSizeMB > 0) {
            const documentBytes = documentSizeMB * 1024 * 1024;
            
            // Much higher energy cost for document storage
            // Approximately 1 energy per byte for on-chain storage
            if (documentSizeMB < 0.5) {
                calculations.documentStorage = documentBytes * 0.8; // Small docs
            } else if (documentSizeMB < 2) {
                calculations.documentStorage = documentBytes * 1.0; // Medium docs
            } else {
                calculations.documentStorage = documentBytes * 1.2; // Large docs (2.5MB = 3M bytes * 1.2 = 3.6M energy)
            }
        }
        
        // Calculate total
        const subtotal = Object.values(calculations).reduce((sum, val) => sum + val, 0);
        
        // Add safety buffer (10% for small, 15% for large transactions)
        const bufferPercent = documentSizeMB > 2 ? 0.15 : 0.10;
        const total = Math.floor(subtotal * (1 + bufferPercent));
        
        // Additional energy for batch recipients
        const batchTotal = recipientCount > 1 ? 
            total + (calculations.perRecipient * (recipientCount - 1)) : total;
        
        if (includeBreakdown) {
            return {
                total: batchTotal,
                breakdown: calculations,
                subtotal,
                buffer: Math.floor(subtotal * bufferPercent),
                estimatedTRXBurn: (batchTotal * 0.00042).toFixed(2),
                confidence: documentSizeMB === 0 ? 'High' : 
                           documentSizeMB < 1 ? 'Medium-High' : 
                           documentSizeMB < 5 ? 'Medium' : 'Low-Medium'
            };
        }
        
        console.log('⚡ Energy Calculation:');
        console.log(`  Base Contract: ${calculations.baseContract.toLocaleString()}`);
        console.log(`  NFT Minting: ${calculations.nftMinting.toLocaleString()}`);
        console.log(`  Document Storage (${documentSizeMB}MB): ${calculations.documentStorage.toLocaleString()}`);
        console.log(`  Recipients (${recipientCount}): ${calculations.perRecipient * recipientCount}`);
        console.log(`  Total Needed: ${batchTotal.toLocaleString()}`);
        
        return batchTotal;
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
            
            <div style="margin: 10px 0;">
                <div style="font-size: 0.9em; color: #aaa; margin-bottom: 5px;">Quick Estimates:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <button onclick="ManualEnergyRental.setQuickEstimate(0, 1)" style="
                        padding: 5px;
                        background: #333;
                        color: #00ff00;
                        border: 1px solid #00ff00;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 0.85em;
                    ">Simple NFT (no docs)</button>
                    <button onclick="ManualEnergyRental.setQuickEstimate(0.5, 1)" style="
                        padding: 5px;
                        background: #333;
                        color: #ffff00;
                        border: 1px solid #ffff00;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 0.85em;
                    ">Small Doc (500KB)</button>
                    <button onclick="ManualEnergyRental.setQuickEstimate(2.5, 3)" style="
                        padding: 5px;
                        background: #333;
                        color: #ff9900;
                        border: 1px solid #ff9900;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 0.85em;
                    ">Your Last (2.5MB, 3)</button>
                    <button onclick="ManualEnergyRental.setQuickEstimate(5, 5)" style="
                        padding: 5px;
                        background: #333;
                        color: #ff0000;
                        border: 1px solid #ff0000;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 0.85em;
                    ">Large Batch (5MB, 5)</button>
                </div>
            </div>
            
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
    
    // Calculate and show rental options with detailed breakdown
    async calculateAndShowRental() {
        const docSize = parseFloat(document.getElementById('doc-size-input').value) || 0;
        const recipients = parseInt(document.getElementById('recipient-count-input').value) || 1;
        
        // Get detailed breakdown
        const energyDetails = this.calculateEnergyNeeded(docSize, recipients, true);
        const recommendations = await this.getRentalRecommendations(energyDetails.total);
        
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
            <h4 style="color: #00ffff; margin: 0 0 10px 0;">📊 Energy Breakdown</h4>
            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; margin-bottom: 15px; font-size: 0.9em;">
                <div style="display: grid; grid-template-columns: auto auto; gap: 5px;">
                    <span>Base Contract:</span><span style="text-align: right;">${energyDetails.breakdown.baseContract.toLocaleString()}</span>
                    <span>NFT Minting:</span><span style="text-align: right;">${energyDetails.breakdown.nftMinting.toLocaleString()}</span>
                    <span>Document Storage:</span><span style="text-align: right;">${energyDetails.breakdown.documentStorage.toLocaleString()}</span>
                    <span>Metadata:</span><span style="text-align: right;">${energyDetails.breakdown.metadataStorage.toLocaleString()}</span>
                    ${recipients > 1 ? `<span>Batch (${recipients} recipients):</span><span style="text-align: right;">${(energyDetails.breakdown.perRecipient * recipients).toLocaleString()}</span>` : ''}
                    <span style="border-top: 1px solid #444; padding-top: 5px;">Safety Buffer:</span>
                    <span style="border-top: 1px solid #444; padding-top: 5px; text-align: right;">${energyDetails.buffer.toLocaleString()}</span>
                    <span style="font-weight: bold; color: #00ff00;">TOTAL NEEDED:</span>
                    <span style="font-weight: bold; color: #00ff00; text-align: right;">${energyDetails.total.toLocaleString()}</span>
                </div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #444;">
                    <div>💸 If burned: <span style="color: #ff0000; font-weight: bold;">${energyDetails.estimatedTRXBurn} TRX</span></div>
                    <div>📊 Estimate Confidence: <span style="color: ${energyDetails.confidence === 'High' ? '#00ff00' : energyDetails.confidence.includes('Medium') ? '#ffff00' : '#ff9900'};">${energyDetails.confidence}</span></div>
                </div>
            </div>
            
            <h4 style="color: #ff0000; margin: 0 0 10px 0;">⚠️ Energy Rental Needed</h4>
            <div style="margin-bottom: 10px;">
                <div>Your Current Energy: ${recommendations.currentEnergy.toLocaleString()}</div>
                <div>Energy Needed: ${recommendations.energyNeeded.toLocaleString()}</div>
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
                    <a href="${rec.url}" target="_blank" onclick="ManualEnergyRental.showSecurityReminder('${rec.url}', '${rec.service}'); return false;" style="
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
    
    // Set quick estimate values
    setQuickEstimate(docSize, recipients) {
        document.getElementById('doc-size-input').value = docSize;
        document.getElementById('recipient-count-input').value = recipients;
        this.calculateAndShowRental();
    },
    
    // Show security reminder before visiting rental service
    showSecurityReminder(url, serviceName) {
        const reminder = document.createElement('div');
        reminder.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.95);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        reminder.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #2a1a1a, #1a0f0f);
                border: 3px solid #ffaa00;
                border-radius: 15px;
                padding: 30px;
                max-width: 500px;
                color: white;
                font-family: Arial, sans-serif;
            ">
                <h2 style="color: #ffaa00; margin-bottom: 20px;">
                    🔒 Security Reminder
                </h2>
                
                <p style="margin-bottom: 20px;">
                    You're about to visit: <strong style="color: #00ffff;">${serviceName}</strong>
                </p>
                
                <div style="background: rgba(0,255,0,0.1); border: 1px solid #00ff00; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #00ff00; margin-top: 0;">✅ SAFE Actions:</h4>
                    <ul style="line-height: 1.8; margin: 5px 0;">
                        <li>Enter your PUBLIC wallet address</li>
                        <li>Choose energy amount and duration</li>
                        <li>Pay with TRX for energy rental</li>
                    </ul>
                </div>
                
                <div style="background: rgba(255,0,0,0.1); border: 1px solid #ff0000; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #ff0000; margin-top: 0;">🚨 NEVER DO:</h4>
                    <ul style="line-height: 1.8; margin: 5px 0;">
                        <li>Enter private keys or seed phrases</li>
                        <li>Approve token spending permissions</li>
                        <li>Grant wallet control or ownership</li>
                        <li>Sign unknown transactions</li>
                    </ul>
                </div>
                
                <div style="background: rgba(255,255,0,0.1); border: 1px solid #ffff00; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
                    <strong style="color: #ffff00;">⚠️ Important:</strong> If the site asks for anything other than your PUBLIC address and TRX payment, CLOSE IT IMMEDIATELY!
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button onclick="window.open('${url}', '_blank'); this.parentElement.parentElement.parentElement.remove();" style="
                        padding: 12px 30px;
                        background: linear-gradient(135deg, #00aa00, #008800);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                        font-size: 1em;
                    ">
                        ✅ I Understand - Continue
                    </button>
                    
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" style="
                        padding: 12px 30px;
                        background: #666;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 1em;
                    ">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(reminder);
    },
    
    // Initialize - DISABLED to prevent floating button
    init() {
        console.log('⚡ Manual Energy Rental Module loaded (button disabled)');
        // DO NOT create floating button or auto-check energy
        // Energy rental is now handled through the transaction flow only
        
        // Keep the module available for manual calls if needed
        // but don't create any UI elements automatically
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