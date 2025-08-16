/**
 * Full Service Simulation
 * Integrates with the actual notice creation UI for testing
 */

(function() {
    'use strict';
    
    window.FullServiceSimulation = {
        isSimulationMode: false,
        simulationData: null,
        
        /**
         * Enable simulation mode
         */
        enableSimulation() {
            this.isSimulationMode = true;
            console.log('🎭 SIMULATION MODE ENABLED - No blockchain transactions will occur');
            
            // Add visual indicator
            this.addSimulationBanner();
            
            // Override the transaction functions
            this.overrideTransactionFunctions();
            
            // Switch to Create tab
            const createTab = document.querySelector('[onclick*="showTab(\'create\')"]');
            if (createTab) {
                createTab.click();
            } else {
                // Try alternative method
                if (window.showTab) {
                    window.showTab('create');
                }
            }
            
            return true;
        },
        
        /**
         * Add visual banner showing simulation mode
         */
        addSimulationBanner() {
            // Remove existing banner
            const existing = document.getElementById('simulationBanner');
            if (existing) existing.remove();
            
            const banner = document.createElement('div');
            banner.id = 'simulationBanner';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(90deg, #8b5cf6, #7c3aed);
                color: white;
                padding: 10px;
                text-align: center;
                z-index: 10000;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            banner.innerHTML = `
                🎭 SIMULATION MODE - Testing without blockchain transactions
                <button onclick="FullServiceSimulation.disableSimulation()" 
                        style="margin-left: 20px; padding: 5px 10px; background: white; 
                               color: #8b5cf6; border: none; border-radius: 4px; cursor: pointer;">
                    Exit Simulation
                </button>
            `;
            document.body.appendChild(banner);
            
            // Adjust page top margin
            document.body.style.marginTop = '50px';
        },
        
        /**
         * Disable simulation mode
         */
        disableSimulation() {
            this.isSimulationMode = false;
            console.log('📊 Simulation mode disabled - returning to normal mode');
            
            // Remove banner
            const banner = document.getElementById('simulationBanner');
            if (banner) banner.remove();
            
            // Reset page margin
            document.body.style.marginTop = '';
            
            // Restore original functions
            this.restoreTransactionFunctions();
        },
        
        /**
         * Override transaction functions for simulation
         */
        overrideTransactionFunctions() {
            // Store originals
            this._originalServeNotice = window.serveNotice;
            this._originalServeNoticeBatch = window.serveNoticeBatch;
            
            // Override with simulation versions
            window.serveNotice = async (recipientAddress, noticeText, documentHash, encryptedKey, caseNumber, creationFee, serviceFee, sponsorFee, ipfsHash, uriType) => {
                console.log('🎭 SIMULATING serveNotice transaction');
                console.log('Parameters:', {
                    recipientAddress,
                    caseNumber,
                    creationFee,
                    serviceFee,
                    sponsorFee,
                    ipfsHash,
                    uriType
                });
                
                // Simulate successful transaction
                const mockTxId = 'SIM_' + Date.now().toString(16);
                const mockAlertId = Math.floor(Math.random() * 1000000);
                const mockDocumentId = mockAlertId + 1;
                
                // Store simulated notice data
                await this.storeSimulatedNotice({
                    txId: mockTxId,
                    alertId: mockAlertId,
                    documentId: mockDocumentId,
                    recipient: recipientAddress,
                    caseNumber: caseNumber,
                    noticeText: noticeText,
                    documentHash: documentHash,
                    ipfsHash: ipfsHash,
                    timestamp: new Date().toISOString(),
                    fees: {
                        creation: creationFee,
                        service: serviceFee,
                        sponsor: sponsorFee
                    }
                });
                
                // Show simulation results
                this.showSimulationResults({
                    txId: mockTxId,
                    alertId: mockAlertId,
                    documentId: mockDocumentId,
                    recipient: recipientAddress,
                    caseNumber: caseNumber,
                    fees: {
                        creation: creationFee,
                        service: serviceFee,
                        sponsor: sponsorFee
                    }
                });
                
                return {
                    txid: mockTxId,
                    alertId: mockAlertId,
                    documentId: mockDocumentId,
                    simulated: true
                };
            };
            
            window.serveNoticeBatch = async (recipients, noticeText, documentHash, encryptedKey, caseNumber, creationFee, serviceFee, sponsorFee, ipfsHash, uriType) => {
                console.log('🎭 SIMULATING serveNoticeBatch transaction');
                console.log('Recipients:', recipients);
                console.log('Case Number:', caseNumber);
                
                const mockTxId = 'SIM_BATCH_' + Date.now().toString(16);
                const mockAlertIds = recipients.map((_, i) => Math.floor(Math.random() * 1000000) + i * 2);
                
                this.showSimulationResults({
                    txId: mockTxId,
                    alertIds: mockAlertIds,
                    recipients: recipients,
                    caseNumber: caseNumber,
                    batchMode: true
                });
                
                return {
                    txid: mockTxId,
                    alertIds: mockAlertIds,
                    simulated: true
                };
            };
        },
        
        /**
         * Restore original transaction functions
         */
        restoreTransactionFunctions() {
            if (this._originalServeNotice) {
                window.serveNotice = this._originalServeNotice;
            }
            if (this._originalServeNoticeBatch) {
                window.serveNoticeBatch = this._originalServeNoticeBatch;
            }
        },
        
        /**
         * Store simulated notice for viewing
         */
        async storeSimulatedNotice(data) {
            console.log('💾 Storing simulated notice for viewing...');
            
            // Store in localStorage for persistence
            const simulatedNotices = JSON.parse(localStorage.getItem('simulatedNotices') || '[]');
            simulatedNotices.push(data);
            localStorage.setItem('simulatedNotices', JSON.stringify(simulatedNotices));
            
            // Also store the uploaded document if available
            const uploadedDocs = window.uploadedDocuments || [];
            if (uploadedDocs.length > 0) {
                const docData = uploadedDocs[uploadedDocs.length - 1]; // Get most recent
                
                // Store document data with notice ID
                const simDocs = JSON.parse(localStorage.getItem('simulatedDocuments') || '{}');
                simDocs[data.alertId] = docData;
                simDocs[data.documentId] = docData;
                localStorage.setItem('simulatedDocuments', JSON.stringify(simDocs));
                
                // Also store in simple image system if available
                if (window.simpleImageSystem) {
                    try {
                        await window.simpleImageSystem.storeImage(data.alertId, {
                            alertImage: docData.alertImage || docData.thumbnail,
                            documentImage: docData.documentImage || docData.fullDocument
                        });
                    } catch (e) {
                        console.log('Could not store in image system:', e);
                    }
                }
            }
            
            // Add to unified notice system if available
            if (window.unifiedSystem) {
                window.unifiedSystem.addSimulatedNotice({
                    caseNumber: data.caseNumber,
                    alertId: data.alertId,
                    documentId: data.documentId,
                    recipientAddress: data.recipient,
                    timestamp: data.timestamp,
                    status: 'SIMULATED',
                    noticeType: 'Legal Notice',
                    issuingAgency: 'SIMULATION',
                    pageCount: 1
                });
            }
            
            // Refresh the display
            this.refreshNoticeDisplay();
            
            console.log('✅ Simulated notice stored with ID:', data.alertId);
        },
        
        /**
         * Refresh notice display to show simulated notices
         */
        refreshNoticeDisplay() {
            // Try to refresh the Recent Served Notices section
            if (window.loadRecentServed) {
                window.loadRecentServed();
            }
            
            // Also try unified system refresh
            if (window.unifiedSystem && window.unifiedSystem.loadCases) {
                window.unifiedSystem.loadCases();
            }
            
            // Switch to Recent tab to show the new notice
            setTimeout(() => {
                const recentTab = document.querySelector('[onclick*="showTab(\'recent\')"]');
                if (recentTab) {
                    recentTab.click();
                } else if (window.showTab) {
                    window.showTab('recent');
                }
            }, 1500);
        },
        
        /**
         * Show simulation results
         */
        showSimulationResults(data) {
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
            
            const content = `
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; max-height: 80vh; overflow: auto;">
                    <h2 style="color: #8b5cf6;">🎭 Simulation Results</h2>
                    
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3>Transaction Details</h3>
                        <p><strong>Transaction ID:</strong> ${data.txId}</p>
                        <p><strong>Case Number:</strong> ${data.caseNumber}</p>
                        ${data.batchMode ? 
                            `<p><strong>Recipients:</strong> ${data.recipients.length} addresses</p>` :
                            `<p><strong>Recipient:</strong> ${data.recipient}</p>`
                        }
                    </div>
                    
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3>NFTs Created (Simulated)</h3>
                        ${data.batchMode ?
                            data.alertIds.map((id, i) => `
                                <p>Recipient ${i + 1}: Alert #${id}, Document #${id + 1}</p>
                            `).join('') :
                            `<p>Alert NFT: #${data.alertId}</p>
                             <p>Document NFT: #${data.documentId}</p>`
                        }
                    </div>
                    
                    <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3>What Would Happen in Real Transaction</h3>
                        <ul style="text-align: left;">
                            <li>✅ Smart contract would be called on TRON blockchain</li>
                            <li>✅ Gas fees would be paid (25-35 TRX)</li>
                            <li>✅ NFTs would be minted to recipient wallets</li>
                            <li>✅ Transaction would be permanently recorded</li>
                            <li>✅ Recipients would receive blockchain notification</li>
                        </ul>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button onclick="this.parentElement.parentElement.parentElement.remove(); window.showTab('recent');" 
                                style="background: #10b981; color: white; padding: 10px 30px; 
                                       border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                            View in Recent Notices
                        </button>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                style="background: #8b5cf6; color: white; padding: 10px 30px; 
                                       border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                            Close
                        </button>
                    </div>
                </div>
            `;
            
            modal.innerHTML = content;
            document.body.appendChild(modal);
        },
        
        /**
         * Load PDF and populate form
         */
        async loadPDFIntoForm(file) {
            console.log('📄 Loading PDF into form:', file.name);
            
            // Enable simulation mode
            this.enableSimulation();
            
            // Trigger the document upload handler
            const fileInput = document.getElementById('createDocumentUpload');
            if (fileInput) {
                // Create a new FileList with our file
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                
                // Trigger change event
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
                
                // Also call handler directly if it exists
                if (window.handleDocumentUpload) {
                    window.handleDocumentUpload({ target: fileInput });
                }
            }
            
            // Auto-fill some fields for testing
            setTimeout(() => {
                // Fill in case number
                const caseInput = document.querySelector('input[placeholder*="case number" i], #caseNumber');
                if (caseInput) {
                    caseInput.value = 'SIM-' + Date.now();
                    caseInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                // Fill in recipient address
                const recipientInput = document.querySelector('input[placeholder*="recipient" i], #recipientAddress');
                if (recipientInput) {
                    recipientInput.value = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
                    recipientInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                console.log('✅ Form auto-filled for simulation');
                console.log('📝 You can now edit the details and click "Create Notice" to simulate');
            }, 1000);
        }
    };
    
    // Update the manual button to use full simulation
    function updateSimulationButton() {
        const button = document.getElementById('manualSimulationButton');
        if (button) {
            button.onclick = function(event) {
                event.stopPropagation();
                
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf';
                input.style.display = 'none';
                document.body.appendChild(input);
                
                input.onchange = async (e) => {
                    document.body.removeChild(input);
                    const file = e.target.files[0];
                    if (file) {
                        // Use full simulation instead of just preview
                        await FullServiceSimulation.loadPDFIntoForm(file);
                    }
                };
                
                input.click();
                
                setTimeout(() => {
                    if (input.parentNode) {
                        document.body.removeChild(input);
                    }
                }, 1000);
            };
        }
    }
    
    // Update button when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateSimulationButton);
    } else {
        updateSimulationButton();
    }
    
    // Make it globally available
    window.FullServiceSimulation = FullServiceSimulation;
    
    console.log('✅ Full Service Simulation loaded');
    console.log('Click the purple button to start a full simulation with your PDF');
})();