/**
 * Simple IPFS Recovery Script
 * Recovers documents using just IPFS hashes from served_notices table
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkDatabase() {
    console.log('🔍 Checking database for IPFS data...\n');
    
    try {
        // First, let's see what we have in served_notices
        const checkQuery = `
            SELECT 
                notice_id,
                ipfs_hash,
                case_number,
                server_address,
                recipient_address,
                created_at
            FROM served_notices
            WHERE ipfs_hash IS NOT NULL 
            AND ipfs_hash != ''
            ORDER BY created_at DESC
            LIMIT 10;
        `;
        
        const result = await pool.query(checkQuery);
        
        console.log(`Found ${result.rows.length} notices with IPFS hashes\n`);
        
        if (result.rows.length > 0) {
            console.log('Sample notices with IPFS data:');
            result.rows.forEach(row => {
                console.log(`Notice ID: ${row.notice_id}`);
                console.log(`IPFS Hash: ${row.ipfs_hash}`);
                console.log(`Case: ${row.case_number}`);
                console.log(`Created: ${row.created_at}`);
                console.log('---');
            });
        }
        
        // Check if we have encryption keys anywhere
        console.log('\n🔍 Checking for encryption keys...\n');
        
        // Check column existence
        const columnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'served_notices' 
            AND column_name LIKE '%encrypt%';
        `;
        
        const columns = await pool.query(columnQuery);
        
        if (columns.rows.length > 0) {
            console.log('Encryption-related columns found:');
            columns.rows.forEach(col => console.log(`  - ${col.column_name}`));
        } else {
            console.log('❌ No encryption key columns found in served_notices');
            console.log('\nEncryption keys might be:');
            console.log('1. In transaction data on blockchain');
            console.log('2. In a different table');
            console.log('3. Need to be retrieved from frontend localStorage');
        }
        
        // Check other tables
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;
        
        const tables = await pool.query(tablesQuery);
        
        console.log('\n📊 Available tables in database:');
        tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
        
        // Check for encryption keys in other tables
        console.log('\n🔍 Searching all tables for encryption keys...');
        
        for (const table of tables.rows) {
            const encryptQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 
                AND (column_name LIKE '%encrypt%' OR column_name LIKE '%key%');
            `;
            
            const encryptCols = await pool.query(encryptQuery, [table.table_name]);
            
            if (encryptCols.rows.length > 0) {
                console.log(`\nTable: ${table.table_name}`);
                encryptCols.rows.forEach(col => console.log(`  - ${col.column_name}`));
                
                // Check if any rows have encryption keys
                try {
                    for (const col of encryptCols.rows) {
                        const dataQuery = `
                            SELECT COUNT(*) as count 
                            FROM ${table.table_name} 
                            WHERE ${col.column_name} IS NOT NULL 
                            AND ${col.column_name} != '';
                        `;
                        const dataResult = await pool.query(dataQuery);
                        if (dataResult.rows[0].count > 0) {
                            console.log(`    ✅ ${col.column_name} has ${dataResult.rows[0].count} non-null values`);
                        }
                    }
                } catch (e) {
                    // Ignore errors from system tables
                }
            }
        }
        
    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        await pool.end();
    }
}

// Run the check
checkDatabase();