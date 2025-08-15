/**
 * Update Server Addresses
 * Updates all notices to show they were served by a specific wallet
 */

const { Client } = require('pg');

async function updateServerAddresses() {
    // Get wallet address from command line or use default
    const NEW_SERVER_ADDRESS = process.argv[2] || 'YOUR_WALLET_ADDRESS_HERE';
    
    if (NEW_SERVER_ADDRESS === 'YOUR_WALLET_ADDRESS_HERE') {
        console.error('❌ Please provide your wallet address as an argument:');
        console.error('   node update-server-addresses.js YOUR_WALLET_ADDRESS');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL || 
            'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');
        console.log(`📝 Updating all server addresses to: ${NEW_SERVER_ADDRESS}`);

        // Start transaction
        await client.query('BEGIN');

        // Update images table
        console.log('\n1️⃣ Updating images table...');
        const imagesResult = await client.query(
            'UPDATE images SET server_address = $1 WHERE server_address != $1',
            [NEW_SERVER_ADDRESS]
        );
        console.log(`   ✅ Updated ${imagesResult.rowCount} records in images table`);

        // Update notice_components table
        console.log('\n2️⃣ Updating notice_components table...');
        const componentsResult = await client.query(
            'UPDATE notice_components SET server_address = $1 WHERE server_address != $1',
            [NEW_SERVER_ADDRESS]
        );
        console.log(`   ✅ Updated ${componentsResult.rowCount} records in notice_components table`);

        // Update served_notices table
        console.log('\n3️⃣ Updating served_notices table...');
        const servedResult = await client.query(
            'UPDATE served_notices SET server_address = $1 WHERE server_address != $1',
            [NEW_SERVER_ADDRESS]
        );
        console.log(`   ✅ Updated ${servedResult.rowCount} records in served_notices table`);

        // Update audit_logs table if it exists
        console.log('\n4️⃣ Checking audit_logs table...');
        try {
            const auditResult = await client.query(
                'UPDATE audit_logs SET sender_address = $1 WHERE sender_address != $1',
                [NEW_SERVER_ADDRESS]
            );
            console.log(`   ✅ Updated ${auditResult.rowCount} records in audit_logs table`);
        } catch (e) {
            console.log('   ℹ️ audit_logs table not found or no update needed');
        }

        // Show summary
        console.log('\n📊 Verification:');
        
        // Check images table
        const imagesCheck = await client.query(
            'SELECT COUNT(*) as total, COUNT(DISTINCT server_address) as unique_servers FROM images'
        );
        console.log(`   Images: ${imagesCheck.rows[0].total} total records, ${imagesCheck.rows[0].unique_servers} unique server(s)`);
        
        // Check notice_components
        const componentsCheck = await client.query(
            'SELECT COUNT(*) as total, COUNT(DISTINCT server_address) as unique_servers FROM notice_components'
        );
        console.log(`   Notice Components: ${componentsCheck.rows[0].total} total records, ${componentsCheck.rows[0].unique_servers} unique server(s)`);
        
        // Show sample records
        console.log('\n📋 Sample records from images table:');
        const sampleRecords = await client.query(
            'SELECT notice_id, server_address, recipient_address FROM images LIMIT 3'
        );
        console.table(sampleRecords.rows);

        // Commit transaction
        await client.query('COMMIT');
        console.log('\n✅ ✅ ✅ All server addresses updated successfully! ✅ ✅ ✅');

    } catch (error) {
        console.error('\n❌ Error updating server addresses:', error);
        
        // Rollback on error
        try {
            await client.query('ROLLBACK');
            console.log('Transaction rolled back');
        } catch (rollbackError) {
            console.error('Rollback error:', rollbackError);
        }
        
        throw error;
    } finally {
        await client.end();
        console.log('\nDatabase connection closed');
    }
}

// Run if called directly
if (require.main === module) {
    updateServerAddresses()
        .then(() => {
            console.log('\n✅ Update completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Update failed:', error.message);
            process.exit(1);
        });
}

module.exports = updateServerAddresses;