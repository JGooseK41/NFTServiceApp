/**
 * Update your process server registration with correct details
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function updateMyServer() {
    let client;
    
    try {
        console.log('Connecting to database...');
        client = await pool.connect();
        
        // Your wallet addresses (both formats)
        const walletAddresses = [
            'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
            'tgdd34rr3rzfuozoqlze9d4tzfbigl4jay'
        ];
        
        // Update your registration with correct details
        // EDIT THESE VALUES AS NEEDED:
        const updates = {
            name: 'Jesse',  // Your name
            agency: 'Legal Process Services LLC',  // Your agency name
            email: 'jesse@legalprocess.com',  // Your email
            phone: '555-0100',  // Your phone
            license_number: 'PS-001',  // Your license number if applicable
            jurisdiction: 'California',  // Your jurisdiction
            status: 'approved'
        };
        
        console.log('\n=== UPDATING YOUR PROCESS SERVER REGISTRATION ===');
        console.log('Details to update:', updates);
        
        for (const wallet of walletAddresses) {
            const existing = await client.query(
                'SELECT * FROM process_servers WHERE wallet_address = $1',
                [wallet]
            );
            
            if (existing.rows.length > 0) {
                await client.query(`
                    UPDATE process_servers 
                    SET 
                        name = $2,
                        agency = $3,
                        email = $4,
                        phone = $5,
                        license_number = $6,
                        jurisdiction = $7,
                        status = $8,
                        updated_at = NOW()
                    WHERE wallet_address = $1
                `, [
                    wallet,
                    updates.name,
                    updates.agency,
                    updates.email,
                    updates.phone,
                    updates.license_number,
                    updates.jurisdiction,
                    updates.status
                ]);
                
                console.log(`✓ Updated registration for ${wallet}`);
            }
        }
        
        // Show updated data
        console.log('\n=== YOUR UPDATED REGISTRATION ===');
        const result = await client.query(`
            SELECT * FROM process_servers 
            WHERE wallet_address IN ($1, $2)
        `, walletAddresses);
        
        result.rows.forEach(row => {
            console.log(`\nWallet: ${row.wallet_address}`);
            console.log(`  Name: ${row.name}`);
            console.log(`  Agency: ${row.agency}`);
            console.log(`  Email: ${row.email}`);
            console.log(`  Phone: ${row.phone}`);
            console.log(`  License: ${row.license_number}`);
            console.log(`  Jurisdiction: ${row.jurisdiction}`);
            console.log(`  Server ID: ${row.server_id}`);
            console.log(`  Status: ${row.status}`);
        });
        
        console.log('\n✅ Update complete!');
        console.log('\nNow when you connect your wallet, the "Issuing Agency" field should show:', updates.agency);
        
    } catch (error) {
        console.error('❌ Update failed:', error);
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the update
updateMyServer().then(() => {
    console.log('\nScript finished');
    process.exit(0);
}).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});