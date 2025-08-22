/**
 * Comprehensive Backend Data Inspector
 * Shows all data stored in the backend database
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
});

async function inspectAllData() {
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE BACKEND DATA INSPECTION');
    console.log('='.repeat(80));
    console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Local'}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('='.repeat(80));

    try {
        // 1. CASES TABLE
        console.log('\n📁 CASES TABLE:');
        console.log('-'.repeat(40));
        const casesResult = await pool.query(`
            SELECT 
                case_number,
                status,
                created_at,
                updated_at,
                metadata,
                server_address
            FROM cases 
            ORDER BY created_at DESC
        `);
        
        if (casesResult.rows.length === 0) {
            console.log('  ❌ No cases found');
        } else {
            console.log(`  ✅ Found ${casesResult.rows.length} cases:\n`);
            casesResult.rows.forEach((row, i) => {
                console.log(`  ${i + 1}. Case: ${row.case_number}`);
                console.log(`     Status: ${row.status}`);
                console.log(`     Server: ${row.server_address || 'Not set'}`);
                console.log(`     Created: ${new Date(row.created_at).toLocaleString()}`);
                
                // Parse and display metadata
                const metadata = typeof row.metadata === 'string' ? 
                    JSON.parse(row.metadata) : row.metadata;
                if (metadata) {
                    console.log(`     Metadata:`);
                    if (metadata.agency || metadata.issuingAgency) {
                        console.log(`       - Agency: ${metadata.agency || metadata.issuingAgency}`);
                    }
                    if (metadata.noticeType) {
                        console.log(`       - Notice Type: ${metadata.noticeType}`);
                    }
                    if (metadata.recipients) {
                        console.log(`       - Recipients: ${metadata.recipients.length} addresses`);
                    }
                }
                console.log();
            });
        }

        // 2. CASE SERVICE RECORDS TABLE
        console.log('\n📋 CASE SERVICE RECORDS:');
        console.log('-'.repeat(40));
        const serviceResult = await pool.query(`
            SELECT 
                case_number,
                transaction_hash,
                alert_token_id,
                document_token_id,
                ipfs_hash,
                encryption_key,
                recipients,
                page_count,
                served_at,
                server_address,
                created_at
            FROM case_service_records 
            ORDER BY served_at DESC
        `);
        
        if (serviceResult.rows.length === 0) {
            console.log('  ❌ No service records found');
        } else {
            console.log(`  ✅ Found ${serviceResult.rows.length} service records:\n`);
            serviceResult.rows.forEach((row, i) => {
                console.log(`  ${i + 1}. Case: ${row.case_number}`);
                console.log(`     Transaction: ${row.transaction_hash || 'Not recorded'}`);
                console.log(`     Alert NFT: #${row.alert_token_id || 'Not recorded'}`);
                console.log(`     Document NFT: #${row.document_token_id || 'Not recorded'}`);
                console.log(`     IPFS Hash: ${row.ipfs_hash ? row.ipfs_hash.substring(0, 20) + '...' : 'Not stored'}`);
                console.log(`     Encryption: ${row.encryption_key ? '✅ Has key' : '❌ No key'}`);
                console.log(`     Page Count: ${row.page_count || 0}`);
                console.log(`     Served: ${row.served_at ? new Date(row.served_at).toLocaleString() : 'Not recorded'}`);
                console.log(`     Server: ${row.server_address || 'Not recorded'}`);
                
                // Parse recipients
                const recipients = typeof row.recipients === 'string' ? 
                    JSON.parse(row.recipients) : row.recipients;
                if (recipients && recipients.length > 0) {
                    console.log(`     Recipients (${recipients.length}):`);
                    recipients.forEach((r, j) => {
                        console.log(`       ${j + 1}. ${r}`);
                    });
                }
                console.log();
            });
        }

        // 3. NOTICE IMAGES TABLE
        console.log('\n🖼️  NOTICE IMAGES:');
        console.log('-'.repeat(40));
        const imagesResult = await pool.query(`
            SELECT 
                case_number,
                alert_image,
                document_preview,
                created_at
            FROM notice_images 
            ORDER BY created_at DESC
        `);
        
        if (imagesResult.rows.length === 0) {
            console.log('  ❌ No notice images found');
        } else {
            console.log(`  ✅ Found ${imagesResult.rows.length} image records:\n`);
            imagesResult.rows.forEach((row, i) => {
                console.log(`  ${i + 1}. Case: ${row.case_number}`);
                console.log(`     Alert Image: ${row.alert_image ? '✅ Stored (base64)' : '❌ Not stored'}`);
                console.log(`     Document Preview: ${row.document_preview ? '✅ Stored' : '❌ Not stored'}`);
                console.log(`     Created: ${new Date(row.created_at).toLocaleString()}`);
                console.log();
            });
        }

        // 4. AUDIT LOGS TABLE
        console.log('\n📊 AUDIT LOGS (Recent Activity):');
        console.log('-'.repeat(40));
        const auditResult = await pool.query(`
            SELECT 
                action_type,
                actor_address,
                target_id,
                ip_address,
                created_at
            FROM audit_logs 
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        if (auditResult.rows.length === 0) {
            console.log('  ❌ No audit logs found');
        } else {
            console.log(`  ✅ Showing last ${auditResult.rows.length} audit events:\n`);
            auditResult.rows.forEach((row, i) => {
                console.log(`  ${i + 1}. ${new Date(row.created_at).toLocaleString()}`);
                console.log(`     Action: ${row.action_type}`);
                console.log(`     Actor: ${row.actor_address?.substring(0, 10)}...`);
                console.log(`     Target: ${row.target_id || 'N/A'}`);
                console.log(`     IP: ${row.ip_address || 'Not recorded'}`);
                console.log();
            });
        }

        // 5. NOTICE VIEWS TABLE
        console.log('\n👁️  NOTICE VIEWS (Recipient Signatures):');
        console.log('-'.repeat(40));
        const viewsResult = await pool.query(`
            SELECT 
                alert_id,
                wallet_address,
                viewed_at,
                signed_at,
                ip_address
            FROM notice_views 
            ORDER BY viewed_at DESC
            LIMIT 20
        `);
        
        if (viewsResult.rows.length === 0) {
            console.log('  ❌ No notice views recorded');
        } else {
            console.log(`  ✅ Found ${viewsResult.rows.length} view records:\n`);
            viewsResult.rows.forEach((row, i) => {
                console.log(`  ${i + 1}. Alert #${row.alert_id}`);
                console.log(`     Wallet: ${row.wallet_address?.substring(0, 10)}...`);
                console.log(`     Viewed: ${row.viewed_at ? new Date(row.viewed_at).toLocaleString() : 'Not recorded'}`);
                console.log(`     Signed: ${row.signed_at ? '✅ ' + new Date(row.signed_at).toLocaleString() : '❌ Not signed'}`);
                console.log(`     IP: ${row.ip_address || 'Not recorded'}`);
                console.log();
            });
        }

        // 6. DATA CONSISTENCY CHECK
        console.log('\n🔍 DATA CONSISTENCY CHECK:');
        console.log('-'.repeat(40));
        
        // Check for cases without service records
        const orphanCases = await pool.query(`
            SELECT c.case_number 
            FROM cases c
            LEFT JOIN case_service_records csr ON c.case_number = csr.case_number
            WHERE csr.case_number IS NULL AND c.status = 'served'
        `);
        
        if (orphanCases.rows.length > 0) {
            console.log(`  ⚠️  Found ${orphanCases.rows.length} served cases without service records:`);
            orphanCases.rows.forEach(row => {
                console.log(`     - ${row.case_number}`);
            });
        } else {
            console.log('  ✅ All served cases have service records');
        }
        
        // Check for service records without images
        const missingImages = await pool.query(`
            SELECT csr.case_number 
            FROM case_service_records csr
            LEFT JOIN notice_images ni ON csr.case_number = ni.case_number
            WHERE ni.case_number IS NULL
        `);
        
        if (missingImages.rows.length > 0) {
            console.log(`  ⚠️  Found ${missingImages.rows.length} service records without images:`);
            missingImages.rows.forEach(row => {
                console.log(`     - ${row.case_number}`);
            });
        } else {
            console.log('  ✅ All service records have associated images');
        }

        // 7. SUMMARY STATISTICS
        console.log('\n📈 SUMMARY STATISTICS:');
        console.log('-'.repeat(40));
        
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM cases) as total_cases,
                (SELECT COUNT(*) FROM cases WHERE status = 'served') as served_cases,
                (SELECT COUNT(*) FROM case_service_records) as service_records,
                (SELECT COUNT(*) FROM notice_images) as image_records,
                (SELECT COUNT(*) FROM audit_logs) as audit_events,
                (SELECT COUNT(DISTINCT actor_address) FROM audit_logs) as unique_recipients_tracked,
                (SELECT COUNT(*) FROM notice_views WHERE signed_at IS NOT NULL) as documents_signed
        `);
        
        const s = stats.rows[0];
        console.log(`  Total Cases: ${s.total_cases}`);
        console.log(`  Served Cases: ${s.served_cases}`);
        console.log(`  Service Records: ${s.service_records}`);
        console.log(`  Image Records: ${s.image_records}`);
        console.log(`  Audit Events: ${s.audit_events}`);
        console.log(`  Unique Recipients Tracked: ${s.unique_recipients_tracked}`);
        console.log(`  Documents Signed: ${s.documents_signed}`);

        console.log('\n' + '='.repeat(80));
        console.log('INSPECTION COMPLETE');
        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.code === '42P01') {
            console.log('\n⚠️  Some tables may not exist. Run migrations first.');
        }
    } finally {
        await pool.end();
    }
}

// Run the inspection
inspectAllData();