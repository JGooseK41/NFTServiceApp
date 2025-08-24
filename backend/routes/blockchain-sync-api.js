const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Contract address
const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

/**
 * POST /api/blockchain-sync/sync-all-owners
 * Query blockchain for all Alert NFT owners and update database
 */
router.post('/sync-all-owners', async (req, res) => {
    try {
        console.log('Starting blockchain sync for all NFT owners...');
        
        // Query TronGrid for all Transfer events from the contract
        const eventUrl = `https://api.trongrid.io/v1/contracts/${CONTRACT_ADDRESS}/events`;
        
        const response = await axios.get(eventUrl, {
            params: {
                event_name: 'Transfer',
                limit: 200,
                order_by: 'block_timestamp,asc'
            },
            headers: process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {}
        });
        
        const transferEvents = response.data.data || [];
        
        // Process Transfer events to find current owners
        const nftOwnership = new Map();
        
        for (const event of transferEvents) {
            if (event.result) {
                const tokenId = parseInt(event.result.tokenId || event.result[2]);
                const toAddress = event.result.to || event.result[1];
                
                // Update ownership (last transfer is current owner)
                nftOwnership.set(tokenId, toAddress);
            }
        }
        
        // Separate Alert NFTs (odd) from Document NFTs (even)
        const alertNFTOwners = new Map();
        
        for (const [tokenId, owner] of nftOwnership.entries()) {
            if (tokenId % 2 === 1) { // Alert NFT (odd number)
                // Skip if owner is the contract itself
                if (owner !== CONTRACT_ADDRESS) {
                    alertNFTOwners.set(tokenId.toString(), owner);
                }
            }
        }
        
        console.log(`Found ${alertNFTOwners.size} Alert NFTs with recipient owners`);
        
        // Update database with correct ownership
        const results = [];
        let updatedCount = 0;
        let addedCount = 0;
        
        for (const [alertId, walletAddress] of alertNFTOwners.entries()) {
            const documentId = (parseInt(alertId) + 1).toString();
            
            // Check if record exists
            const checkQuery = `
                SELECT recipients, case_number 
                FROM case_service_records 
                WHERE alert_token_id = $1
            `;
            
            const existing = await pool.query(checkQuery, [alertId]);
            
            if (existing.rows.length > 0) {
                // Update existing record with correct recipient
                const updateQuery = `
                    UPDATE case_service_records 
                    SET recipients = $1::jsonb,
                        document_token_id = COALESCE(document_token_id, $2)
                    WHERE alert_token_id = $3
                    RETURNING *
                `;
                
                await pool.query(updateQuery, [
                    JSON.stringify([walletAddress]),
                    documentId,
                    alertId
                ]);
                
                updatedCount++;
                results.push({
                    alertId,
                    walletAddress,
                    action: 'updated',
                    caseNumber: existing.rows[0].case_number
                });
                
            } else {
                // Add new record
                const caseNumber = `24-CV-${alertId.padStart(6, '0')}`;
                
                const insertQuery = `
                    INSERT INTO case_service_records (
                        case_number,
                        alert_token_id,
                        document_token_id,
                        recipients,
                        served_at,
                        transaction_hash,
                        accepted
                    ) VALUES (
                        $1, $2, $3, $4::jsonb, NOW(), $5, false
                    )
                `;
                
                await pool.query(insertQuery, [
                    caseNumber,
                    alertId,
                    documentId,
                    JSON.stringify([walletAddress]),
                    `blockchain_sync_${alertId}`
                ]);
                
                addedCount++;
                results.push({
                    alertId,
                    walletAddress,
                    action: 'added',
                    caseNumber
                });
            }
        }
        
        // Get final summary
        const summaryQuery = `
            SELECT 
                recipients,
                COUNT(*) as notice_count,
                array_agg(alert_token_id ORDER BY alert_token_id::int) as alert_tokens
            FROM case_service_records
            WHERE recipients IS NOT NULL
            GROUP BY recipients
            ORDER BY notice_count DESC
        `;
        
        const summary = await pool.query(summaryQuery);
        
        res.json({
            success: true,
            message: `Synced ${alertNFTOwners.size} Alert NFTs from blockchain`,
            stats: {
                totalAlertNFTs: alertNFTOwners.size,
                recordsUpdated: updatedCount,
                recordsAdded: addedCount
            },
            results,
            walletSummary: summary.rows.map(row => ({
                wallet: JSON.parse(row.recipients)[0],
                noticeCount: parseInt(row.notice_count),
                alertTokens: row.alert_tokens
            }))
        });
        
    } catch (error) {
        console.error('Error syncing from blockchain:', error);
        res.status(500).json({ 
            error: 'Failed to sync from blockchain',
            success: false,
            details: error.message
        });
    }
});

/**
 * POST /api/blockchain-sync/process-event-data
 * Process blockchain event data to update NFT ownership
 */
