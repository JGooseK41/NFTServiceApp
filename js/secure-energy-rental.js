/**
 * SECURE ENERGY RENTAL WITH CONTRACT VALIDATION
 * Protects users from malicious contracts trying to steal wallet permissions
 * Only lists verified legitimate energy rental services
 */

console.log('🔒 Loading Secure Energy Rental Module...');

window.SecureEnergyRental = {
    
    // VERIFIED legitimate energy rental services (as of 2024)
    VERIFIED_SERVICES: {
        TOKEN_GOODIES: {
            name: 'Token Goodies',
            url: 'https://www.tokengoodies.com',
            description: 'Established TRON energy marketplace with active user base',
            verified: true,
            trustScore: 'HIGH',
            minOrder: 100000,
            durations: ['1 day', '3 days', '7 days', '14 days', '28 days'],
            pricing: {
                '1d': 0.000028,
                '3d': 0.000032,
                '7d': 0.000038,
                '14d': 0.000045,
                '28d': 0.000055
            },
            note: 'High demand - orders fill quickly',
            warnings: []
        },
        TRON_ENERGY_MARKET: {
            name: 'Tron Energy Market',
            url: 'https://tronenergy.market',
            description: 'Popular energy trading platform',
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
            note: 'Good for all rental durations',
            warnings: []
        },
        TRON_SAVE: {
            name: 'TronSave',
            url: 'https://tronsave.io',
            description: 'User-friendly interface with competitive rates',
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
            note: 'Low fees and easy to use',
            warnings: []
        },
        TR_ENERGY: {
            name: 'TR.Energy',
            url: 'https://tr.energy',
            description: 'Market leader with 10,000+ active users',
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
            note: 'Used by major exchanges and swap platforms',
            warnings: []
        },
        FEEE_IO: {
            name: 'Feee.io',
            url: 'https://www.feee.io',
            description: 'Competitive pricing but mixed reviews on support',
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
            note: 'Cheapest rates but check recent reviews',
            warnings: ['Some users report slow customer support']
        }
    },
    
    // Known malicious contract methods that steal permissions
    DANGEROUS_METHODS: [
        'approve',           // Gives spending approval
        'setApprovalForAll', // Gives full control
        'transferOwnership', // Transfers ownership
        'delegateCall',      // Can execute arbitrary code
        'suicide',           // Can destroy contract
        'selfdestruct',      // Can destroy contract
        'changeOwner',       // Changes ownership
        'changeAdmin',       // Changes admin rights
        'setOperator',       // Sets operator permissions
        'grantRole',         // Grants roles/permissions
        'addMinter',         // Adds minting permissions
        'addPauser',         // Adds pausing permissions
        'renounceOwnership', // Removes owner (locks funds)
    ],
    
    // Safe energy rental methods
    SAFE_METHODS: [
        'rentEnergy',
        'delegateResource',
        'freezeBalance',
        'unfreezeBalance',
        'buyEnergy',
        'orderEnergy',
        'leaseEnergy'
    ],
    
    /**
     * Check if a transaction is trying to steal wallet permissions
     */
    async checkTransactionSafety(transaction) {
        console.log('🔍 Checking transaction safety...');
        
        const warnings = [];
        const criticalIssues = [];
        
        try {
            // Check if transaction exists
            if (!transaction) {
                return {
                    safe: false,
                    critical: ['No transaction data provided'],
                    warnings: []
                };
            }
            
            // Extract function signature if available
            const functionName = transaction.function_name || 
                                transaction.contract?.method || 
                                transaction.raw_data?.contract?.[0]?.parameter?.value?.function_selector;
            
            if (functionName) {
                // Check for dangerous methods
                for (const dangerous of this.DANGEROUS_METHODS) {
                    if (functionName.toLowerCase().includes(dangerous.toLowerCase())) {
                        criticalIssues.push(`🚨 DANGER: Transaction wants to call "${dangerous}" - This could give away control of your wallet!`);
                    }
                }
                
                // Check if it's a known safe method
                let isSafeMethod = false;
                for (const safe of this.SAFE_METHODS) {
                    if (functionName.toLowerCase().includes(safe.toLowerCase())) {
                        isSafeMethod = true;
                        break;
                    }
                }
                
                if (!isSafeMethod && criticalIssues.length === 0) {
                    warnings.push(`⚠️ Unknown method: "${functionName}" - Verify this is for energy rental only`);
                }
            }
            
            // Check transaction value
            const value = transaction.raw_data?.contract?.[0]?.parameter?.value?.call_value || 
                         transaction.call_value || 
                         0;
            
            if (value > 1000 * 1_000_000) { // More than 1000 TRX
                warnings.push(`⚠️ Large transaction value: ${value / 1_000_000} TRX - Verify this amount is correct`);
            }
            
            // Check if trying to interact with token contracts
            if (transaction.to_address) {
                const knownTokenContracts = [
                    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT
                    'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR', // USDC
                    'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7', // WIN
                    'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S'  // SUN
                ];
                
                if (knownTokenContracts.includes(transaction.to_address)) {
                    criticalIssues.push(`🚨 DANGER: Transaction targets a token contract! This is NOT energy rental!`);
                }
            }
            
            // Check for multi-sig or time-locked contracts
            if (transaction.raw_data?.expiration) {
                const expiration = transaction.raw_data.expiration;
                const now = Date.now();
                const expirationTime = new Date(expiration);
                
                if (expirationTime - now > 24 * 60 * 60 * 1000) { // More than 24 hours
                    warnings.push(`⚠️ Long expiration time: ${expirationTime.toLocaleString()} - Could be used later without your knowledge`);
                }
            }
            
        } catch (error) {
            console.error('Error checking transaction safety:', error);
            warnings.push('⚠️ Could not fully verify transaction safety');
        }
        
        return {
            safe: criticalIssues.length === 0,
            critical: criticalIssues,
            warnings: warnings
        };
    },
    
    /**
     * Show security warning dialog
     */
    showSecurityWarning(safetyCheck, callback) {
        const dialog = document.createElement('div');
        dialog.id = 'security-warning-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const content = `
            <div style="
                background: linear-gradient(135deg, #2a1a1a, #1a0f0f);
                border: 3px solid ${safetyCheck.safe ? '#ffaa00' : '#ff0000'};
                border-radius: 15px;
                padding: 30px;
                max-width: 600px;
                color: white;
                font-family: Arial, sans-serif;
            ">
                <h2 style="color: ${safetyCheck.safe ? '#ffaa00' : '#ff0000'}; margin-bottom: 20px;">
                    ${safetyCheck.safe ? '⚠️ Transaction Security Check' : '🚨 DANGEROUS TRANSACTION DETECTED'}
                </h2>
                
                ${safetyCheck.critical.length > 0 ? `
                    <div style="background: rgba(255,0,0,0.2); border: 2px solid #ff0000; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #ff0000; margin-top: 0;">Critical Security Issues:</h3>
                        ${safetyCheck.critical.map(issue => `
                            <div style="margin: 10px 0; color: #ffcccc;">
                                ${issue}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${safetyCheck.warnings.length > 0 ? `
                    <div style="background: rgba(255,170,0,0.1); border: 1px solid #ffaa00; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #ffaa00; margin-top: 0;">Warnings:</h3>
                        ${safetyCheck.warnings.map(warning => `
                            <div style="margin: 10px 0; color: #ffdd99;">
                                ${warning}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div style="background: rgba(0,100,255,0.1); border: 1px solid #0066ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #66aaff; margin-top: 0;">🔒 Security Tips:</h4>
                    <ul style="color: #aaccff; line-height: 1.8; margin: 5px 0;">
                        <li>NEVER approve transactions that ask for wallet permissions</li>
                        <li>Energy rental should ONLY delegate energy, not access tokens</li>
                        <li>Verify the website URL matches the official service</li>
                        <li>Check recent reviews before using new services</li>
                        <li>Start with small amounts to test the service</li>
                    </ul>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center;">
                    ${safetyCheck.safe ? `
                        <button onclick="SecureEnergyRental.handleProceed()" style="
                            padding: 12px 30px;
                            background: linear-gradient(135deg, #00aa00, #008800);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-weight: bold;
                            cursor: pointer;
                            font-size: 1em;
                        ">
                            ✅ Proceed with Caution
                        </button>
                    ` : ''}
                    
                    <button onclick="SecureEnergyRental.handleCancel()" style="
                        padding: 12px 30px;
                        background: linear-gradient(135deg, #ff4444, #cc0000);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                        font-size: 1em;
                    ">
                        ${safetyCheck.safe ? '❌ Cancel' : '🚫 REJECT TRANSACTION'}
                    </button>
                </div>
            </div>
        `;
        
        dialog.innerHTML = content;
        document.body.appendChild(dialog);
        
        // Store callback
        this._securityCallback = callback;
    },
    
    handleProceed() {
        const dialog = document.getElementById('security-warning-dialog');
        if (dialog) dialog.remove();
        if (this._securityCallback) {
            this._securityCallback(true);
            this._securityCallback = null;
        }
    },
    
    handleCancel() {
        const dialog = document.getElementById('security-warning-dialog');
        if (dialog) dialog.remove();
        if (this._securityCallback) {
            this._securityCallback(false);
            this._securityCallback = null;
        }
    },
    
    /**
     * Create secure rental UI with verified services only
     */
    createSecureRentalUI(energyNeeded = 0) {
        const existing = document.getElementById('secure-energy-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'secure-energy-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            background: linear-gradient(135deg, #1a1a2e, #0f0f1e);
            border: 2px solid #00ff00;
            border-radius: 15px;
            padding: 30px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 10000;
            box-shadow: 0 0 30px rgba(0,255,0,0.3);
        `;
        
        let servicesHTML = '';
        for (const [key, service] of Object.entries(this.VERIFIED_SERVICES)) {
            const trustColor = service.trustScore === 'HIGH' ? '#00ff00' : 
                              service.trustScore === 'MEDIUM' ? '#ffaa00' : '#ff6600';
            
            servicesHTML += `
                <div style="
                    background: rgba(0,0,0,0.3);
                    border: 1px solid ${trustColor};
                    border-radius: 10px;
                    padding: 20px;
                    margin-bottom: 20px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <h3 style="color: ${trustColor}; margin: 0;">
                                ${service.verified ? '✅' : '⚠️'} ${service.name}
                            </h3>
                            <div style="color: #aaa; font-size: 0.9em; margin-top: 5px;">
                                ${service.description}
                            </div>
                        </div>
                        <div style="
                            background: ${trustColor}22;
                            border: 1px solid ${trustColor};
                            padding: 5px 10px;
                            border-radius: 5px;
                            font-size: 0.85em;
                        ">
                            Trust: ${service.trustScore}
                        </div>
                    </div>
                    
                    <div style="margin: 10px 0; color: #ddd;">
                        ${service.note}
                    </div>
                    
                    ${service.warnings.length > 0 ? `
                        <div style="background: rgba(255,170,0,0.1); border: 1px solid #ffaa00; padding: 10px; border-radius: 5px; margin: 10px 0;">
                            ${service.warnings.map(w => `<div style="color: #ffaa00;">⚠️ ${w}</div>`).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin: 15px 0;">
                        ${Object.entries(service.pricing).map(([duration, price]) => `
                            <div style="
                                background: rgba(255,255,255,0.05);
                                padding: 8px;
                                border-radius: 5px;
                                text-align: center;
                                font-size: 0.9em;
                            ">
                                <div style="color: #888;">${duration}</div>
                                <div style="color: #00ff00; font-weight: bold;">
                                    ${(energyNeeded * price).toFixed(2)} TRX
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <button onclick="SecureEnergyRental.visitService('${service.url}', '${service.name}')" style="
                        background: linear-gradient(135deg, #0066ff, #0044cc);
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                        width: 100%;
                    ">
                        🔗 Visit ${service.name} →
                    </button>
                </div>
            `;
        }
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #00ff00; margin: 0;">🔒 Secure Energy Rental Services</h2>
                <button onclick="document.getElementById('secure-energy-panel').remove()" style="
                    background: #ff4444;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">✕</button>
            </div>
            
            <div style="background: rgba(0,255,0,0.1); border: 1px solid #00ff00; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="color: #00ff00; margin-top: 0;">🛡️ Security Guidelines:</h4>
                <ul style="line-height: 1.8; margin: 5px 0;">
                    <li>Only use services from this verified list</li>
                    <li>NEVER enter your private key or seed phrase</li>
                    <li>Check the URL carefully before connecting wallet</li>
                    <li>Energy rental only needs your PUBLIC address</li>
                    <li>Reject any transaction asking for token permissions</li>
                </ul>
            </div>
            
            ${energyNeeded > 0 ? `
                <div style="background: rgba(0,100,255,0.1); border: 1px solid #0066ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="color: #66aaff;">Energy Needed: <strong>${energyNeeded.toLocaleString()}</strong></div>
                </div>
            ` : ''}
            
            <h3 style="color: #00ffff; margin: 20px 0 10px 0;">Verified Services:</h3>
            ${servicesHTML}
        `;
        
        document.body.appendChild(panel);
    },
    
    /**
     * Visit a service with security warning
     */
    visitService(url, name) {
        if (confirm(`
⚠️ IMPORTANT SECURITY REMINDER ⚠️

You're about to visit: ${name}

✅ SAFE Actions:
• Enter your PUBLIC wallet address
• Choose energy amount and duration
• Pay with TRX for energy rental

🚨 NEVER DO:
• Enter private keys or seed phrases
• Approve token spending permissions
• Sign transactions you don't understand
• Grant wallet control permissions

Continue to ${name}?
        `)) {
            window.open(url, '_blank');
        }
    }
};

// Override TronWeb sign to add security check
if (window.tronWeb) {
    const originalSign = window.tronWeb.trx.sign;
    window.tronWeb.trx.sign = async function(transaction, privateKey) {
        console.log('🔒 Intercepting transaction for security check...');
        
        // Check transaction safety
        const safetyCheck = await SecureEnergyRental.checkTransactionSafety(transaction);
        
        if (!safetyCheck.safe || safetyCheck.warnings.length > 0) {
            // Show warning and wait for user decision
            return new Promise((resolve, reject) => {
                SecureEnergyRental.showSecurityWarning(safetyCheck, (proceed) => {
                    if (proceed) {
                        // User accepted risks, continue with signing
                        originalSign.call(this, transaction, privateKey)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        // User rejected transaction
                        reject(new Error('Transaction rejected by user for security reasons'));
                    }
                });
            });
        }
        
        // Transaction appears safe, proceed normally
        return originalSign.call(this, transaction, privateKey);
    };
}

console.log('✅ Secure Energy Rental loaded with:');
console.log('   - Contract permission validation');
console.log('   - Verified service list only');
console.log('   - Transaction safety checker');
console.log('   - Security warning system');