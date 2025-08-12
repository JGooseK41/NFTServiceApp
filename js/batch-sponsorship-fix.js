/**
 * Batch Sponsorship Fix
 * Workaround for the issue where only the first recipient gets sponsorship in batch transactions
 * This sends sponsorship payments separately after the main batch transaction
 */

window.BatchSponsorshipFix = {
    
    /**
     * Send sponsorship to all recipients after batch transaction
     * This is a workaround for the contract not distributing sponsorship correctly
     */
    async sendSponsorshipToAllRecipients(recipients, sponsorshipAmount = 6000000) {
        console.log('🔧 Sending sponsorship to all batch recipients separately...');
        
        const results = {
            successful: [],
            failed: [],
            total: recipients.length
        };
        
        // Filter out null addresses
        const NULL_ADDRESSES = [
            '0x0000000000000000000000000000000000000000',
            'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', // TRON null address
        ];
        
        const validRecipients = recipients.filter(addr => 
            !NULL_ADDRESSES.includes(addr)
        );
        
        console.log(`Sending ${sponsorshipAmount/1000000} TRX to ${validRecipients.length} valid recipients`);
        
        for (const recipient of validRecipients) {
            try {
                console.log(`Sending sponsorship to ${recipient}...`);
                
                const tx = await tronWeb.trx.sendTransaction(
                    recipient,
                    sponsorshipAmount,
                    {
                        memo: `Legal Notice Sponsorship - BlockServed.com`
                    }
                );
                
                results.successful.push({
                    recipient: recipient,
                    txId: tx.txid || tx,
                    amount: sponsorshipAmount
                });
                
                console.log(`✅ Sent ${sponsorshipAmount/1000000} TRX to ${recipient}`);
                
            } catch (error) {
                console.error(`❌ Failed to send to ${recipient}:`, error);
                results.failed.push({
                    recipient: recipient,
                    error: error.message
                });
            }
            
            // Small delay between transactions to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Summary
        console.log('📊 Sponsorship Distribution Summary:');
        console.log(`✅ Successful: ${results.successful.length}/${validRecipients.length}`);
        console.log(`❌ Failed: ${results.failed.length}/${validRecipients.length}`);
        
        if (results.failed.length > 0) {
            console.log('Failed recipients:', results.failed);
        }
        
        return results;
    },
    
    /**
     * Modified batch transaction handler that ensures all recipients get sponsorship
     */
    async serveNoticeBatchWithSponsorship(batchNotices, totalFee) {
        try {
            console.log('📝 Serving batch notices with fixed sponsorship distribution...');
            
            // Extract recipient addresses
            const recipients = batchNotices.map(notice => 
                notice.recipient || notice[0] // Handle both object and array formats
            );
            
            // Check current sponsorship fee
            const sponsorshipFee = await legalContract.sponsorshipFee().call();
            const sponsorshipPerRecipient = sponsorshipFee;
            
            console.log(`Contract sponsorship fee: ${sponsorshipFee/1000000} TRX per recipient`);
            
            // Adjust the callValue to NOT include sponsorship since we'll send it separately
            // This assumes the contract has the bug where it doesn't distribute properly
            const adjustedFee = totalFee - (sponsorshipPerRecipient * recipients.length);
            
            console.log(`Original fee: ${totalFee/1000000} TRX`);
            console.log(`Adjusted fee (without sponsorship): ${adjustedFee/1000000} TRX`);
            console.log(`Will send sponsorship separately: ${(sponsorshipPerRecipient * recipients.length)/1000000} TRX`);
            
            // Send the batch transaction with reduced fee
            const tx = await legalContract.serveNoticeBatch(batchNotices).send({
                feeLimit: 2000_000_000,
                callValue: adjustedFee, // Fee without sponsorship
                shouldPollResponse: true
            });
            
            console.log('✅ Batch transaction sent:', tx);
            
            // Now send sponsorship to all recipients separately
            console.log('📤 Sending sponsorship payments separately...');
            const sponsorshipResults = await this.sendSponsorshipToAllRecipients(
                recipients,
                sponsorshipPerRecipient
            );
            
            // Combine results
            const result = {
                batchTx: tx,
                sponsorshipResults: sponsorshipResults,
                totalRecipients: recipients.length,
                sponsorshipSuccess: sponsorshipResults.successful.length,
                sponsorshipFailed: sponsorshipResults.failed.length
            };
            
            // Show summary to user
            if (window.uiManager) {
                if (sponsorshipResults.failed.length === 0) {
                    window.uiManager.showNotification('success', 
                        `✅ Batch sent! All ${recipients.length} recipients received notices and sponsorship.`
                    );
                } else {
                    window.uiManager.showNotification('warning',
                        `⚠️ Batch sent! ${sponsorshipResults.failed.length} recipients may not have received sponsorship.`
                    );
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('Error in batch transaction with sponsorship:', error);
            throw error;
        }
    },
    
    /**
     * Check if batch sponsorship fix is needed
     */
    async isBatchSponsorshipBroken() {
        // This checks if the contract has the known issue
        // You can implement a test transaction or check contract version
        
        // For now, assume it's broken if contract is v5 Enumerable on mainnet
        const contractAddress = legalContract?.address || legalContract?._address;
        const brokenContracts = [
            'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN' // v5 Enumerable mainnet
        ];
        
        return brokenContracts.includes(contractAddress);
    },
    
    /**
     * Patch the existing batch transaction flow
     */
    async patchBatchTransactionFlow() {
        console.log('🔧 Patching batch transaction flow for sponsorship fix...');
        
        // Check if fix is needed
        const needsFix = await this.isBatchSponsorshipBroken();
        
        if (!needsFix) {
            console.log('✅ Contract handles batch sponsorship correctly. No patch needed.');
            return;
        }
        
        console.log('⚠️ Contract has batch sponsorship issue. Applying workaround...');
        
        // Store original function if not already stored
        if (!window.originalServeNoticeBatch && window.legalContract) {
            window.originalServeNoticeBatch = window.legalContract.serveNoticeBatch;
        }
        
        // Override the batch function to use our fixed version
        if (window.legalContract) {
            const originalFunc = window.legalContract.serveNoticeBatch;
            
            window.legalContract.serveNoticeBatch = function(batchNotices) {
                return {
                    send: async function(options) {
                        console.log('🔄 Using patched batch function with sponsorship fix...');
                        
                        // Calculate total sponsorship needed
                        const sponsorshipFee = await window.legalContract.sponsorshipFee().call();
                        const validRecipients = batchNotices.filter(n => 
                            n.recipient !== 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb' &&
                            n.recipient !== '0x0000000000000000000000000000000000000000'
                        );
                        const totalSponsorship = sponsorshipFee * validRecipients.length;
                        
                        // Reduce callValue by sponsorship amount since we'll send it separately
                        const adjustedOptions = {
                            ...options,
                            callValue: options.callValue - totalSponsorship
                        };
                        
                        // Call original function with reduced fee
                        const result = await originalFunc.call(this, batchNotices).send(adjustedOptions);
                        
                        // Send sponsorship separately to all recipients
                        const recipients = batchNotices.map(n => n.recipient || n[0]);
                        await BatchSponsorshipFix.sendSponsorshipToAllRecipients(
                            recipients,
                            sponsorshipFee
                        );
                        
                        return result;
                    }
                };
            };
            
            console.log('✅ Batch transaction flow patched for sponsorship distribution');
        }
    },
    
    /**
     * Initialize the fix
     */
    async initialize() {
        console.log('🚀 Initializing Batch Sponsorship Fix...');
        
        try {
            // Wait for contract to be ready
            let retries = 0;
            while (!window.legalContract && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }
            
            if (!window.legalContract) {
                console.error('Contract not available for batch sponsorship fix');
                return;
            }
            
            // Apply the patch
            await this.patchBatchTransactionFlow();
            
            console.log('✅ Batch Sponsorship Fix initialized');
            
        } catch (error) {
            console.error('Error initializing batch sponsorship fix:', error);
        }
    }
};

// Auto-initialize after a delay to ensure contract is loaded
setTimeout(() => {
    BatchSponsorshipFix.initialize();
}, 3000);

console.log('✅ Batch Sponsorship Fix loaded');
console.log('This workaround ensures all recipients get sponsorship in batch transactions');