router.post('/process-event-data', async (req, res) => {
    try {
        const { events } = req.body;
        
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ 
                error: 'Events array required in request body',
                success: false
            });
        }
        
        console.log(`Processing ${events.length} blockchain events...`);
        
        // Extract Alert NFT ownership from events
        const alertNFTOwners = new Map();
        
        for (const event of events) {
            if (event.event === 'Transfer' || event.Events?.includes('Transfer')) {
                // Extract token ID and recipient
                let tokenId, recipient;
                
                if (event.Topics && event.Topics.length >= 4) {
                    tokenId = parseInt(event.Topics[3]);
                    recipient = event.Topics[2];
                } else if (event.tokenId && event.to) {
                    tokenId = parseInt(event.tokenId);
                    recipient = event.to;
                }
                
                // Only track Alert NFTs (odd numbers) not owned by contract
                if (tokenId && tokenId % 2 === 1 && recipient && recipient !== CONTRACT_ADDRESS) {
                    alertNFTOwners.set(tokenId.toString(), recipient);
                }
            }
        }
        
        console.log(`Found ${alertNFTOwners.size} Alert NFTs to process`);
        
        // Update database
        const results = [];
        let updatedCount = 0;
        
        for (const [alertId, walletAddress] of alertNFTOwners.entries()) {
            const documentId = (parseInt(alertId) + 1).toString();
            
            const updateQuery = `
                UPDATE case_service_records 
                SET recipients = $1::jsonb,
                    document_token_id = COALESCE(document_token_id, $2)
                WHERE alert_token_id = $3
                RETURNING case_number
            `;
            
            const result = await pool.query(updateQuery, [
                JSON.stringify([walletAddress]),
                documentId,
                alertId
            ]);
            
            if (result.rows.length > 0) {
                updatedCount++;
                results.push({
                    alertId,
                    documentId,
                    wallet: walletAddress,
                    caseNumber: result.rows[0].case_number,
                    status: 'updated'
                });
            }
        }
        
        res.json({
            success: true,
            message: `Processed ${alertNFTOwners.size} Alert NFTs`,
            updatedCount,
            results
        });
        
    } catch (error) {
        console.error('Error processing event data:', error);
        res.status(500).json({ 
            error: 'Failed to process event data',
            success: false,
            details: error.message
        });
    }
});

/**
 * POST /api/blockchain-sync/fix-known-wallets
 * Fix known wallet mappings from blockchain data
 */
router.post('/fix-known-wallets', async (req, res) => {
    try {
        // Known mappings from blockchain events
        const knownMappings = [
            // From the data you provided
            { alertId: '39', wallet: 'TArxGhbLdY6ApwaCYZbwdZYiHBG96heiwp' },
            { alertId: '41', wallet: 'TUNKp7upGiHt9tamt37VfjHRPUUbZ1yNKS' },
            { alertId: '43', wallet: 'TVPPcD8P8QWK5eix6B6r5nVNaUFUHfUohe' },
            { alertId: '45', wallet: 'TCULAeahAiC9nvurUzxvusGRLD2JxoY5Yw' },
            // Previously known
            { alertId: '1', wallet: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH' },
            { alertId: '17', wallet: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH' },
            { alertId: '29', wallet: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH' },
            { alertId: '37', wallet: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH' }
        ];
        
        // Add any additional mappings from request
        if (req.body && req.body.additionalMappings) {
            knownMappings.push(...req.body.additionalMappings);
        }
        
        const results = [];
        let fixedCount = 0;
        
        for (const mapping of knownMappings) {
            const documentId = (parseInt(mapping.alertId) + 1).toString();
            
            const updateQuery = `
                UPDATE case_service_records 
                SET recipients = $1::jsonb,
                    document_token_id = COALESCE(document_token_id, $2)
                WHERE alert_token_id = $3
                RETURNING case_number
            `;
            
            const result = await pool.query(updateQuery, [
                JSON.stringify([mapping.wallet]),
                documentId,
                mapping.alertId
            ]);
            
            if (result.rows.length > 0) {
                fixedCount++;
                results.push({
                    ...mapping,
                    documentId,
                    caseNumber: result.rows[0].case_number,
                    status: 'fixed'
                });
            } else {
                results.push({
                    ...mapping,
                    status: 'not_found'
                });
            }
        }
        
        // Get summary of all wallets
        const summaryQuery = `
            SELECT 
                recipients,
                COUNT(*) as notice_count,
                array_agg(alert_token_id ORDER BY alert_token_id::int) as alert_tokens
            FROM case_service_records
            WHERE recipients IS NOT NULL AND recipients != '[]'
            GROUP BY recipients
            ORDER BY notice_count DESC
        `;
        
        const summary = await pool.query(summaryQuery);
        
        res.json({
            success: true,
            message: `Fixed ${fixedCount} wallet mappings`,
            fixedCount,
            results,
            allWallets: summary.rows.map(row => {
                const recipients = JSON.parse(row.recipients);
                return {
                    wallet: recipients[0],
                    noticeCount: parseInt(row.notice_count),
                    alertTokens: row.alert_tokens
                };
            })
        });
        
    } catch (error) {
        console.error('Error fixing known wallets:', error);
        res.status(500).json({ 
            error: 'Failed to fix known wallets',
            success: false,
            details: error.message
        });
    }
});

module.exports = router;