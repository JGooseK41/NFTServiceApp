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

module.exports = router;