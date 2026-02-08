/**
 * Diagnostic endpoint to debug case retrieval issues
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

/**
 * GET /api/diagnostic/cases/:walletAddress
 * Check what cases exist for a wallet across all tables
 */
router.get('/cases/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    
    console.log(`\n=== DIAGNOSTIC: Checking cases for ${walletAddress} ===`);
    
    try {
        const diagnostics = {
            wallet_address: walletAddress,
            timestamp: new Date().toISOString(),
            results: {}
        };
        
        // 1. Check cases table
        const casesQuery = `
            SELECT 
                id,
                server_address,
                status,
                created_at
            FROM cases
            WHERE server_address = $1
               OR server_address LIKE $2
               OR server_address LIKE $3
            LIMIT 10
        `;
        
        const casesResult = await pool.query(casesQuery, [
            walletAddress,
            `${walletAddress}%`,
            `%${walletAddress}%`
        ]);
        
        diagnostics.results.cases_table = {
            count: casesResult.rows.length,
            records: casesResult.rows
        };
        
        // 2. Check case_service_records
        const serviceQuery = `
            SELECT 
                case_number,
                server_address,
                alert_token_id,
                document_token_id,
                created_at
            FROM case_service_records
            WHERE server_address = $1
               OR server_address LIKE $2
               OR server_address LIKE $3
            LIMIT 10
        `;
        
        const serviceResult = await pool.query(serviceQuery, [
            walletAddress,
            `${walletAddress}%`,
            `%${walletAddress}%`
        ]);
        
        diagnostics.results.case_service_records = {
            count: serviceResult.rows.length,
            records: serviceResult.rows
        };
        
        // 3. Check all unique server addresses
        const uniqueServersQuery = `
            SELECT DISTINCT server_address, COUNT(*) as count
            FROM cases
            WHERE server_address IS NOT NULL
            GROUP BY server_address
            ORDER BY count DESC
            LIMIT 20
        `;
        
        const uniqueServers = await pool.query(uniqueServersQuery);
        diagnostics.results.unique_servers_in_cases = uniqueServers.rows;
        
        // 4. Check if address exists in different format
        const searchPatterns = [
            walletAddress.toLowerCase(),
            walletAddress.toUpperCase(),
            walletAddress.substring(0, 10) + '%', // First 10 chars
            '%' + walletAddress.substring(walletAddress.length - 10) // Last 10 chars
        ];
        
        diagnostics.results.pattern_search = {};
        
        for (const pattern of searchPatterns) {
            const patternResult = await pool.query(`
                SELECT COUNT(*) as count 
                FROM cases 
                WHERE server_address LIKE $1
            `, [pattern]);
            
            diagnostics.results.pattern_search[pattern] = patternResult.rows[0].count;
        }
        
        // 5. Check known case IDs that exist on disk
        const knownCaseIds = ['34-2312-235579', '34-9633897', '34-4343902', '34-6805299'];
        diagnostics.results.known_cases = [];
        
        for (const caseId of knownCaseIds) {
            const caseCheck = await pool.query(`
                SELECT id, server_address, status
                FROM cases
                WHERE id = $1 OR case_number = $1
                LIMIT 1
            `, [caseId]);
            
            if (caseCheck.rows.length > 0) {
                diagnostics.results.known_cases.push({
                    case_id: caseId,
                    ...caseCheck.rows[0]
                });
            } else {
                // Check case_service_records
                const serviceCheck = await pool.query(`
                    SELECT case_number, server_address
                    FROM case_service_records
                    WHERE case_number = $1
                    LIMIT 1
                `, [caseId]);
                
                if (serviceCheck.rows.length > 0) {
                    diagnostics.results.known_cases.push({
                        case_id: caseId,
                        source: 'case_service_records',
                        ...serviceCheck.rows[0]
                    });
                }
            }
        }
        
        // Log results
        console.log('Diagnostic Results:');
        console.log(`  Cases table: ${diagnostics.results.cases_table.count} records`);
        console.log(`  Case service records: ${diagnostics.results.case_service_records.count} records`);
        console.log(`  Known cases found: ${diagnostics.results.known_cases.length}`);
        
        res.json(diagnostics);
        
    } catch (error) {
        console.error('Diagnostic error:', error);
        res.status(500).json({
            error: 'Diagnostic failed',
            message: error.message
        });
    }
});

