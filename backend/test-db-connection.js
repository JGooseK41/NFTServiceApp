const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
    console.log('Testing database connection...\n');
    
    // Try different connection configurations
    const configurations = [
        {
            name: 'With SSL require',
            config: {
                connectionString: process.env.DATABASE_URL + '?sslmode=require',
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 10000,
                idleTimeoutMillis: 10000,
                max: 1
            }
        },
        {
            name: 'With SSL and keepAlive',
            config: {
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 60000,
                idleTimeoutMillis: 30000,
                keepAlive: true,
                keepAliveInitialDelayMillis: 10000,
                max: 1
            }
        },
        {
            name: 'Direct connection params',
            config: {
                host: 'dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com',
                port: 5432,
                database: 'nftservice_db',
                user: 'nftservice',
                password: 'nftservice123',
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 30000,
                max: 1
            }
        }
    ];
    
    for (const { name, config } of configurations) {
        console.log(`\nTrying: ${name}`);
        console.log('Config:', JSON.stringify({
            ...config,
            password: '***',
            connectionString: config.connectionString ? '***' : undefined
        }, null, 2));
        
        const pool = new Pool(config);
        
        try {
            const startTime = Date.now();
            const result = await pool.query('SELECT NOW(), version()');
            const elapsed = Date.now() - startTime;
            
            console.log(`✅ SUCCESS in ${elapsed}ms`);
            console.log(`   Server time: ${result.rows[0].now}`);
            console.log(`   Version: ${result.rows[0].version.split(',')[0]}`);
            
            // Try a second query to test connection stability
            const result2 = await pool.query('SELECT COUNT(*) FROM case_service_records');
            console.log(`   Records count: ${result2.rows[0].count}`);
            
            await pool.end();
            
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            if (error.code) {
                console.log(`   Error code: ${error.code}`);
            }
            
            try {
                await pool.end();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
    
    console.log('\n=== DIAGNOSIS ===\n');
    console.log('If all connections fail:');
    console.log('1. Database might be paused on Render (free tier auto-pauses)');
    console.log('2. Network connectivity issues');
    console.log('3. Firewall/security group blocking connection');
    console.log('\nIf some work:');
    console.log('1. Use the working configuration');
    console.log('2. Connection pooling might need adjustment');
    console.log('3. SSL configuration might be the issue');
}

testConnection().catch(console.error);