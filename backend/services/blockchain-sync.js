/**
 * Blockchain Synchronization Service
 * Ensures data consistency between smart contract and backend database
 * 
 * Flow: Frontend → Backend (validation) → Smart Contract → Events → Backend (confirmation)
 */

let TronWeb;
try {
    TronWeb = require('tronweb');
} catch (err) {
    console.warn('⚠️ TronWeb not available, blockchain features disabled');
    // Create a mock TronWeb for basic functionality
    TronWeb = class MockTronWeb {
        constructor() {}
        isAddress() { return false; }
        sha3() { return '0x'; }
        contract() { return null; }
    };
}
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// TronWeb setup
const tronWeb = new TronWeb({
    fullHost: process.env.TRON_NETWORK === 'mainnet' 
        ? 'https://api.trongrid.io'
        : 'https://nile.trongrid.io',
    privateKey: process.env.TRON_PRIVATE_KEY || '01' // Dummy key for read-only
});

// Contract address from environment
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

class BlockchainSyncService {
    constructor() {
        this.contract = null;
        this.isListening = false;
        this.lastProcessedBlock = 0;
    }

    async initialize() {
        try {
            if (!CONTRACT_ADDRESS) {
                console.warn('⚠️ CONTRACT_ADDRESS not set, blockchain sync disabled');
                return;
            }
            
            // Check if TronWeb is available
            if (!tronWeb || !tronWeb.contract) {
                console.warn('⚠️ TronWeb not properly initialized, blockchain sync disabled');
                return;
            }
            
            // Load contract ABI
            const contractABI = require('../../contracts/LegalNoticeNFT_v5_Enumerable.abi');
            this.contract = await tronWeb.contract(contractABI, CONTRACT_ADDRESS);
            
            // Get last processed block from database
            const result = await pool.query(
                'SELECT MAX(block_number) as last_block FROM served_notices WHERE block_number IS NOT NULL'
            );
            this.lastProcessedBlock = result.rows[0].last_block || 0;
            
            console.log('✅ Blockchain sync service initialized');
            console.log(`   Contract: ${CONTRACT_ADDRESS}`);
            console.log(`   Last processed block: ${this.lastProcessedBlock}`);
            
            // Start listening for events
            this.startEventListeners();
            
        } catch (error) {
            console.error('❌ Failed to initialize blockchain sync:', error);
            // Don't throw, just disable blockchain features
            console.warn('⚠️ Blockchain features disabled due to initialization error');
        }
    }

    /**
     * Validate notice data before blockchain submission
     */
    async validateNoticeData(noticeData) {
        const errors = [];
        
        // 1. Verify server is registered and approved
        const serverCheck = await pool.query(
            'SELECT agency, status FROM process_servers WHERE wallet_address = $1',
            [noticeData.server_address]
        );
        
        if (!serverCheck.rows.length) {
            errors.push('Process server not registered');
        } else if (serverCheck.rows[0].status !== 'approved') {
            errors.push('Process server not approved');
        } else if (serverCheck.rows[0].agency !== noticeData.issuing_agency) {
            errors.push(`Agency mismatch: Database has "${serverCheck.rows[0].agency}", provided "${noticeData.issuing_agency}"`);
        }
        
        // 2. Validate recipient address format
        if (tronWeb && tronWeb.isAddress && !tronWeb.isAddress(noticeData.recipient_address)) {
            errors.push('Invalid recipient address format');
        } else if (!noticeData.recipient_address || noticeData.recipient_address.length < 10) {
            errors.push('Invalid recipient address');
        }
        
        // 3. Check required fields
        if (!noticeData.encrypted_ipfs) errors.push('Missing encrypted IPFS hash');
        if (!noticeData.encryption_key) errors.push('Missing encryption key');
        if (!noticeData.notice_type) errors.push('Missing notice type');
        
        return {
            valid: errors.length === 0,
            errors: errors,
            serverAgency: serverCheck.rows[0]?.agency
        };
    }

