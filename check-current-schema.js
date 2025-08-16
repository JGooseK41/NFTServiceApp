/**
 * Check Current Database Schema
 * Run this first to see what tables already exist
 * 
 * Usage in Render Shell:
 * node check-current-schema.js
 */

const { Pool } = require('pg');

async function checkSchema() {
    console.log('🔍 Checking Current Database Schema...\n');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    try {
        // Get all tables
        console.log('📊 EXISTING TABLES:');
        console.log('='.repeat(60));
        const tables = await pool.query(`
            SELECT tablename, 
                   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        for (const table of tables.rows) {
            console.log(`\n📋 Table: ${table.tablename} (${table.size})`);
            
            // Get columns for each table
            const columns = await pool.query(`
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [table.tablename]);
            
            console.log('  Columns:');
            columns.rows.forEach(col => {
                const type = col.character_maximum_length 
                    ? `${col.data_type}(${col.character_maximum_length})`
                    : col.data_type;
                const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                console.log(`    - ${col.column_name}: ${type} ${nullable}${defaultVal}`);
            });
            
            // Get row count
            const count = await pool.query(`SELECT COUNT(*) FROM ${table.tablename}`);
            console.log(`  Row count: ${count.rows[0].count}`);
            
            // Get indexes
            const indexes = await pool.query(`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = $1
                AND schemaname = 'public'
            `, [table.tablename]);
            
            if (indexes.rows.length > 0) {
                console.log('  Indexes:');
                indexes.rows.forEach(idx => {
                    console.log(`    - ${idx.indexname}`);
                });
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`Total tables: ${tables.rows.length}`);
        
        // Check for specific tables we need
        console.log('\n🔍 CHECKING FOR CASE MANAGEMENT TABLES:');
        console.log('-'.repeat(60));
        
        const caseTablesExist = tables.rows.filter(t => 
            t.tablename === 'prepared_cases' || 
            t.tablename === 'case_documents'
        );
        
        if (caseTablesExist.length > 0) {
            console.log('⚠️  WARNING: Case management tables already exist!');
            caseTablesExist.forEach(t => {
                console.log(`   - ${t.tablename}`);
            });
            console.log('\n   Migration may not be needed or may need modification.');
        } else {
            console.log('✅ Case management tables do NOT exist yet.');
            console.log('   Safe to run migration.');
        }
        
        // Check for image storage tables
        console.log('\n🔍 CHECKING FOR IMAGE STORAGE:');
        console.log('-'.repeat(60));
        
        const imageRelatedTables = tables.rows.filter(t => 
            t.tablename.includes('image') || 
            t.tablename.includes('document') ||
            t.tablename.includes('notice')
        );
        
        if (imageRelatedTables.length > 0) {
            console.log('Found image/document related tables:');
            imageRelatedTables.forEach(t => {
                console.log(`   - ${t.tablename}`);
            });
        } else {
            console.log('No existing image storage tables found.');
        }
        
        // Check for any conflicts
        console.log('\n🔍 POTENTIAL CONFLICTS:');
        console.log('-'.repeat(60));
        
        // Check if simple_images exists
        const simpleImages = tables.rows.find(t => t.tablename === 'simple_images');
        if (simpleImages) {
            console.log('✅ simple_images table exists - good for image storage');
        } else {
            console.log('⚠️  simple_images table missing - may need to create it');
        }
        
        // Check for notices table
        const notices = tables.rows.find(t => t.tablename === 'notices');
        if (notices) {
            console.log('✅ notices table exists - good for notice tracking');
        } else {
            console.log('⚠️  notices table missing - may affect notice tracking');
        }

    } catch (error) {
        console.error('❌ Error checking schema:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the check
console.log('='.repeat(60));
console.log('DATABASE SCHEMA CHECK');
console.log('='.repeat(60) + '\n');

checkSchema()
    .then(() => {
        console.log('\n' + '='.repeat(60));
        console.log('SCHEMA CHECK COMPLETE');
        console.log('='.repeat(60));
        console.log('\nNext steps:');
        console.log('1. If case tables don\'t exist, run: node run-case-migration.js');
        console.log('2. If case tables exist, check if they have the right structure');
        console.log('3. Make sure simple_images table exists for image storage\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('Schema check failed:', error);
        process.exit(1);
    });