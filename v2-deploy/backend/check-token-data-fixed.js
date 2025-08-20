/**
 * Check Token Data in Database - Fixed for actual schema
 * Verify what was stored for alert and document tokens
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTokenData(tokenId) {
    try {
        console.log('\n🔍 CHECKING TOKEN DATA IN DATABASE');
        console.log('=' .repeat(60));
        console.log('Token ID:', tokenId);
        console.log('');
        
        // First, let's check what columns actually exist
        console.log('1. CHECKING NOTICE_COMPONENTS SCHEMA:');
        console.log('-'.repeat(40));
        
        const schemaResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notice_components'
            ORDER BY ordinal_position
        `);
        
        console.log('Available columns:');
        schemaResult.rows.forEach(row => {
            console.log(`  - ${row.column_name} (${row.data_type})`);
        });
        
        // 2. Check notice_components table with actual columns
        console.log('\n2. NOTICE_COMPONENTS DATA:');
        console.log('-'.repeat(40));
        
        // Try different ways to find the record
        const queries = [
            // By notice_id
            {
                name: 'By notice_id',
                query: `SELECT * FROM notice_components WHERE notice_id = $1 LIMIT 1`,
                param: tokenId
            },
            // By case number
            {
                name: 'By case 34-2501-8285700',
                query: `SELECT * FROM notice_components WHERE case_number = '34-2501-8285700' LIMIT 1`,
                param: null
            },
            // Most recent
            {
                name: 'Most recent notice',
                query: `SELECT * FROM notice_components ORDER BY created_at DESC LIMIT 1`,
                param: null
            }
        ];
        
        for (const q of queries) {
            console.log(`\nSearching ${q.name}...`);
            try {
                const result = q.param ? 
                    await pool.query(q.query, [q.param]) : 
                    await pool.query(q.query);
                    
                if (result.rows.length > 0) {
                    const row = result.rows[0];
                    console.log('✅ Found record:');
                    console.log('   Notice ID:', row.notice_id);
                    console.log('   Case Number:', row.case_number);
                    console.log('   Recipient:', row.recipient_address);
                    console.log('   Server:', row.server_address);
                    
                    // Check for alert data
                    if (row.alert_thumbnail_data) {
                        console.log('   Alert Data Size:', (row.alert_thumbnail_data.length / 1024).toFixed(2), 'KB');
                        console.log('   Alert MIME:', row.alert_thumbnail_mime_type);
                        
                        // Show sample
                        console.log('   Alert Sample:', row.alert_thumbnail_data.substring(0, 100) + '...');
                    } else {
                        console.log('   Alert Data: NULL');
                    }
                    
                    // Check for document data
                    if (row.document_data) {
                        console.log('   Document Data Size:', (row.document_data.length / 1024).toFixed(2), 'KB');
                        console.log('   Document MIME:', row.document_mime_type);
                        
                        // Estimate pages
                        const estimatedPages = Math.round(row.document_data.length * 0.75 / 1024 / 50);
                        console.log('   Estimated Pages:', estimatedPages);
                        
                        // Check if it's a PDF
                        try {
                            const decoded = Buffer.from(row.document_data, 'base64');
                            if (decoded[0] === 0x25 && decoded[1] === 0x50 && decoded[2] === 0x44 && decoded[3] === 0x46) {
                                console.log('   ✅ Document is a valid PDF');
                                
                                // Try to count pages
                                const pdfString = decoded.toString('latin1');
                                const pageMatches = pdfString.match(/\/Type\s*\/Page(?!s)/g);
                                if (pageMatches) {
                                    console.log('   📄 Actual PDF pages detected:', pageMatches.length);
                                }
                            }
                        } catch (e) {
                            // Ignore
                        }
                        
                        // Show sample
                        console.log('   Document Sample:', row.document_data.substring(0, 100) + '...');
                    } else {
                        console.log('   Document Data: NULL');
                    }
                    
                    // Check URIs if they exist
                    if (row.alert_token_uri) {
                        console.log('   Alert Token URI:', row.alert_token_uri.substring(0, 100) + '...');
                    }
                    if (row.document_token_uri) {
                        console.log('   Document Token URI:', row.document_token_uri.substring(0, 100) + '...');
                    }
                    
                    break; // Found a record, stop searching
                }
            } catch (e) {
                console.log('   Query failed:', e.message);
            }
        }
        
        // 3. Check documents table
        console.log('\n3. DOCUMENTS TABLE:');
        console.log('-'.repeat(40));
        
        const docsResult = await pool.query(`
            SELECT 
                id,
                notice_id,
                case_number,
                LENGTH(alert_thumbnail) as alert_size,
                LENGTH(document_full) as document_size,
                created_at
            FROM documents
            WHERE case_number = '34-2501-8285700'
               OR notice_id = $1
            LIMIT 1
        `, [tokenId]);
        
        if (docsResult.rows.length > 0) {
            const row = docsResult.rows[0];
            console.log('✅ Found in documents:');
            console.log('   Notice ID:', row.notice_id);
            console.log('   Case:', row.case_number);
            console.log('   Alert Size:', row.alert_size ? `${(row.alert_size / 1024).toFixed(2)} KB` : 'NULL');
            console.log('   Document Size:', row.document_size ? `${(row.document_size / 1024).toFixed(2)} KB` : 'NULL');
            
            if (row.document_size) {
                const estimatedPages = Math.round(row.document_size * 0.75 / 1024 / 50);
                console.log('   Estimated Pages:', estimatedPages);
            }
        } else {
            console.log('❌ Not found in documents table');
        }
        
        // 4. Check served_notices
        console.log('\n4. SERVED_NOTICES TABLE:');
        console.log('-'.repeat(40));
        
        const servedResult = await pool.query(`
            SELECT 
                notice_id,
                alert_id,
                document_id,
                case_number,
                status,
                created_at
            FROM served_notices
            WHERE case_number = '34-2501-8285700'
               OR notice_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [tokenId]);
        
        if (servedResult.rows.length > 0) {
            const row = servedResult.rows[0];
            console.log('✅ Found in served_notices:');
            console.log('   Notice ID:', row.notice_id);
            console.log('   Alert ID:', row.alert_id);
            console.log('   Document ID:', row.document_id);
            console.log('   Case:', row.case_number);
            console.log('   Status:', row.status);
        } else {
            console.log('❌ Not found in served_notices');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('CHECK COMPLETE');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('Error checking token data:', error);
    } finally {
        await pool.end();
    }
}

// Get token ID from command line or use default
const tokenId = process.argv[2] || '943220202';

checkTokenData(tokenId);