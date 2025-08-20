/**
 * FIX CONFIRMATION STYLING
 * Fixes white-on-white text in confirmation modals
 */

console.log('🎨 FIXING CONFIRMATION STYLING');
console.log('=' .repeat(70));

// Fix all modals with white-on-white text
(function fixModalStyling() {
    // Create global style fixes
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        /* Fix white-on-white text in modals */
        .modal-content {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
        }
        
        .modal-content * {
            color: white !important;
        }
        
        .modal-content input,
        .modal-content select,
        .modal-content textarea {
            background: rgba(255, 255, 255, 0.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            color: white !important;
        }
        
        .modal-content input::placeholder {
            color: rgba(255, 255, 255, 0.7) !important;
        }
        
        /* Fix transaction confirmation modal */
        #transactionModal .modal-content,
        #confirmationModal .modal-content,
        #receiptModal .modal-content {
            background: linear-gradient(135deg, #1a1a2e, #16213e) !important;
            border: 2px solid #00ff88 !important;
            box-shadow: 0 0 40px rgba(0, 255, 136, 0.3) !important;
        }
        
        #transactionModal h2,
        #confirmationModal h2,
        #receiptModal h2 {
            color: #00ff88 !important;
            text-shadow: 0 0 20px rgba(0, 255, 136, 0.5) !important;
        }
        
        /* Transaction details styling */
        .transaction-details,
        .tx-details {
            background: rgba(0, 0, 0, 0.3) !important;
            border: 1px solid rgba(0, 255, 136, 0.3) !important;
            border-radius: 10px !important;
            padding: 20px !important;
        }
        
        .transaction-details p,
        .tx-details p {
            color: #ffffff !important;
            margin: 10px 0 !important;
            display: flex !important;
            justify-content: space-between !important;
        }
        
        .transaction-details strong,
        .tx-details strong {
            color: #00ff88 !important;
        }
        
        /* Success message styling */
        .success-message {
            background: linear-gradient(135deg, #00ff88, #00ccff) !important;
            -webkit-background-clip: text !important;
            -webkit-text-fill-color: transparent !important;
            font-size: 24px !important;
            font-weight: bold !important;
            text-align: center !important;
            margin: 20px 0 !important;
        }
        
        /* Button styling */
        .modal-content button {
            background: linear-gradient(135deg, #00ff88, #00ccff) !important;
            color: #1a1a2e !important;
            border: none !important;
            padding: 12px 30px !important;
            border-radius: 8px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            transition: all 0.3s !important;
        }
        
        .modal-content button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 10px 20px rgba(0, 255, 136, 0.3) !important;
        }
        
        /* Cost breakdown styling */
        .cost-breakdown {
            background: rgba(0, 0, 0, 0.5) !important;
            border-left: 4px solid #00ff88 !important;
            padding: 15px !important;
            margin: 20px 0 !important;
        }
        
        .cost-breakdown h3 {
            color: #00ff88 !important;
            margin-bottom: 15px !important;
        }
        
        .cost-item {
            display: flex !important;
            justify-content: space-between !important;
            padding: 8px 0 !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        
        .cost-item:last-child {
            border-bottom: none !important;
            font-weight: bold !important;
            color: #00ff88 !important;
            font-size: 18px !important;
            margin-top: 10px !important;
            padding-top: 15px !important;
            border-top: 2px solid #00ff88 !important;
        }
    `;
    
    document.head.appendChild(styleSheet);
    console.log('✅ Modal styling fixed');
})();

// Monitor for new modals and fix them
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
                // Check if it's a modal
                if (node.classList?.contains('modal') || node.id?.includes('Modal')) {
                    // Ensure proper styling
                    const content = node.querySelector('.modal-content');
                    if (content) {
                        content.style.background = 'linear-gradient(135deg, #1a1a2e, #16213e)';
                        content.style.color = 'white';
                        content.style.border = '2px solid #00ff88';
                    }
                }
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('✅ Confirmation styling monitor active');