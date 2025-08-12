/**
 * ENERGY GUIDE & EDUCATION
 * Helps users understand what energy is and why rental saves money
 */

console.log('📚 Loading Energy Education Guide...');

window.EnergyGuide = {
    
    // Create the educational help button and modal
    createGuideUI() {
        // Remove existing guide if any
        const existing = document.getElementById('energy-guide-modal');
        if (existing) existing.remove();
        
        // Create guide modal
        const modal = document.createElement('div');
        modal.id = 'energy-guide-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 100000;
            display: none;
            overflow-y: auto;
            padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="
                max-width: 800px;
                margin: 0 auto;
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                border-radius: 15px;
                padding: 30px;
                color: white;
                font-family: Arial, sans-serif;
                position: relative;
            ">
                <button onclick="document.getElementById('energy-guide-modal').style.display='none'" style="
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    cursor: pointer;
                    font-size: 18px;
                ">×</button>
                
                <h1 style="color: #00ff88; margin-bottom: 30px; text-align: center;">
                    ⚡ Understanding TRON Energy & Why Rental Saves You Money
                </h1>
                
                <!-- What is Energy -->
                <div style="background: rgba(0,255,136,0.1); border-left: 4px solid #00ff88; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #00ff88; margin-top: 0;">🔋 What is Energy?</h2>
                    <p style="line-height: 1.6;">
                        Energy is like <strong>gas for your car</strong> - you need it to run smart contracts on TRON. 
                        Every transaction that interacts with a smart contract (like creating NFTs) requires energy.
                    </p>
                    <ul style="line-height: 1.8;">
                        <li>📝 <strong>Simple TRX transfer</strong>: Uses bandwidth (free daily allowance)</li>
                        <li>🤖 <strong>Smart contract interaction</strong>: Uses energy (not free)</li>
                        <li>📄 <strong>NFT with documents</strong>: Uses LOTS of energy (data storage)</li>
                    </ul>
                </div>
                
                <!-- The Problem -->
                <div style="background: rgba(255,68,68,0.1); border-left: 4px solid #ff4444; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #ff4444; margin-top: 0;">⚠️ The Expensive Problem</h2>
                    <p style="line-height: 1.6;">
                        When you don't have energy, TRON <strong>burns your TRX</strong> to pay for it:
                    </p>
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <div style="font-size: 1.2em; margin: 10px 0;">
                            📊 <strong>Your Recent Transaction Example:</strong>
                        </div>
                        <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; margin: 10px 0;">
                            <span>Documents:</span><span style="color: #ffaa00;">2.5 MB (3 files)</span>
                            <span>Energy Needed:</span><span style="color: #ff4444;">2,400,000 energy</span>
                            <span>Burn Cost:</span><span style="color: #ff0000; font-weight: bold;">486 TRX ($117 USD)</span>
                        </div>
                    </div>
                    <p style="color: #ffaa00; font-weight: bold;">
                        💸 That's like paying $117 in gas fees for a single transaction!
                    </p>
                </div>
                
                <!-- The Solution -->
                <div style="background: rgba(0,255,0,0.1); border-left: 4px solid #00ff00; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #00ff00; margin-top: 0;">✅ The Smart Solution: Energy Rental</h2>
                    <p style="line-height: 1.6;">
                        Instead of burning TRX, you can <strong>rent energy</strong> for a fraction of the cost:
                    </p>
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <div style="font-size: 1.2em; margin: 10px 0;">
                            💰 <strong>Cost Comparison for 2.4M Energy:</strong>
                        </div>
                        <table style="width: 100%; margin: 10px 0;">
                            <tr>
                                <td style="padding: 8px;">❌ Burning TRX:</td>
                                <td style="color: #ff4444; font-weight: bold; text-align: right;">486 TRX ($117)</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px;">✅ Renting (1 hour):</td>
                                <td style="color: #00ff00; font-weight: bold; text-align: right;">43 TRX ($10)</td>
                            </tr>
                            <tr style="background: rgba(0,255,0,0.2);">
                                <td style="padding: 8px; font-weight: bold;">💵 YOU SAVE:</td>
                                <td style="color: #00ff88; font-weight: bold; font-size: 1.2em; text-align: right;">443 TRX ($107)</td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- How It Works -->
                <div style="background: rgba(0,150,255,0.1); border-left: 4px solid #0096ff; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #0096ff; margin-top: 0;">🔧 How Energy Rental Works</h2>
                    <ol style="line-height: 1.8;">
                        <li><strong>Energy Marketplaces</strong> have frozen TRX that generates energy</li>
                        <li>They <strong>delegate</strong> this energy to your wallet temporarily</li>
                        <li>You use the energy for your transaction</li>
                        <li>After the rental period (1 hour - 30 days), it returns to them</li>
                        <li>You save 80-90% compared to burning TRX!</li>
                    </ol>
                </div>
                
                <!-- Simple Steps -->
                <div style="background: rgba(255,215,0,0.1); border-left: 4px solid #ffd700; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #ffd700; margin-top: 0;">📋 Simple Steps to Save Money</h2>
                    <ol style="line-height: 2;">
                        <li>📊 Click <strong>"⚡ Energy Manager"</strong> button</li>
                        <li>📝 Enter your document size (in MB)</li>
                        <li>👥 Enter number of recipients</li>
                        <li>💡 Click <strong>"Calculate Energy Needs"</strong></li>
                        <li>🛒 Choose a marketplace and rental duration:
                            <ul style="margin: 10px 0;">
                                <li><strong>1 hour</strong>: For immediate single transaction</li>
                                <li><strong>1 day</strong>: For multiple transactions today</li>
                                <li><strong>3-7 days</strong>: For ongoing work</li>
                            </ul>
                        </li>
                        <li>⚡ Rent the energy (takes 10-30 seconds)</li>
                        <li>✅ Complete your transaction!</li>
                    </ol>
                </div>
                
                <!-- FAQ -->
                <div style="background: rgba(128,0,255,0.1); border-left: 4px solid #8000ff; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #8000ff; margin-top: 0;">❓ Common Questions</h2>
                    
                    <div style="margin: 15px 0;">
                        <h3 style="color: #aa88ff;">Q: Is energy rental safe?</h3>
                        <p>✅ Yes! It's built into TRON's protocol. The energy is delegated to your wallet - you control it.</p>
                    </div>
                    
                    <div style="margin: 15px 0;">
                        <h3 style="color: #aa88ff;">Q: What if I rent too much energy?</h3>
                        <p>No problem! Unused energy just sits in your wallet until the rental expires. Better to have extra than not enough.</p>
                    </div>
                    
                    <div style="margin: 15px 0;">
                        <h3 style="color: #aa88ff;">Q: Can I get energy for free?</h3>
                        <p>You can freeze your own TRX to generate energy (1 TRX = ~1,500 energy after 3 days), but you'd need to freeze 1,600 TRX to get 2.4M energy!</p>
                    </div>
                    
                    <div style="margin: 15px 0;">
                        <h3 style="color: #aa88ff;">Q: Why don't other blockchains need this?</h3>
                        <p>TRON separates bandwidth and energy to keep simple transfers cheap/free. Complex operations need energy. Ethereum just charges high gas for everything.</p>
                    </div>
                </div>
                
                <!-- Real Example -->
                <div style="background: linear-gradient(135deg, rgba(0,255,0,0.1), rgba(0,255,255,0.1)); border: 2px solid #00ffaa; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #00ffaa; margin-top: 0;">💡 Real-World Example</h2>
                    <p style="font-size: 1.1em; line-height: 1.6;">
                        <strong>Legal Notice with 3 PDF documents (2.5 MB total) to 3 recipients:</strong>
                    </p>
                    <table style="width: 100%; margin: 15px 0; font-size: 1.05em;">
                        <tr style="background: rgba(255,0,0,0.1);">
                            <td style="padding: 10px;">❌ <strong>Without Energy Rental:</strong></td>
                            <td style="text-align: right; padding: 10px;">
                                <div>Base Fee: 15 TRX</div>
                                <div>Energy Burn: 486 TRX</div>
                                <div style="color: #ff4444; font-weight: bold;">Total: 501 TRX ($120)</div>
                            </td>
                        </tr>
                        <tr style="background: rgba(0,255,0,0.1);">
                            <td style="padding: 10px;">✅ <strong>With Energy Rental:</strong></td>
                            <td style="text-align: right; padding: 10px;">
                                <div>Base Fee: 15 TRX</div>
                                <div>1-Hour Rental: 43 TRX</div>
                                <div style="color: #00ff88; font-weight: bold;">Total: 58 TRX ($14)</div>
                            </td>
                        </tr>
                    </table>
                    <p style="text-align: center; font-size: 1.3em; color: #00ff88; font-weight: bold; margin: 20px 0;">
                        🎉 You save $106 on a single transaction!
                    </p>
                </div>
                
                <!-- Call to Action -->
                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="document.getElementById('energy-guide-modal').style.display='none'; ManualEnergyRental.createRentalUI();" style="
                        background: linear-gradient(135deg, #00ff88, #00aaff);
                        color: black;
                        border: none;
                        padding: 15px 30px;
                        font-size: 1.2em;
                        font-weight: bold;
                        border-radius: 8px;
                        cursor: pointer;
                        box-shadow: 0 4px 15px rgba(0,255,136,0.3);
                    ">
                        ⚡ Open Energy Manager Now
                    </button>
                    <p style="margin-top: 15px; color: #aaa;">
                        Don't waste money burning TRX - rent energy instead!
                    </p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    // Create help button
    createHelpButton() {
        // Remove existing button if any
        const existing = document.getElementById('energy-help-btn');
        if (existing) existing.remove();
        
        const helpBtn = document.createElement('button');
        helpBtn.id = 'energy-help-btn';
        helpBtn.innerHTML = '❓ What is Energy?';
        helpBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 180px;
            background: linear-gradient(135deg, #8000ff, #0096ff);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            z-index: 9998;
            box-shadow: 0 0 10px rgba(128,0,255,0.5);
            transition: all 0.3s;
        `;
        
        helpBtn.onmouseover = () => {
            helpBtn.style.transform = 'scale(1.05)';
            helpBtn.style.boxShadow = '0 0 20px rgba(128,0,255,0.8)';
        };
        
        helpBtn.onmouseout = () => {
            helpBtn.style.transform = 'scale(1)';
            helpBtn.style.boxShadow = '0 0 10px rgba(128,0,255,0.5)';
        };
        
        helpBtn.onclick = () => {
            const modal = document.getElementById('energy-guide-modal');
            if (modal) {
                modal.style.display = 'block';
            } else {
                this.createGuideUI();
                document.getElementById('energy-guide-modal').style.display = 'block';
            }
        };
        
        document.body.appendChild(helpBtn);
    },
    
    // Show contextual help based on current energy status
    async showContextualHelp() {
        if (!window.ManualEnergyRental) return;
        
        const status = await window.ManualEnergyRental.checkEnergyStatus();
        if (!status) return;
        
        const totalEnergy = status.energy.total;
        
        // If user has very low energy, show a warning
        if (totalEnergy < 100000) {
            const warning = document.createElement('div');
            warning.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #ff4444, #ff8800);
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                font-weight: bold;
                z-index: 10001;
                box-shadow: 0 4px 20px rgba(255,68,68,0.5);
                cursor: pointer;
            `;
            warning.innerHTML = `
                ⚠️ Low Energy Alert! You have ${totalEnergy.toLocaleString()} energy.
                Document transactions will cost you 400+ TRX in burns!
                Click here to learn how to save money →
            `;
            warning.onclick = () => {
                warning.remove();
                document.getElementById('energy-guide-modal').style.display = 'block';
            };
            
            document.body.appendChild(warning);
            
            // Auto-remove after 10 seconds
            setTimeout(() => warning.remove(), 10000);
        }
    },
    
    // Initialize - DISABLED to prevent auto-popup
    init() {
        console.log('📚 Energy Guide loaded (auto-help disabled)');
        
        // DISABLED - Don't create UI elements automatically
        // Energy help is now integrated into the transaction flow
        
        // Keep the guide available for manual calls if needed
        // but don't show any contextual help automatically
    }
};

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => EnergyGuide.init());
} else {
    EnergyGuide.init();
}

console.log('✅ Energy Guide loaded - Click "❓ What is Energy?" for help');