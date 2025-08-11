/**
 * Ensure both agency and agency_name columns exist
 * This solves the compatibility issue between different parts of the code
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

async function ensureAgencyColumns() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Ensuring agency columns compatibility...');
        
        // Start transaction
        await client.query('BEGIN');
        
        // Check current columns
        const result = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers'
        `);
        
        const columns = result.rows.map(r => r.column_name);
        console.log('Current columns:', columns.filter(c => c.includes('agency')));
        
        const hasAgency = columns.includes('agency');
        const hasAgencyName = columns.includes('agency_name');
        
        // Ensure both columns exist
        if (!hasAgencyName) {
            console.log('Adding agency_name column...');
            await client.query(`
                ALTER TABLE process_servers 
                ADD COLUMN agency_name VARCHAR(255)
            `);
            
            // Copy data from agency if it exists
            if (hasAgency) {
                await client.query(`
                    UPDATE process_servers 
                    SET agency_name = agency 
                    WHERE agency_name IS NULL
                `);
            } else {
                // Set default value
                await client.query(`
                    UPDATE process_servers 
                    SET agency_name = 'Process Server Agency' 
                    WHERE agency_name IS NULL
                `);
            }
        }
        
        if (!hasAgency) {
            console.log('Adding agency column...');
            await client.query(`
                ALTER TABLE process_servers 
                ADD COLUMN agency VARCHAR(255)
            `);
            
            // Copy data from agency_name if it exists
            if (hasAgencyName) {
                await client.query(`
                    UPDATE process_servers 
                    SET agency = agency_name 
                    WHERE agency IS NULL
                `);
            } else {
                // Set default value
                await client.query(`
                    UPDATE process_servers 
                    SET agency = 'Process Server Agency' 
                    WHERE agency IS NULL
                `);
            }
        }
        
        // Create a trigger to keep them in sync
        console.log('Creating sync trigger...');
        
        // Drop existing trigger if it exists
        await client.query(`
            DROP TRIGGER IF EXISTS sync_agency_columns ON process_servers
        `);
        
        // Drop existing function if it exists
        await client.query(`
            DROP FUNCTION IF EXISTS sync_agency_columns_func()
        `);
        
        // Create function to sync columns
        await client.query(`
            CREATE OR REPLACE FUNCTION sync_agency_columns_func()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Keep agency and agency_name in sync
                IF NEW.agency_name IS DISTINCT FROM OLD.agency_name THEN
                    NEW.agency = NEW.agency_name;
                ELSIF NEW.agency IS DISTINCT FROM OLD.agency THEN
                    NEW.agency_name = NEW.agency;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        
        // Create trigger
        await client.query(`
            CREATE TRIGGER sync_agency_columns
            BEFORE UPDATE ON process_servers
            FOR EACH ROW
            EXECUTE FUNCTION sync_agency_columns_func()
        `);
        
        // Also handle inserts
        await client.query(`
            DROP TRIGGER IF EXISTS sync_agency_columns_insert ON process_servers
        `);
        
        await client.query(`
            CREATE OR REPLACE FUNCTION sync_agency_columns_insert_func()
            RETURNS TRIGGER AS $$
            BEGIN
                -- On insert, ensure both columns have the same value
                IF NEW.agency_name IS NOT NULL AND NEW.agency IS NULL THEN
                    NEW.agency = NEW.agency_name;
                ELSIF NEW.agency IS NOT NULL AND NEW.agency_name IS NULL THEN
                    NEW.agency_name = NEW.agency;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        
        await client.query(`
            CREATE TRIGGER sync_agency_columns_insert
            BEFORE INSERT ON process_servers
            FOR EACH ROW
            EXECUTE FUNCTION sync_agency_columns_insert_func()
        `);
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('✅ Both agency and agency_name columns now exist and are synchronized');
        
        // Verify the fix
        const verifyResult = await client.query(`
            SELECT 
                wallet_address,
                agency,
                agency_name
            FROM process_servers
            LIMIT 5
        `);
        
        console.log('Sample data:');
        verifyResult.rows.forEach(row => {
            console.log(`  ${row.wallet_address}: agency="${row.agency}", agency_name="${row.agency_name}"`);
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error ensuring agency columns:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the migration
ensureAgencyColumns()
    .then(() => {
        console.log('✅ Agency columns migration completed successfully');
        console.log('Both columns now exist and will stay synchronized');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Failed to ensure agency columns:', error);
        process.exit(1);
    });