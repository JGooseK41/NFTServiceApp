/**
 * Check Token Data in Database
 * Verify what was stored for alert and document tokens
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTokenData(alertTokenId, documentTokenId) {
    try {
        console.log('\n🔍 CHECKING TOKEN DATA IN DATABASE');
        console.log('=' .repeat(60));
        console.log('Alert Token ID:', alertTokenId);
        console.log('Document Token ID:', documentTokenId);
        console.log('');
        
        // 1. Check notice_components table
        console.log('1. NOTICE_COMPONENTS TABLE:');
        console.log('-'.repeat(40));
        
        const componentResult = await pool.query(`
            SELECT 
                id,
                alert_token_id,
                document_token_id,
                case_number,
                recipient_address,
                server_address,
                LENGTH(alert_thumbnail_data) as alert_data_size,
                alert_thumbnail_mime_type,
                LENGTH(document_data) as document_data_size,
                document_mime_type,
                created_at
            FROM notice_components
            WHERE alert_token_id = $1 OR document_token_id = $2
        `, [alertTokenId, documentTokenId]);
        
        if (componentResult.rows.length > 0) {
            const row = componentResult.rows[0];
            console.log('✅ Found in notice_components:');
            console.log('   Case Number:', row.case_number);
            console.log('   Recipient:', row.recipient_address);
            console.log('   Server:', row.server_address);
            console.log('   Alert Data Size:', row.alert_data_size ? `${(row.alert_data_size / 1024).toFixed(2)} KB` : 'NULL');
            console.log('   Alert MIME Type:', row.alert_thumbnail_mime_type || 'NULL');
            console.log('   Document Data Size:', row.document_data_size ? `${(row.document_data_size / 1024).toFixed(2)} KB` : 'NULL');
            console.log('   Document MIME Type:', row.document_mime_type || 'NULL');
            
            // Estimate page count if document exists
            if (row.document_data_size) {
                const estimatedPages = Math.round(row.document_data_size * 0.75 / 1024 / 50);
                console.log('   Estimated Pages:', estimatedPages);
            }
        } else {
            console.log('❌ Not found in notice_components');
        }
        
        // 2. Check token_tracking table
        console.log('\n2. TOKEN_TRACKING TABLE:');
        console.log('-'.repeat(40));
        
        try {
            const tokenResult = await pool.query(`
                SELECT 
                    token_id,
                    token_type,
                    case_number,
                    recipient_address,
                    server_address,
                    ipfs_hash,
                    document_hash,
                    page_count,
                    is_delivered,
                    is_signed,
                    created_at
                FROM token_tracking
                WHERE token_id IN ($1, $2)
                ORDER BY token_id
            `, [alertTokenId, documentTokenId]);
            
            if (tokenResult.rows.length > 0) {
                tokenResult.rows.forEach(row => {
                    console.log(`\n   Token ${row.token_id} (${row.token_type}):`);
                    console.log('   Case Number:', row.case_number);
                    console.log('   IPFS Hash:', row.ipfs_hash || 'NULL');
                    console.log('   Document Hash:', row.document_hash || 'NULL');
                    console.log('   Page Count:', row.page_count || 'NULL');
                    console.log('   Delivered:', row.is_delivered);
                    console.log('   Signed:', row.is_signed);
                });
            } else {
                console.log('❌ Not found in token_tracking');
            }
        } catch (e) {
            console.log('⚠️ token_tracking table not found or error:', e.message);
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
            WHERE notice_id = $1 OR notice_id = $2
        `, [alertTokenId, documentTokenId]);
        
        if (docsResult.rows.length > 0) {
            docsResult.rows.forEach(row => {
                console.log(`\n   Notice ${row.notice_id}:`);
                console.log('   Alert Size:', row.alert_size ? `${(row.alert_size / 1024).toFixed(2)} KB` : 'NULL');
                console.log('   Document Size:', row.document_size ? `${(row.document_size / 1024).toFixed(2)} KB` : 'NULL');
            });
        } else {
            console.log('❌ Not found in documents table');
        }
        
        // 4. Extract and save samples if data exists
        console.log('\n4. DATA EXTRACTION:');
        console.log('-'.repeat(40));
        
        const extractResult = await pool.query(`
            SELECT 
                alert_thumbnail_data,
                document_data
            FROM notice_components
            WHERE alert_token_id = $1 OR document_token_id = $2
            LIMIT 1
        `, [alertTokenId, documentTokenId]);
        
        if (extractResult.rows.length > 0) {
            const row = extractResult.rows[0];
            
            // Save alert thumbnail sample
            if (row.alert_thumbnail_data) {
                const alertSample = row.alert_thumbnail_data.substring(0, 200);
                console.log('\nAlert Thumbnail (first 200 chars):');
                console.log(alertSample + '...');
                
                // Check if it's valid base64
                try {
                    const decoded = Buffer.from(row.alert_thumbnail_data, 'base64');
                    console.log('✅ Valid base64, decoded size:', (decoded.length / 1024).toFixed(2), 'KB');
                } catch (e) {
                    console.log('❌ Invalid base64 encoding');
                }
            }
            
            // Save document sample
            if (row.document_data) {
                const docSample = row.document_data.substring(0, 200);
                console.log('\nDocument Data (first 200 chars):');
                console.log(docSample + '...');
                
                // Check if it's valid base64
                try {
                    const decoded = Buffer.from(row.document_data, 'base64');
                    console.log('✅ Valid base64, decoded size:', (decoded.length / 1024).toFixed(2), 'KB');
                    
                    // Check if it's a PDF
                    if (decoded[0] === 0x25 && decoded[1] === 0x50 && decoded[2] === 0x44 && decoded[3] === 0x46) {
                        console.log('✅ Document is a valid PDF');
                        
                        // Rough page count estimation for PDF
                        const pdfString = decoded.toString('latin1');
                        const pageMatches = pdfString.match(/\/Type\s*\/Page(?!s)/g);
                        if (pageMatches) {
                            console.log('📄 Detected pages in PDF:', pageMatches.length);
                        }
                    }
                } catch (e) {
                    console.log('❌ Invalid base64 encoding');
                }
            }
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

// Get token IDs from command line or use defaults
const alertTokenId = process.argv[2] || '943220201';
const documentTokenId = process.argv[3] || '943220202';

checkTokenData(alertTokenId, documentTokenId);