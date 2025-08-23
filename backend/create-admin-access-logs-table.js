const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function createAdminAccessLogsTable() {
    console.log('Creating admin_access_logs table...\n');
    
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS admin_access_logs (
            id SERIAL PRIMARY KEY,
            wallet_address VARCHAR(100) NOT NULL,
            access_type VARCHAR(50) NOT NULL,
            endpoint VARCHAR(255),
            ip_address VARCHAR(45),
            user_agent TEXT,
            success BOOLEAN DEFAULT true,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_admin_access_wallet ON admin_access_logs(wallet_address);
        CREATE INDEX IF NOT EXISTS idx_admin_access_created ON admin_access_logs(created_at);
    `;
    
    try {
        await pool.query(createTableQuery);
        console.log('✅ admin_access_logs table created successfully');
        
        // Check if table exists
        const checkQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'admin_access_logs'
            ORDER BY ordinal_position;
        `;
        
        const result = await pool.query(checkQuery);
        
        console.log('\nTable structure:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
        
        await pool.end();
        
    } catch (error) {
        console.error('Error creating table:', error);
        await pool.end();
    }
}

createAdminAccessLogsTable();