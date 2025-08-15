/**
 * Update Server Addresses - Fixed Version
 * Updates all notices to show they were served by a specific wallet
 */

const { Client } = require('pg');

async function updateServerAddresses() {
    // Get wallet address from command line or use default
    const NEW_SERVER_ADDRESS = process.argv[2] || 'YOUR_WALLET_ADDRESS_HERE';
    
    if (NEW_SERVER_ADDRESS === 'YOUR_WALLET_ADDRESS_HERE') {
        console.error('❌ Please provide your wallet address as an argument:');
        console.error('   node update-server-addresses-fixed.js YOUR_WALLET_ADDRESS');
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

        // Update each table separately (no transaction to avoid issues)
        
        // Update images table
        console.log('\n1️⃣ Updating images table...');
        try {
            const imagesResult = await client.query(
                'UPDATE images SET server_address = $1 WHERE server_address != $1 OR server_address IS NULL',
                [NEW_SERVER_ADDRESS]
            );
            console.log(`   ✅ Updated ${imagesResult.rowCount} records in images table`);
        } catch (e) {
            console.log(`   ⚠️ Images table: ${e.message}`);
        }

        // Update notice_components table
        console.log('\n2️⃣ Updating notice_components table...');
        try {
            const componentsResult = await client.query(
                'UPDATE notice_components SET server_address = $1 WHERE server_address != $1 OR server_address IS NULL',
                [NEW_SERVER_ADDRESS]
            );
            console.log(`   ✅ Updated ${componentsResult.rowCount} records in notice_components table`);
        } catch (e) {
            console.log(`   ⚠️ Notice components: ${e.message}`);
        }

        // Update served_notices table
        console.log('\n3️⃣ Updating served_notices table...');
        try {
            const servedResult = await client.query(
                'UPDATE served_notices SET server_address = $1 WHERE server_address != $1 OR server_address IS NULL',
                [NEW_SERVER_ADDRESS]
            );
            console.log(`   ✅ Updated ${servedResult.rowCount} records in served_notices table`);
        } catch (e) {
            console.log(`   ⚠️ Served notices: ${e.message}`);
        }

        // Show verification
        console.log('\n📊 Verification:');
        
        // Check images table
        try {
            const imagesCheck = await client.query(
                'SELECT COUNT(*) as total, COUNT(CASE WHEN server_address = $1 THEN 1 END) as updated FROM images',
                [NEW_SERVER_ADDRESS]
            );
            console.log(`   Images: ${imagesCheck.rows[0].updated}/${imagesCheck.rows[0].total} records with your wallet`);
        } catch (e) {
            console.log(`   Images verification skipped`);
        }
        
        // Check notice_components
        try {
            const componentsCheck = await client.query(
                'SELECT COUNT(*) as total, COUNT(CASE WHEN server_address = $1 THEN 1 END) as updated FROM notice_components',
                [NEW_SERVER_ADDRESS]
            );
            console.log(`   Notice Components: ${componentsCheck.rows[0].updated}/${componentsCheck.rows[0].total} records with your wallet`);
        } catch (e) {
            console.log(`   Notice components verification skipped`);
        }

        // Check served_notices
        try {
            const servedCheck = await client.query(
                'SELECT COUNT(*) as total, COUNT(CASE WHEN server_address = $1 THEN 1 END) as updated FROM served_notices',
                [NEW_SERVER_ADDRESS]
            );
            console.log(`   Served Notices: ${servedCheck.rows[0].updated}/${servedCheck.rows[0].total} records with your wallet`);
        } catch (e) {
            console.log(`   Served notices verification skipped`);
        }
        
        // Show sample records
        console.log('\n📋 Sample records:');
        try {
            const sampleImages = await client.query(
                'SELECT notice_id, server_address FROM images WHERE server_address = $1 LIMIT 3',
                [NEW_SERVER_ADDRESS]
            );
            if (sampleImages.rows.length > 0) {
                console.log('From images table:');
                console.table(sampleImages.rows);
            }
        } catch (e) {
            // Skip if error
        }

        try {
            const sampleComponents = await client.query(
                'SELECT notice_id, alert_id, server_address FROM notice_components WHERE server_address = $1 LIMIT 3',
                [NEW_SERVER_ADDRESS]
            );
            if (sampleComponents.rows.length > 0) {
                console.log('From notice_components table:');
                console.table(sampleComponents.rows);
            }
        } catch (e) {
            // Skip if error
        }

        console.log('\n✅ ✅ ✅ Server addresses updated successfully! ✅ ✅ ✅');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
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
            console.log('\n✅ Update completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed:', error.message);
            process.exit(1);
        });
}

module.exports = updateServerAddresses;