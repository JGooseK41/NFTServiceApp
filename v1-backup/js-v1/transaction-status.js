/**
 * Transaction Status Manager
 * Provides dynamic status updates and educational messages during transaction processing
 */

window.TransactionStatus = {
    currentPhase: null,
    statusInterval: null,
    factIndex: 0,
    
    // Educational facts and tips to show during processing
    facts: [
        "💡 Legal notices on blockchain create immutable proof of delivery",
        "📋 Each notice generates a unique NFT that cannot be altered or deleted",
        "⚡ Energy rental saves you up to 93% on transaction costs",
        "🔒 Documents are encrypted and only accessible by the recipient",
        "⏰ Delivery timestamps are permanently recorded on the blockchain",
        "📱 Recipients can view their notices from any device with a wallet",
        "✅ Smart contracts automatically track acceptance and viewing",
        "🌐 TRON blockchain processes over 2000 transactions per second",
        "💰 Sponsoring fees covers the recipient's transaction costs",
        "📊 All notice activity is tracked in an immutable audit trail",
        "🔐 Private keys ensure only the recipient can decrypt documents",
        "⚖️ Blockchain records meet legal requirements for proof of service",
        "🎯 Each notice has a unique ID for legal reference",
        "📈 Transaction history provides complete chain of custody",
        "🛡️ Decentralized storage ensures notices remain accessible"
    ],
    
    // Phase-specific messages
    phases: {
        staging: {
            title: "Preparing Transaction",
            messages: [
                "Validating recipient addresses...",
                "Encrypting documents for secure delivery...",
                "Calculating transaction requirements...",
                "Preparing notice metadata..."
            ]
        },
        energy: {
            title: "Acquiring Energy",
            messages: [
                "Connecting to JustLend energy marketplace...",
                "Calculating optimal energy amount...",
                "Negotiating best rental rates...",
                "Securing energy for transaction...",
                "This may take 1-2 minutes..."
            ],
            explanation: "Energy rental reduces your transaction cost by up to 93%. Instead of burning TRX for energy, we rent it temporarily from JustLend's marketplace."
        },
        transaction: {
            title: "Creating Legal Notices",
            messages: [
                "Submitting to TRON blockchain...",
                "Minting NFT tokens...",
                "Recording delivery timestamps...",
                "Generating proof of service...",
                "Finalizing smart contract..."
            ]
        },
        confirmation: {
            title: "Confirming Delivery",
            messages: [
                "Waiting for blockchain confirmation...",
                "Verifying transaction success...",
                "Recording notice IDs...",
                "Generating receipts..."
            ]
        },
        complete: {
            title: "Transaction Complete",
            messages: [
                "Legal notices successfully delivered!",
                "Proof of service recorded on blockchain",
                "Recipients have been notified"
            ]
        }
    },
    
    /**
     * Show status modal with dynamic updates
     */
    show(phase = 'staging') {
        this.currentPhase = phase;
        this.factIndex = 0;
        
        // Remove existing modal if any
        this.hide();
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'transactionStatusModal';
        modal.className = 'transaction-status-modal';
        modal.innerHTML = `
            <style>
                .transaction-status-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .status-container {
                    background: #1a1b23;
                    border: 1px solid #2d2e3f;
                    border-radius: 16px;
                    padding: 32px;
                    max-width: 500px;
                    width: 90%;
                    text-align: center;
                }
                
                .status-icon {
                    font-size: 48px;
                    margin-bottom: 20px;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                
                .status-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #fff;
                    margin-bottom: 16px;
                }
                
                .status-message {
                    font-size: 16px;
                    color: #94a3b8;
                    margin-bottom: 24px;
                    min-height: 24px;
                    transition: opacity 0.3s;
                }
                
                .status-explanation {
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 24px;
                    font-size: 14px;
                    color: #93c5fd;
                    line-height: 1.5;
                }
                
                .status-progress {
                    background: #2d2e3f;
                    border-radius: 8px;
                    height: 8px;
                    margin-bottom: 24px;
                    overflow: hidden;
                }
                
                .status-progress-bar {
                    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                    height: 100%;
                    width: 0%;
                    animation: progress 30s linear forwards;
                }
                
                @keyframes progress {
                    to { width: 90%; }
                }
                
                .status-fact {
                    background: #0f172a;
                    border-left: 3px solid #3b82f6;
                    border-radius: 4px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                    font-size: 13px;
                    color: #cbd5e1;
                    text-align: left;
                    min-height: 40px;
                    display: flex;
                    align-items: center;
                }
                
                .status-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                
                .status-btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .status-btn-secondary {
                    background: #374151;
                    color: #d1d5db;
                }
                
                .status-btn-secondary:hover {
                    background: #4b5563;
                }
                
                .spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top-color: #3b82f6;
                    animation: spin 1s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
            
            <div class="status-container">
                <div class="status-icon">⚡</div>
                <h2 class="status-title" id="statusTitle">Preparing Transaction</h2>
                <div class="status-message" id="statusMessage">Initializing...</div>
                
                <div class="status-explanation" id="statusExplanation" style="display: none;"></div>
                
                <div class="status-progress">
                    <div class="status-progress-bar"></div>
                </div>
                
                <div class="status-fact" id="statusFact">
                    ${this.facts[0]}
                </div>
                
                <div class="status-actions">
                    <button class="status-btn status-btn-secondary" onclick="TransactionStatus.showDetails()">
                        <i class="fas fa-info-circle"></i> What's happening?
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Start updates
        this.startUpdates();
    },
    
    /**
     * Update to a new phase
     */
    updatePhase(phase) {
        this.currentPhase = phase;
        const phaseData = this.phases[phase];
        
        if (!phaseData) return;
        
        // Update title
        const titleEl = document.getElementById('statusTitle');
        if (titleEl) {
            titleEl.textContent = phaseData.title;
        }
        
        // Update icon based on phase
        const iconEl = document.querySelector('.status-icon');
        if (iconEl) {
            const icons = {
                staging: '📋',
                energy: '⚡',
                transaction: '🚀',
                confirmation: '⏳',
                complete: '✅'
            };
            iconEl.textContent = icons[phase] || '⚡';
        }
        
        // Show explanation for energy phase
        const explanationEl = document.getElementById('statusExplanation');
        if (explanationEl && phaseData.explanation) {
            explanationEl.textContent = phaseData.explanation;
            explanationEl.style.display = 'block';
        }
        
        // Reset progress bar
        const progressBar = document.querySelector('.status-progress-bar');
        if (progressBar) {
            progressBar.style.animation = 'none';
            setTimeout(() => {
                progressBar.style.animation = 'progress 30s linear forwards';
            }, 100);
        }
    },
    
    /**
     * Start automatic updates
     */
    startUpdates() {
        let messageIndex = 0;
        
        // Update message every 6 seconds (slower for better readability)
        this.statusInterval = setInterval(() => {
            const phaseData = this.phases[this.currentPhase];
            if (!phaseData) return;
            
            // Update status message
            const messageEl = document.getElementById('statusMessage');
            if (messageEl && phaseData.messages) {
                messageEl.style.opacity = '0';
                setTimeout(() => {
                    messageEl.textContent = phaseData.messages[messageIndex % phaseData.messages.length];
                    messageEl.style.opacity = '1';
                    messageIndex++;
                }, 300);
            }
            
            // Update fact every other cycle
            if (messageIndex % 2 === 0) {
                const factEl = document.getElementById('statusFact');
                if (factEl) {
                    this.factIndex = (this.factIndex + 1) % this.facts.length;
                    factEl.style.opacity = '0';
                    setTimeout(() => {
                        factEl.innerHTML = this.facts[this.factIndex];
                        factEl.style.opacity = '1';
                    }, 300);
                }
            }
        }, 6000); // Changed from 3000ms to 6000ms for slower, more readable tips
        
        // Trigger first update immediately
        const phaseData = this.phases[this.currentPhase];
        if (phaseData && phaseData.messages) {
            const messageEl = document.getElementById('statusMessage');
            if (messageEl) {
                messageEl.textContent = phaseData.messages[0];
            }
        }
    },
    
    /**
     * Show detailed explanation
     */
    showDetails() {
        const explanations = {
            staging: "We're preparing your transaction by validating all recipient addresses, encrypting documents, and calculating the exact resources needed.",
            energy: "Energy is required to execute smart contracts on TRON. We're renting energy from JustLend's marketplace at a 93% discount compared to burning TRX directly. This process may take 1-2 minutes.",
            transaction: "Your legal notices are being permanently recorded on the TRON blockchain. Each notice creates an NFT that serves as immutable proof of delivery.",
            confirmation: "The blockchain network is confirming your transaction. Once confirmed, the delivery cannot be altered or disputed.",
            complete: "Your legal notices have been successfully delivered and recorded on the blockchain!"
        };
        
        alert(explanations[this.currentPhase] || "Processing your transaction...");
    },
    
    /**
     * Hide status modal
     */
    hide() {
        const modal = document.getElementById('transactionStatusModal');
        if (modal) {
            modal.remove();
        }
        
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    },
    
    /**
     * Show error state
     */
    showError(message) {
        const modal = document.getElementById('transactionStatusModal');
        if (!modal) return;
        
        const container = modal.querySelector('.status-container');
        if (container) {
            container.innerHTML = `
                <div class="status-icon" style="color: #ef4444;">❌</div>
                <h2 class="status-title">Transaction Failed</h2>
                <div class="status-message" style="color: #ef4444;">${message}</div>
                <div class="status-actions">
                    <button class="status-btn status-btn-secondary" onclick="TransactionStatus.hide()">
                        Close
                    </button>
                </div>
            `;
        }
        
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    },
    
    /**
     * Show success state
     */
    showSuccess(result) {
        const modal = document.getElementById('transactionStatusModal');
        if (!modal) return;
        
        const container = modal.querySelector('.status-container');
        if (container) {
            container.innerHTML = `
                <div class="status-icon" style="color: #10b981;">✅</div>
                <h2 class="status-title">Transaction Complete!</h2>
                <div class="status-message" style="color: #10b981;">Legal notices successfully delivered</div>
                
                <div class="status-explanation" style="display: block;">
                    Transaction Hash: <code style="font-size: 11px;">${result.blockchainTxHash || 'Processing...'}</code>
                </div>
                
                <div class="status-fact" style="background: rgba(16, 185, 129, 0.1); border-color: #10b981;">
                    🎉 All recipients have been notified and proof of delivery has been recorded on the blockchain
                </div>
                
                <div class="status-actions">
                    <button class="status-btn status-btn-secondary" onclick="TransactionStatus.hide()">
                        <i class="fas fa-check"></i> Done
                    </button>
                </div>
            `;
        }
        
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    }
};

console.log('Transaction Status Manager loaded');