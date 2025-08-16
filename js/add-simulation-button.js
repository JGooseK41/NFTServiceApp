/**
 * Add Simulation Button Manually
 * Temporary workaround while simulate-service.js deploys
 */

(function() {
    function addTestButton() {
        // Check if button already exists
        if (document.getElementById('manualSimulationButton')) {
            return;
        }
        
        const button = document.createElement('button');
        button.id = 'manualSimulationButton';
        button.className = 'simulation-test-button'; // Add class to prevent removal
        button.innerHTML = '🧪 Test Service (Manual)';
        button.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: #9333ea;
            color: white;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            font-weight: bold;
        `;
        button.setAttribute('data-permanent', 'true'); // Mark as permanent
        // Prevent removal by setting start time far in future
        button.setAttribute('data-start-time', String(Date.now() + 999999999));
        
        button.onclick = function(event) {
            // Ensure we have user activation
            event.stopPropagation();
            
            // Create and immediately trigger file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf';
            input.style.display = 'none';
            document.body.appendChild(input);
            
            input.onchange = async (e) => {
                document.body.removeChild(input); // Clean up input element
                const file = e.target.files[0];
                if (file) {
                    console.log('📄 PDF Selected:', file.name);
                    console.log('Size:', (file.size / 1024).toFixed(2), 'KB');
                    console.log('Type:', file.type);
                    
                    // Create simple preview
                    const modal = document.createElement('div');
                    modal.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.8);
                        z-index: 10001;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    `;
                    
                    modal.innerHTML = `
                        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px;">
                            <h2>📋 Simulation Preview</h2>
                            <p><strong>File:</strong> ${file.name}</p>
                            <p><strong>Size:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
                            <p><strong>Type:</strong> ${file.type}</p>
                            <hr style="margin: 20px 0;">
                            <p>✅ File successfully loaded</p>
                            <p>🔄 Processing would happen here...</p>
                            <p>📤 Would upload to backend...</p>
                            <p>🔗 Would create NFT metadata...</p>
                            <hr style="margin: 20px 0;">
                            <p style="color: #666; font-size: 12px;">
                                Full simulation available after deployment completes
                            </p>
                            <button onclick="this.parentElement.parentElement.remove()" 
                                    style="background: #3b82f6; color: white; padding: 10px 20px; 
                                           border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                                Close
                            </button>
                        </div>
                    `;
                    
                    document.body.appendChild(modal);
                }
            };
            // Click must happen in same event loop
            input.click();
            
            // Clean up if no file selected after 1 second
            setTimeout(() => {
                if (input.parentNode) {
                    document.body.removeChild(input);
                }
            }, 1000);
        };
        
        document.body.appendChild(button);
        console.log('✅ Manual simulation button added');
    }
    
    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addTestButton);
    } else {
        addTestButton();
    }
})();