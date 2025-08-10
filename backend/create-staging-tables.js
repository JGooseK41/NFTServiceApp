/**
 * Create staging tables for transaction data
 * Backend becomes single source of truth
 */

const { Pool } = require('pg');

async function createTables() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
    });
    
    let client;
    
    try {
        client = await pool.connect();
        
        console.log('🏗️  Creating staging tables...\n');
        
        // 1. Main staged transactions table
        console.log('Creating staged_transactions table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS staged_transactions (
                transaction_id VARCHAR(255) PRIMARY KEY,
                session_id VARCHAR(255),
                status VARCHAR(50) DEFAULT 'staged',
                network VARCHAR(50) DEFAULT 'mainnet',
                server_address VARCHAR(255) NOT NULL,
                contract_address VARCHAR(255),
                recipient_count INTEGER NOT NULL,
                total_fee DECIMAL(10, 2),
                data JSONB NOT NULL,
                blockchain_tx_hash VARCHAR(255),
                energy_used BIGINT,
                created_at TIMESTAMP DEFAULT NOW(),
                executed_at TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                CONSTRAINT valid_status CHECK (status IN ('staged', 'validated', 'executing', 'executed', 'failed', 'expired'))
            )
        `);
        console.log('✅ staged_transactions created\n');
        
        // 2. Staged notice details
        console.log('Creating staged_notices table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS staged_notices (
                transaction_id VARCHAR(255) PRIMARY KEY REFERENCES staged_transactions(transaction_id) ON DELETE CASCADE,
                notice_type VARCHAR(255) NOT NULL,
                case_number VARCHAR(255),
                issuing_agency VARCHAR(255),
                public_text TEXT,
                case_details TEXT,
                legal_rights TEXT,
                has_document BOOLEAN DEFAULT false,
                requires_signature BOOLEAN DEFAULT false,
                token_name VARCHAR(255),
                delivery_method VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ staged_notices created\n');
        
        // 3. Staged file references
        console.log('Creating staged_files table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS staged_files (
                transaction_id VARCHAR(255) PRIMARY KEY REFERENCES staged_transactions(transaction_id) ON DELETE CASCADE,
                thumbnail_path VARCHAR(500),
                document_path VARCHAR(500),
                encrypted_document_path VARCHAR(500),
                thumbnail_url VARCHAR(500),
                document_url VARCHAR(500),
                encrypted_document_url VARCHAR(500),
                thumbnail_size BIGINT,
                document_size BIGINT,
                encrypted_document_size BIGINT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ staged_files created\n');
        
        // 4. Staged IPFS data
        console.log('Creating staged_ipfs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS staged_ipfs (
                transaction_id VARCHAR(255) PRIMARY KEY REFERENCES staged_transactions(transaction_id) ON DELETE CASCADE,
                ipfs_hash VARCHAR(255),
                encrypted_ipfs VARCHAR(255),
                encryption_key VARCHAR(500),
                metadata_uri VARCHAR(500),
                pinned BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ staged_ipfs created\n');
        
        // 5. Staged recipients
        console.log('Creating staged_recipients table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS staged_recipients (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(255) REFERENCES staged_transactions(transaction_id) ON DELETE CASCADE,
                recipient_address VARCHAR(255) NOT NULL,
                notice_id VARCHAR(255) UNIQUE,
                alert_id VARCHAR(255),
                document_id VARCHAR(255),
                recipient_index INTEGER NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT valid_recipient_status CHECK (status IN ('pending', 'validated', 'executed', 'failed'))
            )
        `);
        console.log('✅ staged_recipients created\n');
        
        // 6. Energy estimates
        console.log('Creating staged_energy_estimates table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS staged_energy_estimates (
                transaction_id VARCHAR(255) PRIMARY KEY REFERENCES staged_transactions(transaction_id) ON DELETE CASCADE,
                estimated_energy BIGINT NOT NULL,
                burning_cost_trx DECIMAL(10, 4),
                rental_cost_trx DECIMAL(10, 4),
                savings_trx DECIMAL(10, 4),
                actual_energy_used BIGINT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ staged_energy_estimates created\n');
        
        // Create indexes for performance
        console.log('Creating indexes...');
        
        // Indexes for staged_transactions
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_staged_tx_status 
            ON staged_transactions(status)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_staged_tx_expires 
            ON staged_transactions(expires_at)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_staged_tx_session 
            ON staged_transactions(session_id)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_staged_tx_server 
            ON staged_transactions(server_address)
        `);
        
        // Indexes for staged_recipients
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_staged_recipients_tx 
            ON staged_recipients(transaction_id)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_staged_recipients_address 
            ON staged_recipients(recipient_address)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_staged_recipients_notice 
            ON staged_recipients(notice_id)
        `);
        
        console.log('✅ All indexes created\n');
        
        // Create cleanup function
        console.log('Creating cleanup function...');
        await client.query(`
            CREATE OR REPLACE FUNCTION cleanup_expired_staged_transactions()
            RETURNS INTEGER AS $$
            DECLARE
                deleted_count INTEGER;
            BEGIN
                DELETE FROM staged_transactions
                WHERE expires_at < NOW()
                AND status = 'staged';
                
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                RETURN deleted_count;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Cleanup function created\n');
        
        console.log('✨ All staging tables created successfully!');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        throw error;
        
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run if executed directly
if (require.main === module) {
    createTables()
        .then(() => {
            console.log('\n🎉 Migration completed successfully');
            process.exit(0);
        })
        .catch(err => {
            console.error('Failed to create tables:', err);
            process.exit(1);
        });
}

module.exports = { createTables };