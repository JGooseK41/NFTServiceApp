const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        
        console.log('Creating document_access_tokens table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS document_access_tokens (
                id SERIAL PRIMARY KEY,
                token VARCHAR(100) UNIQUE NOT NULL,
                wallet_address VARCHAR(42) NOT NULL,
                alert_token_id INTEGER,
                document_token_id INTEGER,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP,
                usage_count INTEGER DEFAULT 0,
                revoked BOOLEAN DEFAULT false,
                UNIQUE(wallet_address, alert_token_id)
            )
        `);
        
        console.log('Creating access_attempts table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS access_attempts (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(42),
                alert_token_id INTEGER,
                document_token_id INTEGER,
                is_recipient BOOLEAN,
                granted BOOLEAN,
                denial_reason VARCHAR(255),
                ip_address VARCHAR(45),
                user_agent TEXT,
                attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Creating document_access_log table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS document_access_log (
                id SERIAL PRIMARY KEY,
                document_token_id INTEGER NOT NULL,
                wallet_address VARCHAR(42) NOT NULL,
                access_token_used VARCHAR(100),
                ip_address VARCHAR(45),
                user_agent TEXT,
                bytes_served BIGINT,
                access_duration INTEGER,
                accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Creating indexes...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_access_token ON document_access_tokens(token)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_access_wallet ON document_access_tokens(wallet_address)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_attempts_wallet ON access_attempts(wallet_address)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_doc_access_token ON document_access_log(document_token_id)');
        
        client.release();
        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();