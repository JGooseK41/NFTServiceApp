require('dotenv').config();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('🚀 Starting migration to add compiled document fields...\n');
  
  try {
    // Check current table structure
    console.log('📊 Checking current table structure...');
    const checkQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'notice_components'
      AND column_name IN ('page_count', 'is_compiled', 'document_count')
    `;
    
    const currentColumns = await pool.query(checkQuery);
    console.log(`Found ${currentColumns.rows.length} of 3 expected columns\n`);
    
    if (currentColumns.rows.length === 3) {
      console.log('✅ All columns already exist! No migration needed.');
      currentColumns.rows.forEach(col => {
        console.log(`  ✓ ${col.column_name} (${col.data_type})`);
      });
      await pool.end();
      return;
    }
    
    // Show what's missing
    const existingColumns = currentColumns.rows.map(c => c.column_name);
    const requiredColumns = ['page_count', 'is_compiled', 'document_count'];
    const missingColumns = requiredColumns.filter(c => !existingColumns.includes(c));
    
    console.log('❌ Missing columns:', missingColumns.join(', '));
    console.log('\n🔧 Adding missing columns...\n');
    
    // Add missing columns
    const alterQuery = `
      ALTER TABLE notice_components 
      ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_compiled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS document_count INTEGER DEFAULT 1
    `;
    
    await pool.query(alterQuery);
    console.log('✅ Columns added successfully!\n');
    
    // Create index for better query performance
    console.log('📇 Creating index on is_compiled column...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_is_compiled ON notice_components(is_compiled)');
    console.log('✅ Index created!\n');
    
    // Update any NULL values to defaults
    console.log('🔄 Setting default values for existing records...');
    const updateQuery = `
      UPDATE notice_components 
      SET page_count = COALESCE(page_count, 1),
          is_compiled = COALESCE(is_compiled, FALSE),
          document_count = COALESCE(document_count, 1)
      WHERE page_count IS NULL 
         OR is_compiled IS NULL 
         OR document_count IS NULL
    `;
    
    const updateResult = await pool.query(updateQuery);
    console.log(`✅ Updated ${updateResult.rowCount} records\n`);
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    const verifyColumns = await pool.query(checkQuery);
    
    if (verifyColumns.rows.length === 3) {
      console.log('✅ Migration completed successfully!\n');
      console.log('Final table structure:');
      verifyColumns.rows.forEach(col => {
        console.log(`  ✓ ${col.column_name} (${col.data_type}, default: ${col.column_default || 'none'})`);
      });
    } else {
      console.error('❌ Migration may have failed. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n📝 Migration process completed');
  }
}

// Run the migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});