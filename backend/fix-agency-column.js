/**
 * Fix agency_name column issue
 * Ensures the process_servers table has the agency_name column
 * that the code expects
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

async function fixAgencyColumn() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Fixing agency_name column issue...');
        
        // Check current columns
        const result = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers'
        `);
        
        const columns = result.rows.map(r => r.column_name);
        console.log('Current columns:', columns);
        
        // Check if we have agency but not agency_name
        const hasAgency = columns.includes('agency');
        const hasAgencyName = columns.includes('agency_name');
        
        if (!hasAgencyName) {
            if (hasAgency) {
                // We have 'agency' but need 'agency_name' - add it as a copy
                console.log('Adding agency_name column (copying from agency)...');
                
                await client.query(`
                    ALTER TABLE process_servers 
                    ADD COLUMN IF NOT EXISTS agency_name VARCHAR(255)
                `);
                
                await client.query(`
                    UPDATE process_servers 
                    SET agency_name = agency 
                    WHERE agency_name IS NULL AND agency IS NOT NULL
                `);
                
                console.log('✅ Added agency_name column with data from agency column');
            } else {
                // No agency column at all - create agency_name
                console.log('Creating agency_name column...');
                
                await client.query(`
                    ALTER TABLE process_servers 
                    ADD COLUMN IF NOT EXISTS agency_name VARCHAR(255)
                `);
                
                // Set default values for existing rows
                await client.query(`
                    UPDATE process_servers 
                    SET agency_name = 'Process Server Agency' 
                    WHERE agency_name IS NULL
                `);
                
                console.log('✅ Created agency_name column');
            }
        } else {
            console.log('✅ agency_name column already exists');
        }
        
        // Also ensure agency column exists for backwards compatibility
        if (!hasAgency) {
            console.log('Adding agency column for backwards compatibility...');
            
            await client.query(`
                ALTER TABLE process_servers 
                ADD COLUMN IF NOT EXISTS agency VARCHAR(255)
            `);
            
            if (hasAgencyName) {
                await client.query(`
                    UPDATE process_servers 
                    SET agency = agency_name 
                    WHERE agency IS NULL AND agency_name IS NOT NULL
                `);
            }
            
            console.log('✅ Added agency column');
        }
        
        // Verify the fix
        const verifyResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers'
            AND column_name IN ('agency', 'agency_name')
        `);
        
        console.log('Final columns:', verifyResult.rows.map(r => r.column_name));
        
        // Test query that was failing
        console.log('Testing the problematic query...');
        const testResult = await client.query(`
            SELECT 
                wallet_address,
                agency_name,
                contact_email,
                phone_number,
                website,
                license_number,
                jurisdictions,
                status,
                created_at,
                updated_at
            FROM process_servers
            LIMIT 1
        `);
        
        console.log('✅ Query works! Sample data:', testResult.rows[0] ? 'Found' : 'No data yet');
        
    } catch (error) {
        console.error('❌ Error fixing agency column:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the fix
fixAgencyColumn()
    .then(() => {
        console.log('✅ Agency column fix completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Failed to fix agency column:', error);
        process.exit(1);
    });