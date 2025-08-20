/**
 * Audit Logger Module
 * Logs all notice service attempts to backend for compliance and debugging
 */

class AuditLogger {
    constructor() {
        // Use the appropriate backend URL based on environment
        this.backendUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001' 
            : 'https://nft-legal-service-backend.onrender.com';
    }

    /**
     * Log an audit event
     * @param {Object} eventData - The event data to log
     */
    async logEvent(eventData) {
        try {
            // Skip audit logging if backend is unavailable
            // This prevents CORS errors from affecting the main app
            const response = await fetch(`${this.backendUrl}/api/audit/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...eventData,
                    client_ip: await this.getClientIP().catch(() => 'unknown'),
                    user_agent: navigator.userAgent,
                    metadata: {
                        ...eventData.metadata,
                        timestamp: new Date().toISOString(),
                        url: window.location.href,
                        network: this.getCurrentNetwork(),
                        wallet_type: this.getWalletType()
                    }
                })
            }).catch(error => {
                // Silently fail on network errors (including CORS)
                console.warn('Audit logging skipped due to network error');
                return null;
            });

            if (!response) {
                return { success: false, error: 'Network error' };
            }

            const result = await response.json();
            
            if (result.success) {
                console.log('Audit log created:', result.auditId);
            } else {
                console.error('Failed to create audit log:', result.error);
            }
            
            return result;
        } catch (error) {
            console.warn('Audit logging error (non-critical):', error.message);
            // Don't throw - we don't want audit logging failures to break the app
            return { success: false, error: error.message };
        }
    }

    /**
     * Log a notice attempt (before sending to blockchain)
     */
    async logNoticeAttempt(data) {
        return this.logEvent({
            status: 'attempt',
            sender_address: data.senderAddress,
            recipient_address: data.recipientAddress,
            notice_type: data.noticeType,
            case_number: data.caseNumber,
            document_hash: data.documentHash,
            metadata: {
                has_document: data.hasDocument,
                delivery_method: data.deliveryMethod,
                sponsorship_amount: data.sponsorshipAmount,
                estimated_gas: data.estimatedGas
            }
        });
    }

    /**
     * Log a successful notice
     */
    async logNoticeSuccess(data) {
        return this.logEvent({
            status: 'success',
            sender_address: data.senderAddress,
            recipient_address: data.recipientAddress,
            notice_type: data.noticeType,
            case_number: data.caseNumber,
            transaction_hash: data.transactionHash,
            gas_used: data.gasUsed,
            fee_paid: data.feePaid,
            document_hash: data.documentHash,
            ipfs_hash: data.ipfsHash,
            metadata: {
                notice_id: data.noticeId,
                alert_id: data.alertId,
                block_number: data.blockNumber,
                confirmation_time: data.confirmationTime
            }
        });
    }

    /**
     * Log a failed notice attempt
     */
    async logNoticeFailure(data) {
        // Determine error type based on error message
        let status = 'failed';
        let errorCode = 'UNKNOWN';
        
        if (data.error) {
            const errorMsg = data.error.toLowerCase();
            
            if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
                status = 'validation_error';
                errorCode = 'VALIDATION_FAILED';
            } else if (errorMsg.includes('energy') || errorMsg.includes('bandwidth')) {
                status = 'energy_error';
                errorCode = 'INSUFFICIENT_ENERGY';
            } else if (errorMsg.includes('ipfs') || errorMsg.includes('upload')) {
                status = 'ipfs_error';
                errorCode = 'IPFS_UPLOAD_FAILED';
            } else if (errorMsg.includes('revert') || errorMsg.includes('contract')) {
                status = 'blockchain_error';
                errorCode = 'CONTRACT_REVERT';
            } else if (errorMsg.includes('cancel') || errorMsg.includes('reject')) {
                status = 'user_cancelled';
                errorCode = 'USER_REJECTED';
            } else if (errorMsg.includes('balance') || errorMsg.includes('insufficient')) {
                status = 'insufficient_funds';
                errorCode = 'INSUFFICIENT_BALANCE';
            }
        }

        return this.logEvent({
            status: status,
            error_code: errorCode,
            error_message: data.error,
            sender_address: data.senderAddress,
            recipient_address: data.recipientAddress,
            notice_type: data.noticeType,
            case_number: data.caseNumber,
            document_hash: data.documentHash,
            metadata: {
                stage: data.stage, // Where in the process it failed
                has_document: data.hasDocument,
                delivery_method: data.deliveryMethod,
                attempted_at: data.attemptedAt,
                stack_trace: data.stackTrace
            }
        });
    }

    /**
     * Log validation errors
     */
    async logValidationError(data) {
        return this.logEvent({
            status: 'validation_error',
            error_code: data.errorCode || 'VALIDATION_FAILED',
            error_message: data.error,
            sender_address: data.senderAddress,
            recipient_address: data.recipientAddress,
            metadata: {
                field: data.field,
                value: data.value,
                validation_rule: data.rule
            }
        });
    }

    /**
     * Get client IP (using external service)
     */
    async getClientIP() {
        try {
            // Use a timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const response = await fetch('https://api.ipify.org?format=json', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Get current network
     */
    getCurrentNetwork() {
        if (typeof tronWeb !== 'undefined' && tronWeb.fullNode) {
            if (tronWeb.fullNode.host.includes('api.trongrid.io')) {
                return 'mainnet';
            } else if (tronWeb.fullNode.host.includes('nile')) {
                return 'nile';
            } else if (tronWeb.fullNode.host.includes('shasta')) {
                return 'shasta';
            }
        }
        return 'unknown';
    }

    /**
     * Get wallet type
     */
    getWalletType() {
        if (typeof tronWeb !== 'undefined') {
            if (window.tronLink) {
                return 'TronLink';
            } else if (window.tronWeb) {
                return 'TronWeb';
            }
        }
        return 'unknown';
    }

    /**
     * Get audit statistics
     */
    async getStatistics(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`${this.backendUrl}/api/audit/stats?${params}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching audit statistics:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get audit logs
     */
    async getLogs(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`${this.backendUrl}/api/audit/logs?${params}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Export audit logs as CSV
     */
    async exportLogs(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`${this.backendUrl}/api/audit/export?${params}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit-logs-${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                return { success: true };
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Error exporting audit logs:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
window.auditLogger = new AuditLogger();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuditLogger;
}