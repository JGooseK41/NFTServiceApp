/**
 * Create Admin Users Table
 * Tracks authorized administrators with blockchain sync
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
});

async function createAdminUsersTable() {
    try {
        console.log('Creating admin_users table...');
        
        // Create the admin users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(64) UNIQUE NOT NULL,
                name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'admin',
                is_active BOOLEAN DEFAULT true,
                is_blockchain_synced BOOLEAN DEFAULT false,
                permissions JSONB DEFAULT '{}',
                added_by VARCHAR(64),
                last_sync_at TIMESTAMP,
                last_login_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ admin_users table created');
        
        // Create index for faster lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_wallet 
            ON admin_users(wallet_address)
        `);
        
        console.log('✅ Index created');
        
        // Create admin access logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_access_logs (
                id SERIAL PRIMARY KEY,
                admin_wallet VARCHAR(64) NOT NULL,
                action VARCHAR(100) NOT NULL,
                details JSONB,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ admin_access_logs table created');
        
        // Add default super admin (you should change this address)
        const defaultAdminAddress = 'TYourDefaultAdminWalletAddressHere';
        
        await pool.query(`
            INSERT INTO admin_users (wallet_address, name, role, is_active, permissions)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (wallet_address) DO NOTHING
        `, [
            defaultAdminAddress,
            'Super Admin',
            'super_admin',
            true,
            JSON.stringify({
                manage_admins: true,
                view_all_data: true,
                modify_settings: true,
                sync_blockchain: true
            })
        ]);
        
        console.log('✅ Default admin created (if not exists)');
        console.log('\n⚠️  IMPORTANT: Update the default admin wallet address in the code!');
        
        await pool.end();
        console.log('\n✅ Admin users system initialized successfully');
        
    } catch (error) {
        console.error('Error creating admin tables:', error);
        await pool.end();
        process.exit(1);
    }
}

createAdminUsersTable();