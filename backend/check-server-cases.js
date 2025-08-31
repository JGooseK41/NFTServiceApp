/**
 * Check what cases exist for server wallet TGdD34...
 */

const { Client } = require('pg');
require('dotenv').config();

async function checkServerCases() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
        ssl: { rejectUnauthorized: false }
    });
    
    const walletPatterns = [
        'TGdD34%',  // Starts with TGdD34
        '%TGdD34%', // Contains TGdD34
    ];
    
    console.log('\n=== CHECKING CASES FOR WALLET TGdD34... ===\n');
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // 1. Check cases table
        console.log('1. CASES TABLE');
        console.log('-'.repeat(50));
        
        for (const pattern of walletPatterns) {
            const casesResult = await client.query(`
                SELECT 
                    id,
                    server_address,
                    status,
                    created_at
                FROM cases
                WHERE server_address LIKE $1
                LIMIT 10
            `, [pattern]);
            
            if (casesResult.rows.length > 0) {
                console.log(`Found ${casesResult.rows.length} cases with pattern "${pattern}":`);
                casesResult.rows.forEach(row => {
                    console.log(`  ID: ${row.id}`);
                    console.log(`  Server: ${row.server_address}`);
                    console.log(`  Status: ${row.status}`);
                    console.log(`  Created: ${row.created_at}`);
                    console.log('');
                });
            }
        }
        
        // Also check exact match
        const exactResult = await client.query(`
            SELECT COUNT(*) as count, server_address
            FROM cases
            GROUP BY server_address
            ORDER BY count DESC
            LIMIT 10
        `);
        
        console.log('\nTop server addresses in cases table:');
        exactResult.rows.forEach(row => {
            console.log(`  ${row.server_address}: ${row.count} cases`);
        });
        
        // 2. Check case_service_records table
        console.log('\n\n2. CASE_SERVICE_RECORDS TABLE');
        console.log('-'.repeat(50));
        
        for (const pattern of walletPatterns) {
            const serviceResult = await client.query(`
                SELECT 
                    case_number,
                    server_address,
                    alert_token_id,
                    document_token_id,
                    created_at
                FROM case_service_records
                WHERE server_address LIKE $1
                LIMIT 10
            `, [pattern]);
            
            if (serviceResult.rows.length > 0) {
                console.log(`Found ${serviceResult.rows.length} records with pattern "${pattern}":`);
                serviceResult.rows.forEach(row => {
                    console.log(`  Case: ${row.case_number}`);
                    console.log(`  Server: ${row.server_address}`);
                    console.log(`  Alert NFT: ${row.alert_token_id}`);
                    console.log(`  Document NFT: ${row.document_token_id}`);
                    console.log(`  Created: ${row.created_at}`);
                    console.log('');
                });
            }
        }
        
        // Check exact server addresses
        const serviceServers = await client.query(`
            SELECT COUNT(*) as count, server_address
            FROM case_service_records
            WHERE server_address IS NOT NULL
            GROUP BY server_address
            ORDER BY count DESC
            LIMIT 10
        `);
        
        console.log('\nTop server addresses in case_service_records:');
        serviceServers.rows.forEach(row => {
            console.log(`  ${row.server_address}: ${row.count} records`);
        });
        
        // 3. Check if the wallet might be stored differently
        console.log('\n\n3. SEARCHING FOR VARIATIONS');
        console.log('-'.repeat(50));
        
        // Check if it's stored in different formats
        const variations = [
            'TGdD34', // exact
            '0x' + Buffer.from('TGdD34').toString('hex'), // hex encoded
            'TGdD34'.toLowerCase(), // lowercase
            'TGdD34'.toUpperCase(), // uppercase
        ];
        
        for (const variant of variations) {
            const variantResult = await client.query(`
                SELECT COUNT(*) as count 
                FROM cases 
                WHERE server_address = $1
            `, [variant]);
            
            if (variantResult.rows[0].count > 0) {
                console.log(`Found ${variantResult.rows[0].count} cases with exact match: "${variant}"`);
            }
        }
        
        // 4. Check for any case directories on disk that might give us clues
        console.log('\n\n4. CASE IDs FROM DISK (we know these exist):');
        console.log('-'.repeat(50));
        const knownCases = [
            '34-2312-235579',
            '34-9633897',
            '34-4343902',
            '34-6805299'
        ];
        
        for (const caseId of knownCases) {
            const diskCase = await client.query(`
                SELECT server_address, status, created_at 
                FROM cases 
                WHERE id = $1 OR case_number = $1
            `, [caseId]);
            
            if (diskCase.rows.length > 0) {
                console.log(`Case ${caseId}:`);
                console.log(`  Server: ${diskCase.rows[0].server_address}`);
                console.log(`  Status: ${diskCase.rows[0].status}`);
            } else {
                console.log(`Case ${caseId}: NOT IN CASES TABLE`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
        console.log('\n✅ Check complete');
    }
}

checkServerCases();