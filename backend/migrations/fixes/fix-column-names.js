/**
 * Column Name Standardization Script
 * 
 * This script standardizes column names across the database to fix naming inconsistencies.
 * 
 * STANDARD NAMING CONVENTION:
 * - process_servers table:
 *   - agency (not agency_name) - The agency/company name
 *   - name (not server_name) - The person's name
 *   - email (not contact_email or agency_email) - Contact email
 *   - phone (not phone_number) - Phone number
 *   - wallet_address - TRON wallet address
 *   - server_id - Unique server ID
 *   - license_number - Professional license
 *   - jurisdiction (not jurisdictions) - Service area
 * 
 * - served_notices table:
 *   - issuing_agency - The agency that issued the notice
 *   - server_address - The wallet address of the process server
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function standardizeColumns() {
    let client;
    
    try {
        console.log('Connecting to database...');
        client = await pool.connect();
        
        console.log('\n=== STANDARDIZING PROCESS_SERVERS TABLE ===');
        
        // Get current columns
        const currentCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers'
            ORDER BY ordinal_position
        `);
        
        console.log('Current columns:', currentCols.rows.map(r => r.column_name).join(', '));
        
        // Column mapping: old_name -> new_name
        const columnMappings = {
            'agency_name': 'agency',
            'server_name': 'name', 
            'contact_email': 'email',
            'agency_email': 'email',
            'phone_number': 'phone',
            'jurisdictions': 'jurisdiction'
        };
        
        const existingColumns = currentCols.rows.map(r => r.column_name);
        
        // Rename columns if needed
        for (const [oldName, newName] of Object.entries(columnMappings)) {
            if (existingColumns.includes(oldName) && !existingColumns.includes(newName)) {
                console.log(`Renaming column: ${oldName} -> ${newName}`);
                try {
                    await client.query(`ALTER TABLE process_servers RENAME COLUMN ${oldName} TO ${newName}`);
                    console.log(`✓ Renamed ${oldName} to ${newName}`);
                } catch (err) {
                    console.log(`! Could not rename ${oldName}: ${err.message}`);
                }
            } else if (existingColumns.includes(oldName) && existingColumns.includes(newName)) {
                // Both columns exist - merge data
                console.log(`Merging data from ${oldName} into ${newName}`);
                try {
                    await client.query(`UPDATE process_servers SET ${newName} = COALESCE(${newName}, ${oldName}) WHERE ${newName} IS NULL OR ${newName} = ''`);
                    await client.query(`ALTER TABLE process_servers DROP COLUMN ${oldName}`);
                    console.log(`✓ Merged and dropped ${oldName}`);
                } catch (err) {
                    console.log(`! Could not merge ${oldName}: ${err.message}`);
                }
            }
        }
        
        // Ensure all required columns exist with correct types
        const requiredColumns = {
            'id': 'SERIAL PRIMARY KEY',
            'wallet_address': 'VARCHAR(255) UNIQUE NOT NULL',
            'name': 'VARCHAR(255)',
            'agency': 'VARCHAR(255)',
            'email': 'VARCHAR(255)',
            'phone': 'VARCHAR(50)',
            'server_id': 'VARCHAR(100) UNIQUE',
            'status': "VARCHAR(50) DEFAULT 'pending'",
            'jurisdiction': 'VARCHAR(255)',
            'license_number': 'VARCHAR(100)',
            'notes': 'TEXT',
            'registration_data': 'JSONB',
            'created_at': 'TIMESTAMP DEFAULT NOW()',
            'updated_at': 'TIMESTAMP DEFAULT NOW()',
            'approved_at': 'TIMESTAMP',
            'approved_by': 'VARCHAR(255)'
        };
        
        // Get updated column list
        const updatedCols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers'
        `);
        const updatedColNames = updatedCols.rows.map(r => r.column_name);
        
        // Add missing columns
        for (const [colName, colType] of Object.entries(requiredColumns)) {
            if (!updatedColNames.includes(colName) && colName !== 'id') {
                console.log(`Adding missing column: ${colName}`);
                try {
                    await client.query(`ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS ${colName} ${colType}`);
                    console.log(`✓ Added ${colName}`);
                } catch (err) {
                    console.log(`! Could not add ${colName}: ${err.message}`);
                }
            }
        }
        
        // Drop unnecessary columns
        const unnecessaryColumns = ['total_notices_served', 'average_rating', 'verification_documents', 'physical_address', 'website'];
        for (const colName of unnecessaryColumns) {
            if (updatedColNames.includes(colName)) {
                console.log(`Dropping unnecessary column: ${colName}`);
                try {
                    await client.query(`ALTER TABLE process_servers DROP COLUMN IF EXISTS ${colName}`);
                    console.log(`✓ Dropped ${colName}`);
                } catch (err) {
                    console.log(`! Could not drop ${colName}: ${err.message}`);
                }
            }
        }
        
        // Migrate data from served_notices if needed
        console.log('\n=== MIGRATING DATA FROM SERVED_NOTICES ===');
        
        const existingServers = await client.query(`
            SELECT DISTINCT 
                server_address as wallet_address,
                issuing_agency as agency
            FROM served_notices
            WHERE server_address IS NOT NULL
            AND server_address NOT IN (SELECT wallet_address FROM process_servers)
        `);
        
        if (existingServers.rows.length > 0) {
            console.log(`Found ${existingServers.rows.length} servers to migrate`);
            
            for (const server of existingServers.rows) {
                if (server.wallet_address) {
                    try {
                        await client.query(`
                            INSERT INTO process_servers (wallet_address, agency, status, server_id)
                            VALUES ($1, $2, 'approved', $3)
                            ON CONFLICT (wallet_address) DO UPDATE
                            SET agency = COALESCE(process_servers.agency, EXCLUDED.agency)
                        `, [
                            server.wallet_address,
                            server.agency || 'Unknown Agency',
                            `PS-${Date.now().toString(36).toUpperCase()}`
                        ]);
                        console.log(`✓ Migrated: ${server.wallet_address}`);
                    } catch (err) {
                        console.log(`! Could not migrate ${server.wallet_address}: ${err.message}`);
                    }
                }
            }
        }
        
        // Final verification
        console.log('\n=== FINAL TABLE STRUCTURE ===');
        const finalCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers'
            ORDER BY ordinal_position
        `);
        
        console.log('Final columns:');
        finalCols.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
        
        // Get count
        const countResult = await client.query('SELECT COUNT(*) FROM process_servers');
        console.log(`\nTotal process servers: ${countResult.rows[0].count}`);
        
        // Show sample data
        const sampleData = await client.query('SELECT wallet_address, name, agency, email, status FROM process_servers LIMIT 3');
        if (sampleData.rows.length > 0) {
            console.log('\nSample data:');
            sampleData.rows.forEach(row => {
                console.log(`  - ${row.wallet_address}: ${row.name || 'N/A'} | ${row.agency || 'N/A'} | ${row.status}`);
            });
        }
        
        console.log('\n✅ Column standardization complete!');
        
    } catch (error) {
        console.error('❌ Standardization failed:', error);
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the standardization
standardizeColumns().then(() => {
    console.log('Script finished');
    process.exit(0);
}).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});