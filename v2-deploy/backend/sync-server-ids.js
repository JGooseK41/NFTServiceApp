/**
 * Sync Server IDs from Smart Contract
 * Updates backend process_servers table with the actual server IDs from the blockchain
 */

const TronWeb = require('tronweb');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: process.env.TRON_NETWORK === 'mainnet' 
        ? 'https://api.trongrid.io'
        : 'https://nile.trongrid.io'
});

// Contract address - update this with your actual contract
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'TYour_Contract_Address_Here';

async function syncServerIds() {
    let client;
    
    try {
        console.log('Connecting to database...');
        client = await pool.connect();
        
        console.log('Loading contract...');
        const contractABI = [
            {
                "outputs": [{"type": "uint256"}],
                "constant": true,
                "inputs": [{"name": "server", "type": "address"}],
                "name": "serverIds",
                "stateMutability": "view",
                "type": "function"
            },
            {
                "outputs": [{"type": "address"}],
                "constant": true,
                "inputs": [{"name": "id", "type": "uint256"}],
                "name": "serverById",
                "stateMutability": "view",
                "type": "function"
            },
            {
                "outputs": [{"type": "bool"}],
                "constant": true,
                "inputs": [
                    {"name": "role", "type": "bytes32"},
                    {"name": "account", "type": "address"}
                ],
                "name": "hasRole",
                "stateMutability": "view",
                "type": "function"
            }
        ];
        
        const contract = await tronWeb.contract(contractABI, CONTRACT_ADDRESS);
        
        // Get all process servers from database
        const servers = await client.query('SELECT wallet_address FROM process_servers');
        
        console.log(`Found ${servers.rows.length} servers in database`);
        console.log('\n=== SYNCING SERVER IDs FROM BLOCKCHAIN ===\n');
        
        for (const server of servers.rows) {
            try {
                const walletAddress = server.wallet_address;
                console.log(`Checking ${walletAddress}...`);
                
                // Get server ID from contract
                const serverId = await contract.serverIds(walletAddress).call();
                const serverIdNumber = parseInt(serverId.toString());
                
                if (serverIdNumber > 0) {
                    // This server has a blockchain ID
                    console.log(`  ✓ Blockchain Server ID: ${serverIdNumber}`);
                    
                    // Update database with the 4-digit format (padded with zeros)
                    const formattedId = `PS-${serverIdNumber.toString().padStart(4, '0')}`;
                    
                    await client.query(
                        'UPDATE process_servers SET server_id = $1 WHERE wallet_address = $2',
                        [formattedId, walletAddress]
                    );
                    
                    console.log(`  ✓ Updated to: ${formattedId}`);
                } else {
                    console.log(`  ⚠ No blockchain ID yet (not granted PROCESS_SERVER_ROLE)`);
                    
                    // Check if they have the role
                    const PROCESS_SERVER_ROLE = tronWeb.sha3('PROCESS_SERVER_ROLE');
                    const hasRole = await contract.hasRole(PROCESS_SERVER_ROLE, walletAddress).call();
                    
                    if (hasRole) {
                        console.log(`  ℹ Has role but no ID - may need to call contract to assign`);
                    } else {
                        console.log(`  ℹ Does not have PROCESS_SERVER_ROLE in contract`);
                    }
                }
                
            } catch (err) {
                console.log(`  ❌ Error: ${err.message}`);
            }
        }
        
        // Show final results
        console.log('\n=== FINAL SERVER IDs ===\n');
        const finalResults = await client.query(
            'SELECT wallet_address, server_id, name, agency FROM process_servers ORDER BY server_id'
        );
        
        finalResults.rows.forEach(row => {
            console.log(`${row.server_id || 'NO-ID'} | ${row.wallet_address} | ${row.name || 'N/A'} | ${row.agency || 'N/A'}`);
        });
        
        console.log('\n✅ Sync complete!');
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
        throw error;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

// Run the sync
syncServerIds().then(() => {
    console.log('Script finished');
    process.exit(0);
}).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});