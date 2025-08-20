/**
 * Consolidate Sponsorship Fees
 * Updates the contract sponsorship fee and removes separate notification payment
 */

window.ConsolidatedSponsorship = {
    
    /**
     * Update the contract's sponsorship fee to 6 TRX
     * This combines the 2 TRX sponsorship + 3.5 TRX notification into one payment
     */
    async updateContractSponsorshipFee() {
        try {
            if (!window.legalContract) {
                throw new Error('Contract not initialized');
            }
            
            // Check current sponsorship fee
            const currentFee = await legalContract.sponsorshipFee().call();
            const currentFeeInTRX = currentFee / 1000000;
            console.log(`Current sponsorship fee: ${currentFeeInTRX} TRX`);
            
            // Only update if not already 6 TRX
            if (currentFee !== 6000000) {
                console.log('Updating sponsorship fee to 6 TRX...');
                
                // This requires admin/owner privileges
                const tx = await legalContract.updateSponsorshipFee(6000000).send({
                    feeLimit: 10_000_000,
                    callValue: 0,
                    shouldPollResponse: true
                });
                
                console.log('✅ Sponsorship fee updated to 6 TRX');
                console.log('Transaction:', tx);
                
                // Verify the update
                const newFee = await legalContract.sponsorshipFee().call();
                const newFeeInTRX = newFee / 1000000;
                console.log(`Verified new sponsorship fee: ${newFeeInTRX} TRX`);
                
                return true;
            } else {
                console.log('✅ Sponsorship fee already set to 6 TRX');
                return true;
            }
        } catch (error) {
            console.error('Error updating sponsorship fee:', error);
            return false;
        }
    },
    
    /**
     * Calculate fees with consolidated sponsorship
     */
    async calculateConsolidatedFee(userAddress, deliveryMethod = 'document') {
        try {
            // Check if user is law enforcement exempt
            const isExempt = await legalContract.serviceFeeExemptions(userAddress).call();
            
            // Get base fees
            const documentFee = 150;  // 150 TRX for document
            const alertFee = 15;       // 15 TRX for alert/text
            const sponsorshipFee = 6;  // 6 TRX consolidated sponsorship
            
            // Determine base fee based on delivery method
            const baseFee = deliveryMethod === 'document' ? documentFee : alertFee;
            
            if (isExempt) {
                // Law enforcement only pays consolidated sponsorship
                console.log('Law enforcement exempt - only paying 6 TRX sponsorship');
                return sponsorshipFee * 1000000; // Convert to sun
            } else {
                // Regular users pay base fee + consolidated sponsorship
                const totalFee = baseFee + sponsorshipFee;
                console.log(`Fee: ${baseFee} TRX (${deliveryMethod}) + ${sponsorshipFee} TRX (sponsorship) = ${totalFee} TRX`);
                return totalFee * 1000000; // Convert to sun
            }
        } catch (error) {
            console.error('Error calculating consolidated fee:', error);
            // Default fee if calculation fails
            return 156000000; // 156 TRX default (150 + 6)
        }
    },
    
    /**
     * Modified serve notice function without separate notification payment
     */
    async serveNoticeConsolidated(transactionData) {
        try {
            console.log('📝 Serving notice with consolidated sponsorship...');
            
            // Calculate fee with consolidated sponsorship
            const fee = await this.calculateConsolidatedFee(
                tronWeb.defaultAddress.base58,
                transactionData.deliveryMethod || 'document'
            );
            
            console.log(`Total fee (including 6 TRX sponsorship): ${fee / 1000000} TRX`);
            
            // Prepare transaction parameters
            const txParams = {
                recipient: transactionData.recipient,
                encryptedIPFS: transactionData.encryptedIPFS || '',
                encryptionKey: transactionData.encryptionKey || '',
                issuingAgency: transactionData.agencyName || '',
                noticeType: transactionData.noticeType || 'Legal Notice',
                caseNumber: transactionData.caseNumber || '',
                caseDetails: transactionData.publicText || '',
                legalRights: transactionData.rightsStatement || '',
                sponsorFees: true, // Always sponsor with consolidated amount
                metadataURI: transactionData.metadataURI || ''
            };
            
            // Send the transaction with consolidated fee
            const tx = await legalContract.serveNotice(
                txParams.recipient,
                txParams.encryptedIPFS,
                txParams.encryptionKey,
                txParams.issuingAgency,
                txParams.noticeType,
                txParams.caseNumber,
                txParams.caseDetails,
                txParams.legalRights,
                txParams.sponsorFees,
                txParams.metadataURI
            ).send({
                feeLimit: 300_000_000,
                callValue: fee,
                shouldPollResponse: true
            });
            
            console.log('✅ Notice served with consolidated 6 TRX sponsorship');
            console.log('Transaction:', tx);
            
            // NO SEPARATE NOTIFICATION PAYMENT NEEDED!
            // The recipient already received 6 TRX through the contract
            
            return tx;
            
        } catch (error) {
            console.error('Error serving notice with consolidated sponsorship:', error);
            throw error;
        }
    },
    
    /**
     * Update UI to reflect consolidated sponsorship
     */
    updateUIForConsolidation() {
        // Update fee displays
        const sponsorshipDisplays = document.querySelectorAll('[data-sponsorship-amount]');
        sponsorshipDisplays.forEach(el => {
            el.textContent = '6 TRX';
        });
        
        // Update tooltips and help text
        const tooltips = document.querySelectorAll('[data-sponsorship-tooltip]');
        tooltips.forEach(el => {
            el.title = 'Consolidated 6 TRX sponsorship (includes notification payment)';
        });
        
        // Update fee breakdown displays
        const breakdownElements = document.querySelectorAll('.fee-breakdown');
        breakdownElements.forEach(el => {
            const html = el.innerHTML;
            // Replace old sponsorship amounts
            el.innerHTML = html
                .replace(/2 TRX.*sponsorship/gi, '6 TRX (consolidated sponsorship)')
                .replace(/3\.5 TRX.*notification/gi, '') // Remove separate notification line
                .replace(/5\.5 TRX total sent/gi, '6 TRX sent via contract');
        });
    },
    
    /**
     * Check if consolidation is active
     */
    async isConsolidationActive() {
        try {
            // Check if contract is connected first
            if (!window.legalContract) {
                console.log('Contract not yet connected, skipping consolidation check');
                return false;
            }
            
            // sponsorshipFee exists at line 90 in contract - just call it directly
            const currentFee = await window.legalContract.sponsorshipFee().call();
            return currentFee === 6000000; // 6 TRX in sun
        } catch (error) {
            console.error('Error checking consolidation status:', error);
            return false;
        }
    },
    
    /**
     * Initialize consolidated sponsorship system
     */
    async initialize() {
        console.log('🔧 Initializing Consolidated Sponsorship System...');
        
        try {
            // Check if consolidation is already active
            const isActive = await this.isConsolidationActive();
            
            if (isActive) {
                console.log('✅ Consolidated sponsorship (6 TRX) is active');
                this.updateUIForConsolidation();
            } else {
                console.log('⚠️ Sponsorship fee is still 2 TRX. Run updateContractSponsorshipFee() to consolidate.');
            }
            
            // Override the original calculateFeeFromConstants if consolidation is active
            if (isActive && window.calculateFeeFromConstants) {
                window.originalCalculateFee = window.calculateFeeFromConstants;
                window.calculateFeeFromConstants = this.calculateConsolidatedFee.bind(this);
                console.log('✅ Fee calculation updated for consolidation');
            }
            
        } catch (error) {
            console.error('Error initializing consolidated sponsorship:', error);
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ConsolidatedSponsorship.initialize();
    });
} else {
    ConsolidatedSponsorship.initialize();
}

console.log('✅ Consolidated Sponsorship system loaded');
console.log('To activate: ConsolidatedSponsorship.updateContractSponsorshipFee()');