/**
 * Check Document Content
 * Verify what's actually stored in the document_data field
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkDocumentContent(noticeId) {
    try {
        console.log('\n🔍 CHECKING DOCUMENT CONTENT');
        console.log('=' .repeat(60));
        console.log('Notice ID:', noticeId);
        console.log('');
        
        // Get the document data
        const result = await pool.query(`
            SELECT 
                notice_id,
                case_number,
                recipient_address,
                document_data,
                document_mime_type,
                alert_thumbnail_data,
                alert_thumbnail_mime_type,
                LENGTH(document_data) as doc_length,
                LENGTH(alert_thumbnail_data) as alert_length
            FROM notice_components
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (result.rows.length === 0) {
            console.log('❌ Notice not found');
            return;
        }
        
        const row = result.rows[0];
        
        console.log('NOTICE DETAILS:');
        console.log('-'.repeat(40));
        console.log('Case Number:', row.case_number);
        console.log('Recipient:', row.recipient_address);
        console.log('Document MIME Type:', row.document_mime_type || 'NULL');
        console.log('Alert MIME Type:', row.alert_thumbnail_mime_type || 'NULL');
        console.log('');
        
        // Check document data
        if (row.document_data) {
            console.log('DOCUMENT DATA ANALYSIS:');
            console.log('-'.repeat(40));
            console.log('Base64 Length:', row.doc_length, 'characters');
            console.log('Estimated Size:', (row.doc_length * 0.75 / 1024).toFixed(2), 'KB');
            
            // Decode and analyze
            try {
                const decoded = Buffer.from(row.document_data, 'base64');
                console.log('Decoded Size:', (decoded.length / 1024).toFixed(2), 'KB');
                
                // Check if it's a PDF
                if (decoded[0] === 0x25 && decoded[1] === 0x50 && decoded[2] === 0x44 && decoded[3] === 0x46) {
                    console.log('✅ Document is a valid PDF');
                    
                    // Try to count pages and check for truncation
                    const pdfString = decoded.toString('latin1');
                    
                    // Count page objects
                    const pageMatches = pdfString.match(/\/Type\s*\/Page(?!s)/g);
                    if (pageMatches) {
                        console.log('📄 Pages found in PDF:', pageMatches.length);
                    }
                    
                    // Check for EOF marker
                    const hasEOF = pdfString.includes('%%EOF');
                    console.log('PDF has EOF marker:', hasEOF ? 'Yes ✅' : 'No ❌ (TRUNCATED!)');
                    
                    // Check for xref table
                    const hasXref = pdfString.includes('xref');
                    console.log('PDF has xref table:', hasXref ? 'Yes' : 'No (might be truncated)');
                    
                    // Look for linearization (web optimization)
                    const isLinearized = pdfString.includes('/Linearized');
                    console.log('PDF is linearized:', isLinearized ? 'Yes' : 'No');
                    
                    // Check for specific page markers
                    const page47Match = pdfString.match(/Page 47/i);
                    console.log('Contains "Page 47" text:', page47Match ? 'Yes' : 'No');
                    
                    // Save a sample to file for inspection
                    const outputPath = `/tmp/sample_${noticeId}.pdf`;
                    await fs.writeFile(outputPath, decoded);
                    console.log(`\n📁 Saved PDF sample to: ${outputPath}`);
                    console.log('   You can download and check if all 47 pages are there');
                    
                } else if (decoded[0] === 0x89 && decoded[1] === 0x50 && decoded[2] === 0x4E) {
                    console.log('✅ Document is a PNG image');
                } else {
                    console.log('❓ Unknown document format');
                    console.log('First 10 bytes:', Array.from(decoded.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                }
                
                // Show first and last 100 chars of base64
                console.log('\nBase64 Data Sample:');
                console.log('First 100 chars:', row.document_data.substring(0, 100));
                console.log('Last 100 chars:', row.document_data.substring(row.document_data.length - 100));
                
            } catch (e) {
                console.log('❌ Error decoding document:', e.message);
            }
        } else {
            console.log('❌ No document data found');
        }
        
        // Check alert data
        if (row.alert_thumbnail_data) {
            console.log('\n\nALERT THUMBNAIL ANALYSIS:');
            console.log('-'.repeat(40));
            console.log('Base64 Length:', row.alert_length, 'characters');
            console.log('Estimated Size:', (row.alert_length * 0.75 / 1024).toFixed(2), 'KB');
            
            try {
                const decoded = Buffer.from(row.alert_thumbnail_data, 'base64');
                console.log('Decoded Size:', (decoded.length / 1024).toFixed(2), 'KB');
                
                // Check format
                if (decoded[0] === 0x89 && decoded[1] === 0x50 && decoded[2] === 0x4E) {
                    console.log('✅ Alert is a PNG image');
                } else if (decoded[0] === 0xFF && decoded[1] === 0xD8) {
                    console.log('✅ Alert is a JPEG image');
                } else if (decoded[0] === 0x25 && decoded[1] === 0x50 && decoded[2] === 0x44) {
                    console.log('⚠️ Alert is a PDF (should be an image!)');
                } else {
                    console.log('❓ Unknown alert format');
                }
            } catch (e) {
                console.log('❌ Error decoding alert:', e.message);
            }
        } else {
            console.log('\n❌ No alert thumbnail data found');
        }
        
        // Check related data
        console.log('\n\nRELATED TOKEN IDS:');
        console.log('-'.repeat(40));
        
        const tokenResult = await pool.query(`
            SELECT 
                notice_id,
                alert_id,
                document_id
            FROM served_notices
            WHERE notice_id = $1
        `, [noticeId]);
        
        if (tokenResult.rows.length > 0) {
            const tokens = tokenResult.rows[0];
            console.log('Alert Token ID:', tokens.alert_id);
            console.log('Document Token ID:', tokens.document_id);
            
            console.log('\n📋 Run these commands to check blockchain:');
            console.log(`checkToken(${tokens.alert_id})`);
            console.log(`checkToken(${tokens.document_id})`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('CHECK COMPLETE');
        
        // Summary
        console.log('\n⚠️ ISSUES FOUND:');
        if (row.doc_length && row.doc_length < 500000) { // Less than 500KB
            console.log('- Document is too small for 47 pages (only ' + (row.doc_length * 0.75 / 1024).toFixed(2) + ' KB)');
            console.log('- Expected: ~2000-3000 KB for 47 pages');
            console.log('- This means the document was likely TRUNCATED during upload');
        }
        if (!row.alert_thumbnail_data) {
            console.log('- No alert thumbnail data found');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

// Get notice ID from command line
const noticeId = process.argv[2];

if (!noticeId) {
    console.log('Usage: node check-document-content.js <notice_id>');
    console.log('Example: node check-document-content.js 943220202');
    console.log('\nAvailable notice IDs for case 34-2501-8285700:');
    console.log('  943220200, 943220201, 943220202');
    console.log('  871448100, 871448101, 871448102');
    console.log('  291224100, 291224101, 291224102');
} else {
    checkDocumentContent(noticeId);
}