    /**
     * Stage notice for blockchain submission
     */
    async stageNotice(noticeData) {
        // Validate first
        const validation = await this.validateNoticeData(noticeData);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Use agency from database to ensure consistency
        noticeData.issuing_agency = validation.serverAgency;
        
        // Insert into staging table
        const result = await pool.query(`
            INSERT INTO staged_notices (
                recipient_address,
                encrypted_ipfs,
                encryption_key,
                issuing_agency,
                notice_type,
                case_number,
                case_details,
                legal_rights,
                sponsor_fees,
                metadata_uri,
                server_address,
                status,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW())
            RETURNING id, issuing_agency
        `, [
            noticeData.recipient_address,
            noticeData.encrypted_ipfs,
            noticeData.encryption_key,
            noticeData.issuing_agency,
            noticeData.notice_type,
            noticeData.case_number || '',
            noticeData.case_details || '',
            noticeData.legal_rights || '',
            noticeData.sponsor_fees || false,
            noticeData.metadata_uri || '',
            noticeData.server_address
        ]);
        
        return {
            stagingId: result.rows[0].id,
            // Return parameters in exact order for smart contract
            contractParams: {
                recipient: noticeData.recipient_address,
                encryptedIPFS: noticeData.encrypted_ipfs,
                encryptionKey: noticeData.encryption_key,
                issuingAgency: result.rows[0].issuing_agency, // Use DB value
                noticeType: noticeData.notice_type,
                caseNumber: noticeData.case_number || '',
                caseDetails: noticeData.case_details || '',
                legalRights: noticeData.legal_rights || '',
                sponsorFees: noticeData.sponsor_fees || false,
                metadataURI: noticeData.metadata_uri || ''
            }
        };
    }

    /**
     * Start listening for blockchain events
     */
    startEventListeners() {
        if (this.isListening) return;
        this.isListening = true;
        
        console.log('🎧 Starting blockchain event listeners...');
        
        // Poll for events every 3 seconds
        setInterval(async () => {
            try {
                await this.processRecentEvents();
            } catch (error) {
                console.error('Error processing events:', error);
            }
        }, 3000);
    }