/**
 * GET /api/diagnostic/wallet-formats
 * Check all wallet address formats in the database
 */
router.get('/wallet-formats', async (req, res) => {
    try {
        const results = {};
        
        // Get sample of server addresses from cases
        const casesAddresses = await pool.query(`
            SELECT DISTINCT 
                server_address,
                COUNT(*) as count,
                LENGTH(server_address) as length,
                LEFT(server_address, 4) as prefix
            FROM cases
            WHERE server_address IS NOT NULL
            GROUP BY server_address
            ORDER BY count DESC
            LIMIT 20
        `);
        
        results.cases_addresses = casesAddresses.rows;
        
        // Get sample from case_service_records
        const serviceAddresses = await pool.query(`
            SELECT DISTINCT 
                server_address,
                COUNT(*) as count,
                LENGTH(server_address) as length,
                LEFT(server_address, 4) as prefix
            FROM case_service_records
            WHERE server_address IS NOT NULL
            GROUP BY server_address
            ORDER BY count DESC
            LIMIT 20
        `);
        
        results.service_addresses = serviceAddresses.rows;
        
        // Check for any addresses that start with TGdD
        const tgddAddresses = await pool.query(`
            SELECT DISTINCT server_address, 'cases' as source
            FROM cases
            WHERE server_address LIKE 'TGdD%'
            UNION
            SELECT DISTINCT server_address, 'case_service_records' as source
            FROM case_service_records
            WHERE server_address LIKE 'TGdD%'
        `);
        
        results.tgdd_addresses = tgddAddresses.rows;
        
        res.json(results);
        
    } catch (error) {
        console.error('Wallet format check error:', error);
        res.status(500).json({
            error: 'Check failed',
            message: error.message
        });
    }
});

/**
 * GET /api/diagnostic/wallet-tokens/:address
 * Check all data sources for a wallet's tokens
 */
