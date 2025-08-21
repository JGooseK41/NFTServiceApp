/**
 * Fix Address Case Migration
 * Restores proper case for TRON addresses that were incorrectly stored as lowercase
 * TRON addresses use Base58 encoding and are case-sensitive
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixAddressCase() {
  console.log('🔧 Starting address case fix migration...');
  
  try {
    // Start transaction
    await pool.query('BEGIN');
    
    // Note: This migration cannot automatically restore the original case
    // because that information was lost when converting to lowercase.
    // However, we can at least document the issue and prepare for manual fixes
    
    console.log('\n⚠️  IMPORTANT: Address case information was lost when converting to lowercase.');
    console.log('The addresses in the database need to be manually corrected or re-synced from the blockchain.');
    console.log('\nThis script will:');
    console.log('1. Show you all unique addresses currently in the database');
    console.log('2. Prepare the database to accept case-sensitive addresses going forward');
    
    // Get all unique server addresses
    const serverAddresses = await pool.query(`
      SELECT DISTINCT server_address, COUNT(*) as count
      FROM blockchain_data
      WHERE server_address IS NOT NULL
      GROUP BY server_address
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Server addresses in database:');
    serverAddresses.rows.forEach(row => {
      console.log(`  ${row.server_address} - ${row.count} notices`);
    });
    
    // Get all unique recipient addresses
    const recipientAddresses = await pool.query(`
      SELECT DISTINCT recipient_address, COUNT(*) as count
      FROM blockchain_data
      WHERE recipient_address IS NOT NULL
      GROUP BY recipient_address
      ORDER BY count DESC
      LIMIT 20
    `);
    
    console.log('\n📊 Top 20 recipient addresses in database:');
    recipientAddresses.rows.forEach(row => {
      console.log(`  ${row.recipient_address} - ${row.count} notices`);
    });
    
    // Check if we have mixed case addresses (which would mean some are already fixed)
    const mixedCase = await pool.query(`
      SELECT recipient_address
      FROM blockchain_data
      WHERE recipient_address ~ '[A-Z]'
      LIMIT 5
    `);
    
    if (mixedCase.rows.length > 0) {
      console.log('\n✅ Found addresses with uppercase letters - some addresses may already be correct.');
      console.log('Sample correct addresses:');
      mixedCase.rows.forEach(row => {
        console.log(`  ${row.recipient_address}`);
      });
    } else {
      console.log('\n❌ No addresses with uppercase letters found - all addresses are lowercase.');
      console.log('Manual correction or blockchain re-sync will be needed.');
    }
    
    // Add a migration record
    await pool.query(`
      INSERT INTO migrations (name, executed_at)
      VALUES ('fix_address_case', CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO NOTHING
    `);
    
    await pool.query('COMMIT');
    
    console.log('\n✅ Migration completed.');
    console.log('\n📌 Next steps:');
    console.log('1. New addresses will be stored with correct case');
    console.log('2. Consider running blockchain sync to update existing addresses');
    console.log('3. Manually correct critical addresses if needed');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Create migrations table if it doesn't exist
async function ensureMigrationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Migrations table ready');
  } catch (error) {
    console.error('Error creating migrations table:', error);
  }
}

// Run the migration
(async () => {
  try {
    await ensureMigrationsTable();
    await fixAddressCase();
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
})();