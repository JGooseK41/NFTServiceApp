const { Pool } = require('pg');

const pool = new Pool({
  host: 'dpg-d290ovqli9vc739cllm0-a.virginia-postgres.render.com',
  port: 5432,
  database: 'nftserviceapp_db',
  user: 'nftserviceapp_db_user',
  password: '9sH6aWG250oNlzbEyeg5Z75TyFJgXp4C',
  ssl: { rejectUnauthorized: false }
});

async function createMissingTable() {
  try {
    // Create wallet_connections table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_connections (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(100) NOT NULL,
        event_type VARCHAR(50),
        ip_address VARCHAR(45),
        real_ip VARCHAR(45),
        user_agent TEXT,
        location_data JSONB,
        site VARCHAR(100),
        notice_count INTEGER DEFAULT 0,
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created wallet_connections table');
    
    // Create index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_connections_wallet_address 
      ON wallet_connections(wallet_address)
    `);
    console.log('✅ Created index for wallet_connections');
    
    console.log('\n🎉 All tables are now ready!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

createMissingTable();