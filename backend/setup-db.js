const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection - uses environment variable only
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Set it before running: export DATABASE_URL="postgresql://user:pass@host:5432/db"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  console.log('🚀 Setting up NFT Service App Database...\n');
  
  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolon to run each statement separately
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Running ${statements.length} SQL statements...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Extract table/index name for logging
      let objectName = 'Statement ' + (i + 1);
      if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
        if (match) objectName = `Table: ${match[1]}`;
      } else if (statement.includes('CREATE INDEX')) {
        const match = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/);
        if (match) objectName = `Index: ${match[1]}`;
      }
      
      try {
        await pool.query(statement);
        console.log(`✅ Created ${objectName}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⏭️  ${objectName} already exists (skipped)`);
        } else {
          console.error(`❌ Error creating ${objectName}:`, error.message);
        }
      }
    }
    
    // Verify tables were created
    console.log('\n📊 Verifying database setup...\n');
    
    const tableCheckQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `;
    
    const result = await pool.query(tableCheckQuery);
    
    console.log('📋 Tables in database:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}`);
    });
    
    console.log('\n🎉 Database setup complete!');
    console.log('\n📌 Your backend can now:');
    console.log('   • Track document views with IP addresses');
    console.log('   • Log acceptance transactions');
    console.log('   • Generate audit trails for court');
    console.log('   • Cache blockchain data for performance');
    console.log('\n✨ Audit trail system is now active!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await pool.end();
  }
}

// Run setup
setupDatabase();