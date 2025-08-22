/**
 * Setup Initial Admin
 * Run this script to add your wallet as the initial super admin
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
});

async function setupInitialAdmin() {
    // CHANGE THIS TO YOUR WALLET ADDRESS
    const YOUR_WALLET_ADDRESS = 'TYourWalletAddressHere'; // <-- PUT YOUR WALLET ADDRESS HERE
    const YOUR_NAME = 'Jesse'; // <-- Your name
    
    if (YOUR_WALLET_ADDRESS === 'TYourWalletAddressHere') {
        console.error('❌ ERROR: Please edit this file and set YOUR_WALLET_ADDRESS to your actual wallet address!');
        process.exit(1);
    }
    
    try {
        console.log('Setting up initial admin...');
        console.log('Wallet:', YOUR_WALLET_ADDRESS);
        
        // First ensure tables exist
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
        
        // Add your wallet as super admin
        const result = await pool.query(`
            INSERT INTO admin_users (wallet_address, name, role, is_active, permissions)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (wallet_address) 
            DO UPDATE SET 
                name = $2,
                role = $3,
                is_active = $4,
                permissions = $5,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            YOUR_WALLET_ADDRESS,
            YOUR_NAME,
            'super_admin',
            true,
            JSON.stringify({
                manage_admins: true,
                view_all_data: true,
                modify_settings: true,
                sync_blockchain: true
            })
        ]);
        
        console.log('\n✅ SUCCESS! Admin account created/updated:');
        console.log('----------------------------------------');
        console.log('Wallet:', result.rows[0].wallet_address);
        console.log('Name:', result.rows[0].name);
        console.log('Role:', result.rows[0].role);
        console.log('Permissions:', result.rows[0].permissions);
        console.log('----------------------------------------');
        console.log('\nYou can now access the admin panel when connected with this wallet!');
        
        // Log the setup
        await pool.query(`
            INSERT INTO admin_access_logs (admin_wallet, action, details)
            VALUES ($1, $2, $3)
        `, [
            YOUR_WALLET_ADDRESS,
            'initial_setup',
            JSON.stringify({ role: 'super_admin' })
        ]);
        
        await pool.end();
        
    } catch (error) {
        console.error('Error setting up admin:', error);
        await pool.end();
        process.exit(1);
    }
}

// Run the setup
setupInitialAdmin();