router.get('/wallet-tokens/:address', async (req, res) => {
    const { address } = req.params;

    console.log(`\n=== DIAGNOSTIC: Wallet tokens for ${address} ===`);

    try {
        const results = {
            wallet_address: address,
            timestamp: new Date().toISOString(),
            case_service_records: [],
            notice_components: [],
            images: [],
            served_notices: [],
            summary: {}
        };

        // 1. Check case_service_records
        const csr = await pool.query(`
            SELECT
                case_number,
                alert_token_id,
                document_token_id,
                ipfs_hash,
                encryption_key IS NOT NULL as has_encryption_key,
                transaction_hash,
                server_name,
                served_at,
                recipients
            FROM case_service_records
            WHERE recipients::text ILIKE $1
            ORDER BY COALESCE(alert_token_id::int, 0)
        `, [`%${address}%`]);

        results.case_service_records = csr.rows;

        // Get token IDs for further queries
        const tokenIds = csr.rows.map(r => r.alert_token_id).filter(Boolean);

        // 2. Check notice_components
        if (tokenIds.length > 0) {
            const nc = await pool.query(`
                SELECT
                    notice_id,
                    alert_id,
                    document_id,
                    case_number,
                    recipient_address,
                    alert_thumbnail_url IS NOT NULL as has_alert_thumbnail,
                    document_unencrypted_url IS NOT NULL as has_document_url,
                    document_ipfs_hash,
                    document_encryption_key IS NOT NULL as has_doc_encryption_key,
                    created_at
                FROM notice_components
                WHERE alert_id = ANY($1::text[])
                   OR document_id = ANY($1::text[])
                   OR recipient_address ILIKE $2
            `, [tokenIds, `%${address}%`]);

            results.notice_components = nc.rows;
        }

        // 3. Check images table
        try {
            const images = await pool.query(`
                SELECT
                    notice_id,
                    case_number,
                    alert_image IS NOT NULL as has_alert_image,
                    document_image IS NOT NULL as has_document_image,
                    recipient_address,
                    created_at
                FROM images
                WHERE notice_id = ANY($1::text[])
                   OR recipient_address ILIKE $2
            `, [tokenIds, `%${address}%`]);

            results.images = images.rows;
        } catch (e) {
            results.images_error = e.message;
        }

        // 4. Check served_notices
        try {
            const served = await pool.query(`
                SELECT
                    notice_id,
                    alert_id,
                    document_id,
                    case_number,
                    ipfs_hash,
                    recipient_address,
                    created_at
                FROM served_notices
                WHERE recipient_address ILIKE $1
                   OR alert_id = ANY($2::text[])
            `, [`%${address}%`, tokenIds]);

            results.served_notices = served.rows;
        } catch (e) {
            results.served_notices_error = e.message;
        }

        // 5. Generate summary
        const hasPlaceholders = csr.rows.some(r => r.case_number?.includes('PLACEHOLDER'));
        const missingIpfs = csr.rows.filter(r => !r.ipfs_hash).length;
        const hasDocumentUrls = results.notice_components.some(r => r.has_document_url);

        results.summary = {
            total_tokens: csr.rows.length,
            has_placeholder_cases: hasPlaceholders,
            missing_ipfs_hashes: missingIpfs,
            has_document_urls_in_notice_components: hasDocumentUrls,
            has_images_records: results.images.length > 0,
            has_served_notices: results.served_notices.length > 0,
            diagnosis: hasPlaceholders ?
                'Placeholder case numbers indicate document data was not linked during serve process' :
                'Case data appears properly linked'
        };

        res.json(results);

    } catch (error) {
        console.error('Wallet tokens diagnostic error:', error);
        res.status(500).json({
            error: 'Diagnostic failed',
            message: error.message
        });
    }
});

/**
 * GET /api/diagnostic/contract-info
 * Get contract address, admin info, and registered process servers
 */
router.get('/contract-info', async (req, res) => {
    try {
        const results = {
            contract: {
                address: 'TAWScLCb73qn9FqgwoUZgTt5T3cwYKTWXq',
                network: 'TRON Mainnet',
                admin: 'TN6RjhuLZmgbpKvNKE8Diz7XqXnAEFWsPq'
            },
            roles: {
                ADMIN_ROLE: '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
                PROCESS_SERVER_ROLE: '0x9a92bf3818086a9bc9c8993fc551e796975ad86e56e648d4a3c3e8d756cc039c'
            },
            registered_servers: [],
            database_servers: []
        };

        // Get servers from database
        try {
            const servers = await pool.query(`
                SELECT
                    wallet_address,
                    server_name,
                    company_name,
                    status,
                    is_verified,
                    created_at
                FROM process_servers
                ORDER BY created_at DESC
            `);
            results.database_servers = servers.rows;
        } catch (e) {
            results.database_servers_error = e.message;
        }

        // Get unique server addresses from case_service_records
        try {
            const activeServers = await pool.query(`
                SELECT DISTINCT
                    server_address,
                    COUNT(*) as cases_served
                FROM case_service_records
                WHERE server_address IS NOT NULL
                GROUP BY server_address
                ORDER BY cases_served DESC
            `);
            results.active_servers = activeServers.rows;
        } catch (e) {
            results.active_servers_error = e.message;
        }

        res.json(results);

    } catch (error) {
        console.error('Contract info error:', error);
        res.status(500).json({
            error: 'Failed to get contract info',
            message: error.message
        });
    }
});

module.exports = router;