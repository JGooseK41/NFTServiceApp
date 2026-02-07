/**
 * Register Master Admin as The Block Audit LLC
 * Run with: node backend/scripts/register-master-admin.js
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function registerMasterAdmin() {
    const walletAddress = 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
    const agencyName = 'The Block Audit LLC';
    const contactEmail = 'admin@theblockaudit.com';
    const phoneNumber = '000-000-0000';

    try {
        console.log(`Registering master admin: ${walletAddress}`);
        console.log(`Agency: ${agencyName}`);

        // Upsert the server registration
        const result = await pool.query(`
            INSERT INTO process_servers
            (wallet_address, agency_name, contact_email, phone_number, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
            ON CONFLICT (wallet_address)
            DO UPDATE SET
                agency_name = EXCLUDED.agency_name,
                updated_at = NOW()
            RETURNING *
        `, [walletAddress, agencyName, contactEmail, phoneNumber]);

        console.log('✅ Master admin registered successfully:');
        console.log(result.rows[0]);

        // Also update agency column if it exists
        try {
            await pool.query(`
                UPDATE process_servers
                SET agency = $1
                WHERE wallet_address = $2
            `, [agencyName, walletAddress]);
            console.log('✅ Agency column also updated');
        } catch (e) {
            // Column might not exist, that's ok
        }

    } catch (error) {
        console.error('❌ Failed to register:', error.message);
    } finally {
        await pool.end();
    }
}

registerMasterAdmin();
