/**
 * Fix server_id column type and complete standardization
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixServerIdType() {
    let client;
    
    try {
        console.log('Connecting to database...');
        client = await pool.connect();
        
        console.log('\n=== FIXING SERVER_ID COLUMN TYPE ===');
        
        // First, drop the server_id column if it's the wrong type
        console.log('Dropping integer server_id column...');
        try {
            await client.query(`ALTER TABLE process_servers DROP COLUMN IF EXISTS server_id`);
            console.log('✓ Dropped old server_id column');
        } catch (err) {
            console.log(`Note: ${err.message}`);
        }
        
        // Add server_id as VARCHAR
        console.log('Adding server_id as VARCHAR...');
        try {
            await client.query(`ALTER TABLE process_servers ADD COLUMN server_id VARCHAR(100)`);
            console.log('✓ Added server_id as VARCHAR(100)');
        } catch (err) {
            console.log(`Note: ${err.message}`);
        }
        
        // Handle jurisdictions -> jurisdiction
        console.log('\n=== FIXING JURISDICTIONS COLUMN ===');
        
        // Check if jurisdictions is JSONB
        const colInfo = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers' 
            AND column_name IN ('jurisdictions', 'jurisdiction')
        `);
        
        console.log('Column info:', colInfo.rows);
        
        // If jurisdictions exists as JSONB, convert it
        const hasJurisdictions = colInfo.rows.find(r => r.column_name === 'jurisdictions');
        const hasJurisdiction = colInfo.rows.find(r => r.column_name === 'jurisdiction');
        
        if (hasJurisdictions && !hasJurisdiction) {
            // Rename jurisdictions to jurisdiction
            console.log('Renaming jurisdictions to jurisdiction...');
            try {
                await client.query(`ALTER TABLE process_servers RENAME COLUMN jurisdictions TO jurisdiction`);
                console.log('✓ Renamed jurisdictions to jurisdiction');
            } catch (err) {
                console.log(`Could not rename: ${err.message}`);
            }
        } else if (hasJurisdictions && hasJurisdiction) {
            // Both exist - drop the JSONB one
            console.log('Dropping duplicate jurisdictions column...');
            try {
                await client.query(`ALTER TABLE process_servers DROP COLUMN jurisdictions`);
                console.log('✓ Dropped jurisdictions column');
            } catch (err) {
                console.log(`Could not drop: ${err.message}`);
            }
        }
        
        // Now migrate the data from served_notices
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
                        const serverId = `PS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
                        await client.query(`
                            INSERT INTO process_servers (wallet_address, agency, status, server_id)
                            VALUES ($1, $2, 'approved', $3)
                            ON CONFLICT (wallet_address) DO UPDATE
                            SET agency = COALESCE(process_servers.agency, EXCLUDED.agency),
                                server_id = COALESCE(process_servers.server_id, EXCLUDED.server_id)
                        `, [
                            server.wallet_address,
                            server.agency || 'Unknown Agency',
                            serverId
                        ]);
                        console.log(`✓ Migrated: ${server.wallet_address} with ID ${serverId}`);
                    } catch (err) {
                        console.log(`! Could not migrate ${server.wallet_address}: ${err.message}`);
                    }
                }
            }
        }
        
        // Update any null server_ids
        console.log('\n=== UPDATING NULL SERVER_IDs ===');
        const nullServerIds = await client.query(`
            SELECT wallet_address FROM process_servers WHERE server_id IS NULL
        `);
        
        if (nullServerIds.rows.length > 0) {
            console.log(`Found ${nullServerIds.rows.length} servers without IDs`);
            for (const row of nullServerIds.rows) {
                const serverId = `PS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
                await client.query(`
                    UPDATE process_servers 
                    SET server_id = $1 
                    WHERE wallet_address = $2
                `, [serverId, row.wallet_address]);
                console.log(`✓ Set ID for ${row.wallet_address}: ${serverId}`);
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
        
        // Get count and sample
        const countResult = await client.query('SELECT COUNT(*) FROM process_servers');
        console.log(`\nTotal process servers: ${countResult.rows[0].count}`);
        
        const sampleData = await client.query(`
            SELECT wallet_address, name, agency, server_id, status 
            FROM process_servers 
            LIMIT 5
        `);
        
        if (sampleData.rows.length > 0) {
            console.log('\nSample data:');
            sampleData.rows.forEach(row => {
                console.log(`  - ${row.wallet_address}`);
                console.log(`    Name: ${row.name || 'N/A'}`);
                console.log(`    Agency: ${row.agency || 'N/A'}`);
                console.log(`    Server ID: ${row.server_id || 'N/A'}`);
                console.log(`    Status: ${row.status}`);
            });
        }
        
        console.log('\n✅ Server ID type fix complete!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the fix
fixServerIdType().then(() => {
    console.log('Script finished');
    process.exit(0);
}).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});