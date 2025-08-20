/**
 * Standalone migration runner for process_servers table
 * Run this directly on Render to create the necessary database tables
 */

const { Pool } = require('pg');

// Use DATABASE_URL from environment
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    let client;
    
    try {
        console.log('Connecting to database...');
        client = await pool.connect();
        
        // First check if table exists and what columns it has
        console.log('Checking existing table structure...');
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'process_servers'
            )
        `);
        
        if (tableExists.rows[0].exists) {
            console.log('Table process_servers already exists. Checking columns...');
            
            // Get existing columns
            const existingColumns = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'process_servers'
            `);
            
            const columnNames = existingColumns.rows.map(r => r.column_name);
            console.log('Existing columns:', columnNames.join(', '));
            
            // Add missing columns if needed
            // Map to standardize column names
            const requiredColumns = {
                'name': 'VARCHAR(255)',
                'email': 'VARCHAR(255)',
                'phone': 'VARCHAR(50)',
                'notes': 'TEXT',
                'registration_data': 'JSONB'
            };
            
            // Also add an 'agency' column that maps to 'agency_name' for consistency
            if (!columnNames.includes('agency') && columnNames.includes('agency_name')) {
                // We have agency_name but need agency for consistency
                console.log('Adding agency column to match agency_name');
                try {
                    await client.query(`ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS agency VARCHAR(255)`);
                    await client.query(`UPDATE process_servers SET agency = agency_name WHERE agency IS NULL`);
                } catch (err) {
                    console.log(`Could not add agency column: ${err.message}`);
                }
            }
            
            for (const [column, type] of Object.entries(requiredColumns)) {
                if (!columnNames.includes(column)) {
                    console.log(`Adding missing column: ${column}`);
                    try {
                        await client.query(`ALTER TABLE process_servers ADD COLUMN IF NOT EXISTS ${column} ${type}`);
                    } catch (err) {
                        console.log(`Column ${column} might already exist or has conflict: ${err.message}`);
                    }
                }
            }
        } else {
            console.log('Creating process_servers table...');
            
            // Create process_servers table
            await client.query(`
                CREATE TABLE process_servers (
                    id SERIAL PRIMARY KEY,
                    wallet_address VARCHAR(255) UNIQUE NOT NULL,
                    name VARCHAR(255),
                    agency VARCHAR(255),
                    email VARCHAR(255),
                    phone VARCHAR(50),
                    server_id VARCHAR(100) UNIQUE,
                    status VARCHAR(50) DEFAULT 'pending',
                    jurisdiction VARCHAR(255),
                    license_number VARCHAR(100),
                    notes TEXT,
                    registration_data JSONB,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    approved_at TIMESTAMP,
                    approved_by VARCHAR(255)
                )
            `);
        }
        
        console.log('Creating indexes...');
        
        // Create indexes (these won't error if they already exist)
        try {
            await client.query(`CREATE INDEX IF NOT EXISTS idx_process_servers_wallet ON process_servers(wallet_address)`);
        } catch (e) { console.log('Index idx_process_servers_wallet exists'); }
        
        try {
            await client.query(`CREATE INDEX IF NOT EXISTS idx_process_servers_status ON process_servers(status)`);
        } catch (e) { console.log('Index idx_process_servers_status exists'); }
        
        try {
            await client.query(`CREATE INDEX IF NOT EXISTS idx_process_servers_agency ON process_servers(agency)`);
        } catch (e) { console.log('Index idx_process_servers_agency exists or column missing'); }
        
        try {
            await client.query(`CREATE INDEX IF NOT EXISTS idx_process_servers_created ON process_servers(created_at DESC)`);
        } catch (e) { console.log('Index idx_process_servers_created exists'); }
        
        console.log('Creating update trigger...');
        
        // Create update trigger
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);
        
        // Check if trigger exists before creating
        const triggerExists = await client.query(`
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_process_servers_updated_at'
        `);
        
        if (triggerExists.rows.length === 0) {
            await client.query(`
                CREATE TRIGGER update_process_servers_updated_at 
                BEFORE UPDATE ON process_servers 
                FOR EACH ROW 
                EXECUTE PROCEDURE update_updated_at_column()
            `);
            console.log('Trigger created successfully');
        } else {
            console.log('Trigger already exists');
        }
        
        // Check if we need to migrate existing registration data
        console.log('Checking for existing registrations to migrate...');
        
        // First check what columns exist in served_notices
        const servedNoticesCols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'served_notices'
        `);
        
        console.log('served_notices columns:', servedNoticesCols.rows.map(r => r.column_name).join(', '));
        
        // Use the correct column names based on what exists
        const existingRegistrations = await client.query(`
            SELECT DISTINCT 
                server_address as wallet_address,
                issuing_agency as agency
            FROM served_notices
            WHERE server_address IS NOT NULL
        `);
        
        if (existingRegistrations.rows.length > 0) {
            console.log(`Found ${existingRegistrations.rows.length} existing registrations to migrate`);
            
            for (const registration of existingRegistrations.rows) {
                if (registration.wallet_address) {
                    // Check if already exists
                    const exists = await client.query(
                        'SELECT id FROM process_servers WHERE wallet_address = $1',
                        [registration.wallet_address]
                    );
                    
                    if (exists.rows.length === 0 && registration.wallet_address) {
                        // Insert new process server from existing data
                        // Check which columns exist in process_servers
                        const psColumns = await client.query(`
                            SELECT column_name FROM information_schema.columns 
                            WHERE table_name = 'process_servers'
                        `);
                        const psColNames = psColumns.rows.map(r => r.column_name);
                        
                        // Use the right column name (agency or agency_name)
                        const agencyCol = psColNames.includes('agency') ? 'agency' : 'agency_name';
                        
                        await client.query(`
                            INSERT INTO process_servers (wallet_address, ${agencyCol}, status, server_id)
                            VALUES ($1, $2, 'approved', $3)
                            ON CONFLICT (wallet_address) DO NOTHING
                        `, [
                            registration.wallet_address,
                            registration.agency || 'Unknown Agency',
                            `PS-${Date.now().toString(36).toUpperCase()}`
                        ]);
                        console.log(`Migrated: ${registration.wallet_address}`);
                    }
                }
            }
        }
        
        // Verify table creation
        const tableCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'process_servers'
        `);
        
        console.log('\n=== Table Structure Created ===');
        console.log('Columns:', tableCheck.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
        
        // Get count
        const countResult = await client.query('SELECT COUNT(*) FROM process_servers');
        console.log(`Total process servers in table: ${countResult.rows[0].count}`);
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('Error details:', error.detail);
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the migration
runMigration().then(() => {
    console.log('Migration script finished');
    process.exit(0);
}).catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
});