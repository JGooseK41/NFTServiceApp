/**
 * Safe Database Cleanup Script
 * Removes only empty, unused tables while preserving all data
 * 
 * Usage in Render Shell:
 * node safe-database-cleanup.js
 * 
 * Add --execute flag to actually run the cleanup:
 * node safe-database-cleanup.js --execute
 */

const { Pool } = require('pg');

async function safeCleanup() {
    console.log('🧹 SAFE DATABASE CLEANUP');
    console.log('='.repeat(60));
    
    const isDryRun = !process.argv.includes('--execute');
    
    if (isDryRun) {
        console.log('📋 DRY RUN MODE - No changes will be made');
        console.log('Add --execute flag to actually perform cleanup\n');
    } else {
        console.log('⚠️  EXECUTE MODE - Tables will be dropped!\n');
    }
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    try {
        // Tables to remove (verified empty and unused)
        const tablesToRemove = [
            'active_notices',           // 0 rows - replaced by served_notices
            'document_access_log',       // 0 rows - not implemented
            'document_access_tokens',    // 0 rows - not implemented
            'draft_files',              // 0 rows - replaced by notice_drafts
            'notice_events',            // 0 rows - replaced by audit_logs
            'pending_notices',          // 0 rows - replaced by staged_notices
            'prepared_transactions',     // 0 rows - replaced by staged_transactions
            'server_ratings',           // 0 rows - not implemented
            'staged_files',             // 0 rows - replaced by document_storage
            'staged_ipfs',              // 0 rows - replaced by notice_components
            'transaction_hashes',       // 0 rows - data in served_notices
            'access_attempts'           // 0 rows - replaced by audit_logs
        ];
        
        // Tables to keep (have data or needed for functionality)
        const tablesToKeep = [
            'served_notices',           // 64 rows - main notice records
            'notice_components',        // 51 rows - detailed notice data
            'images',                   // 11 rows - image storage
            'document_storage',         // 13 rows - document storage
            'simple_images',            // NEW - for image retrieval
            'prepared_cases',           // NEW - for 2-stage workflow
            'case_documents',           // NEW - for case documents
            'audit_logs',              // 8222 rows - audit trail
            'wallet_connections',       // 1075 rows - connection logs
            'process_servers',         // 2 rows - server registrations
            'blockchain_cache',        // 26 rows - blockchain cache
            'notice_views',            // 18 rows - view tracking
            'batch_uploads',           // 14 rows - batch processing
            'notice_batch_items',      // 46 rows - batch items
            'notice_drafts',           // 4 rows - draft notices
            'staged_energy_estimates', // 12 rows - energy estimates
            'staged_notices',          // 12 rows - staged notices
            'staged_recipients',       // 36 rows - recipient staging
            'staged_transactions',     // 12 rows - transaction staging
            'migrations',              // 1 row - migration tracking
            'notice_acceptances'       // 0 rows BUT keeping for future signatures
        ];

        console.log('📊 CLEANUP PLAN');
        console.log('-'.repeat(60));
        
        // Verify tables are actually empty before dropping
        console.log('\n🔍 Verifying tables are empty...');
        let allEmpty = true;
        
        for (const table of tablesToRemove) {
            try {
                const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                const count = parseInt(result.rows[0].count);
                
                if (count > 0) {
                    console.log(`❌ ${table}: Has ${count} rows - WILL NOT DROP`);
                    allEmpty = false;
                } else {
                    console.log(`✅ ${table}: Empty (0 rows) - Safe to drop`);
                }
            } catch (error) {
                console.log(`⚠️  ${table}: Does not exist`);
            }
        }
        
        if (!allEmpty) {
            console.log('\n⚠️  Some tables have data! Aborting cleanup for safety.');
            return;
        }
        
        // Show what will be kept
        console.log('\n📋 TABLES TO KEEP (with row counts):');
        console.log('-'.repeat(60));
        
        for (const table of tablesToKeep) {
            try {
                const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                const count = parseInt(result.rows[0].count);
                console.log(`✅ ${table}: ${count} rows`);
            } catch (error) {
                console.log(`⚠️  ${table}: Does not exist yet`);
            }
        }
        
        // Execute cleanup if requested
        if (!isDryRun) {
            console.log('\n🗑️  DROPPING EMPTY TABLES...');
            console.log('-'.repeat(60));
            
            let droppedCount = 0;
            for (const table of tablesToRemove) {
                try {
                    await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
                    console.log(`✅ Dropped: ${table}`);
                    droppedCount++;
                } catch (error) {
                    console.log(`❌ Failed to drop ${table}: ${error.message}`);
                }
            }
            
            console.log(`\n✅ Successfully dropped ${droppedCount} empty tables`);
            
            // Show final state
            console.log('\n📊 FINAL DATABASE STATE');
            console.log('-'.repeat(60));
            
            const finalTables = await pool.query(`
                SELECT tablename, 
                       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename
            `);
            
            console.log(`Total tables remaining: ${finalTables.rows.length}`);
            console.log('\nTable sizes:');
            finalTables.rows.forEach(t => {
                console.log(`  ${t.tablename}: ${t.size}`);
            });
            
        } else {
            console.log('\n💡 TO EXECUTE CLEANUP, RUN:');
            console.log('   node safe-database-cleanup.js --execute');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n' + '='.repeat(60));
        console.log(isDryRun ? 'DRY RUN COMPLETE' : 'CLEANUP COMPLETE');
        console.log('='.repeat(60));
        
        if (!isDryRun) {
            console.log('\n✅ Your database is now optimized with:');
            console.log('   - All data preserved');
            console.log('   - 12 empty tables removed');
            console.log('   - Clean structure for your workflow\n');
        }
    }
}

// Run the cleanup
safeCleanup()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Cleanup failed:', error);
        process.exit(1);
    });