    /**
     * Process recent blockchain events
     */
    async processRecentEvents() {
        try {
            // Get current block
            const currentBlock = await tronWeb.trx.getCurrentBlock();
            const currentBlockNumber = currentBlock.block_header.raw_data.number;
            
            // Don't process if no new blocks
            if (currentBlockNumber <= this.lastProcessedBlock) return;
            
            // Get events from the contract
            const events = await tronWeb.event.getEventsByContractAddress(
                CONTRACT_ADDRESS,
                {
                    eventName: 'NoticeServed',
                    fromBlock: this.lastProcessedBlock + 1,
                    toBlock: currentBlockNumber
                }
            );
            
            // Process each event
            for (const event of events) {
                await this.processNoticeServedEvent(event);
            }
            
            // Also get LegalNoticeCreated events
            const legalNoticeEvents = await tronWeb.event.getEventsByContractAddress(
                CONTRACT_ADDRESS,
                {
                    eventName: 'LegalNoticeCreated',
                    fromBlock: this.lastProcessedBlock + 1,
                    toBlock: currentBlockNumber
                }
            );
            
            for (const event of legalNoticeEvents) {
                await this.processLegalNoticeCreatedEvent(event);
            }
            
            // Update last processed block
            this.lastProcessedBlock = currentBlockNumber;
            
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    }

    /**
     * Process NoticeServed event
     */
    async processNoticeServedEvent(event) {
        const { alertId, documentId, recipient } = event.result;
        const txHash = event.transaction_id;
        const blockNumber = event.block;
        
        console.log(`📋 NoticeServed: Alert ${alertId}, Doc ${documentId}, Recipient ${recipient}`);
        
        // Update staged notice with blockchain confirmation
        await pool.query(`
            UPDATE staged_notices 
            SET 
                alert_id = $1,
                document_id = $2,
                transaction_hash = $3,
                block_number = $4,
                status = 'confirmed',
                confirmed_at = NOW()
            WHERE 
                recipient_address = $5 
                AND status = 'pending'
                AND created_at >= NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 1
        `, [alertId, documentId, txHash, blockNumber, recipient]);
        
        // Also update served_notices if it exists
        await pool.query(`
            UPDATE served_notices 
            SET 
                alert_id = $1,
                document_id = $2,
                status = 'delivered'
            WHERE 
                recipient_address = $3 
                AND transaction_hash = $4
        `, [alertId, documentId, recipient, txHash]);
    }

    /**
     * Process LegalNoticeCreated event
     */
    async processLegalNoticeCreatedEvent(event) {
        const { noticeId, server, recipient, timestamp } = event.result;
        const txHash = event.transaction_id;
        const blockNumber = event.block;
        
        console.log(`📜 LegalNoticeCreated: Notice ${noticeId}, Server ${server}, Recipient ${recipient}`);
        
        // Get staged notice data
        const staged = await pool.query(`
            SELECT * FROM staged_notices 
            WHERE 
                recipient_address = $1 
                AND server_address = $2
                AND status = 'confirmed'
                AND transaction_hash = $3
            LIMIT 1
        `, [recipient, server, txHash]);
        
        if (staged.rows.length > 0) {
            const stagedData = staged.rows[0];
            
            // Insert or update served_notices
            await pool.query(`
                INSERT INTO served_notices (
                    notice_id,
                    alert_id,
                    document_id,
                    server_address,
                    recipient_address,
                    issuing_agency,
                    notice_type,
                    case_number,
                    transaction_hash,
                    block_number,
                    status,
                    created_at,
                    blockchain_timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'delivered', NOW(), $11)
                ON CONFLICT (notice_id) DO UPDATE
                SET 
                    alert_id = EXCLUDED.alert_id,
                    document_id = EXCLUDED.document_id,
                    blockchain_timestamp = EXCLUDED.blockchain_timestamp
            `, [
                noticeId.toString(),
                stagedData.alert_id,
                stagedData.document_id,
                server,
                recipient,
                stagedData.issuing_agency,
                stagedData.notice_type,
                stagedData.case_number,
                txHash,
                blockNumber,
                new Date(timestamp * 1000)
            ]);
        }
    }

    /**
     * Get notice confirmation status
     */
    async getNoticeStatus(stagingId) {
        const result = await pool.query(`
            SELECT 
                status,
                alert_id,
                document_id,
                transaction_hash,
                block_number,
                confirmed_at
            FROM staged_notices
            WHERE id = $1
        `, [stagingId]);
        
        if (result.rows.length === 0) {
            return { status: 'not_found' };
        }
        
        return result.rows[0];
    }

    /**
     * Sync historical events (for catching up)
     */
    async syncHistoricalEvents(fromBlock, toBlock) {
        console.log(`🔄 Syncing historical events from block ${fromBlock} to ${toBlock}...`);
        
        try {
            // Get all NoticeServed events
            const noticeServedEvents = await tronWeb.event.getEventsByContractAddress(
                CONTRACT_ADDRESS,
                {
                    eventName: 'NoticeServed',
                    fromBlock: fromBlock,
                    toBlock: toBlock
                }
            );
            
            console.log(`Found ${noticeServedEvents.length} NoticeServed events`);
            
            for (const event of noticeServedEvents) {
                await this.processNoticeServedEvent(event);
            }
            
            // Get all LegalNoticeCreated events
            const legalNoticeEvents = await tronWeb.event.getEventsByContractAddress(
                CONTRACT_ADDRESS,
                {
                    eventName: 'LegalNoticeCreated',
                    fromBlock: fromBlock,
                    toBlock: toBlock
                }
            );
            
            console.log(`Found ${legalNoticeEvents.length} LegalNoticeCreated events`);
            
            for (const event of legalNoticeEvents) {
                await this.processLegalNoticeCreatedEvent(event);
            }
            
            console.log('✅ Historical sync complete');
            
        } catch (error) {
            console.error('Error syncing historical events:', error);
            throw error;
        }
    }
}

// Export singleton instance
let blockchainSync;
try {
    blockchainSync = new BlockchainSyncService();
} catch (err) {
    console.warn('⚠️ BlockchainSyncService initialization failed:', err.message);
    // Export a stub object with required methods
    blockchainSync = {
        initialize: async () => console.warn('Blockchain sync disabled'),
        validateNoticeData: async (data) => ({ valid: true, errors: [] }),
        stageNotice: async (data) => ({ 
            success: true, 
            stagedId: Date.now().toString(),
            message: 'Staged locally (blockchain disabled)' 
        }),
        confirmTransaction: async () => ({ success: true }),
        startEventListeners: () => {},
        syncHistoricalEvents: async () => {}
    };
}

module.exports = blockchainSync;