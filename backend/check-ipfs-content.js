/**
 * Check IPFS Content
 * Verify what was actually stored on IPFS for the notices
 */

const { Pool } = require('pg');
const https = require('https');
const fs = require('fs').promises;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// IPFS Gateways to try
const IPFS_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
];

async function fetchFromIPFS(ipfsHash, gateway) {
    return new Promise((resolve, reject) => {
        const url = gateway + ipfsHash;
        console.log(`  Trying: ${url}`);
        
        https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, data, gateway });
                } else {
                    resolve({ success: false, status: res.statusCode });
                }
            });
        }).on('error', (err) => {
            resolve({ success: false, error: err.message });
        }).on('timeout', () => {
            resolve({ success: false, error: 'Timeout' });
        });
    });
}

async function checkIPFSContent() {
    try {
        console.log('\n🔍 CHECKING IPFS CONTENT FOR CASE 34-2501-8285700');
        console.log('=' .repeat(60));
        
        // 1. Look for IPFS hashes in the database
        console.log('\n1. SEARCHING FOR IPFS HASHES IN DATABASE:');
        console.log('-'.repeat(40));
        
        // Check notice_components for IPFS data
        const componentResult = await pool.query(`
            SELECT 
                notice_id,
                case_number,
                recipient_address,
                ipfs_hash,
                document_ipfs_hash,
                alert_ipfs_hash,
                metadata_uri,
                document_uri,
                alert_token_uri,
                document_token_uri
            FROM notice_components
            WHERE case_number = '34-2501-8285700'
            LIMIT 5
        `).catch(e => {
            // Some columns might not exist
            return pool.query(`
                SELECT 
                    notice_id,
                    case_number,
                    recipient_address,
                    alert_token_uri,
                    document_token_uri
                FROM notice_components
                WHERE case_number = '34-2501-8285700'
                LIMIT 5
            `);
        });
        
        if (componentResult.rows.length > 0) {
            console.log(`Found ${componentResult.rows.length} notice_components records\n`);
            
            for (const row of componentResult.rows) {
                console.log(`Notice ID: ${row.notice_id}`);
                console.log(`  Recipient: ${row.recipient_address.substring(0, 10)}...`);
                
                // Check for IPFS hashes in various fields
                const fieldsToCheck = [
                    'ipfs_hash', 'document_ipfs_hash', 'alert_ipfs_hash',
                    'metadata_uri', 'document_uri', 'alert_token_uri', 'document_token_uri'
                ];
                
                let foundIPFS = false;
                for (const field of fieldsToCheck) {
                    if (row[field]) {
                        const value = row[field];
                        // Check if it contains IPFS hash
                        if (value.includes('ipfs://') || value.includes('Qm') || value.includes('bafy')) {
                            console.log(`  ${field}: ${value.substring(0, 100)}...`);
                            
                            // Extract IPFS hash
                            let ipfsHash = value;
                            if (value.includes('ipfs://')) {
                                ipfsHash = value.replace('ipfs://', '');
                            }
                            
                            // Try to fetch from IPFS
                            console.log(`\n  Fetching IPFS content for hash: ${ipfsHash.substring(0, 50)}...`);
                            
                            let fetched = false;
                            for (const gateway of IPFS_GATEWAYS) {
                                const result = await fetchFromIPFS(ipfsHash, gateway);
                                if (result.success) {
                                    console.log(`  ✅ Successfully fetched from ${result.gateway}`);
                                    console.log(`  Content length: ${result.data.length} bytes`);
                                    
                                    // Analyze content
                                    try {
                                        const parsed = JSON.parse(result.data);
                                        console.log(`  Content type: JSON metadata`);
                                        console.log(`  Name: ${parsed.name || 'N/A'}`);
                                        console.log(`  Description: ${parsed.description ? parsed.description.substring(0, 100) + '...' : 'N/A'}`);
                                        
                                        if (parsed.image) {
                                            console.log(`  Has image: Yes`);
                                            if (parsed.image.startsWith('data:')) {
                                                const imageSize = parsed.image.length;
                                                console.log(`  Image size: ${(imageSize / 1024).toFixed(2)} KB`);
                                            }
                                        }
                                        
                                        if (parsed.document_data) {
                                            console.log(`  Has document_data: Yes`);
                                            console.log(`  Document size: ${(parsed.document_data.length / 1024).toFixed(2)} KB`);
                                        }
                                        
                                        // Save to file for inspection
                                        const filename = `/tmp/ipfs_${row.notice_id}_metadata.json`;
                                        await fs.writeFile(filename, JSON.stringify(parsed, null, 2));
                                        console.log(`  📁 Saved to: ${filename}`);
                                        
                                    } catch (e) {
                                        // Not JSON, might be binary data
                                        if (result.data.startsWith('%PDF')) {
                                            console.log(`  Content type: PDF document`);
                                            const filename = `/tmp/ipfs_${row.notice_id}.pdf`;
                                            await fs.writeFile(filename, result.data);
                                            console.log(`  📁 Saved to: ${filename}`);
                                        } else {
                                            console.log(`  Content type: Unknown`);
                                            console.log(`  First 100 chars: ${result.data.substring(0, 100)}`);
                                        }
                                    }
                                    
                                    fetched = true;
                                    foundIPFS = true;
                                    break;
                                }
                            }
                            
                            if (!fetched) {
                                console.log(`  ❌ Could not fetch from any IPFS gateway`);
                            }
                        }
                    }
                }
                
                if (!foundIPFS) {
                    console.log(`  No IPFS hashes found in this record`);
                }
                console.log('');
            }
        } else {
            console.log('No records found in notice_components');
        }
        
        // 2. Check served_notices for IPFS data
        console.log('\n2. CHECKING SERVED_NOTICES FOR IPFS:');
        console.log('-'.repeat(40));
        
        const servedResult = await pool.query(`
            SELECT 
                notice_id,
                alert_id,
                document_id,
                ipfs_hash,
                document_hash,
                metadata
            FROM served_notices
            WHERE case_number = '34-2501-8285700'
            LIMIT 5
        `).catch(e => {
            return pool.query(`
                SELECT 
                    notice_id,
                    alert_id,
                    document_id
                FROM served_notices
                WHERE case_number = '34-2501-8285700'
                LIMIT 5
            `);
        });
        
        if (servedResult.rows.length > 0) {
            console.log(`Found ${servedResult.rows.length} served_notices records\n`);
            
            for (const row of servedResult.rows) {
                console.log(`Notice ID: ${row.notice_id}`);
                console.log(`  Alert ID: ${row.alert_id}`);
                console.log(`  Document ID: ${row.document_id}`);
                
                if (row.ipfs_hash) {
                    console.log(`  IPFS Hash: ${row.ipfs_hash}`);
                } else {
                    console.log(`  No IPFS hash stored`);
                }
                
                if (row.document_hash) {
                    console.log(`  Document Hash: ${row.document_hash}`);
                }
                console.log('');
            }
        }
        
        // 3. Check blockchain_documents table
        console.log('\n3. CHECKING BLOCKCHAIN_DOCUMENTS FOR IPFS:');
        console.log('-'.repeat(40));
        
        const blockchainResult = await pool.query(`
            SELECT 
                notice_id,
                case_number,
                ipfs_hash,
                transaction_hash,
                LENGTH(alert_thumbnail_data) as alert_size,
                LENGTH(document_data) as doc_size
            FROM blockchain_documents
            WHERE case_number = '34-2501-8285700'
            LIMIT 5
        `).catch(e => {
            console.log('blockchain_documents table not found or error');
            return { rows: [] };
        });
        
        if (blockchainResult.rows.length > 0) {
            console.log(`Found ${blockchainResult.rows.length} blockchain_documents records\n`);
            
            for (const row of blockchainResult.rows) {
                console.log(`Notice ID: ${row.notice_id}`);
                console.log(`  IPFS Hash: ${row.ipfs_hash || 'NULL'}`);
                console.log(`  Transaction Hash: ${row.transaction_hash || 'NULL'}`);
                console.log(`  Alert Size: ${row.alert_size ? (row.alert_size * 0.75 / 1024).toFixed(2) + ' KB' : 'NULL'}`);
                console.log(`  Document Size: ${row.doc_size ? (row.doc_size * 0.75 / 1024).toFixed(2) + ' KB' : 'NULL'}`);
                console.log('');
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('IPFS CHECK COMPLETE');
        console.log('='.repeat(60));
        
        console.log('\n📊 SUMMARY:');
        console.log('If IPFS was used, the content would be retrievable above.');
        console.log('If no IPFS hashes were found, the data was stored on-chain only.');
        console.log('The 257KB limit suggests on-chain storage was used, not IPFS.');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkIPFSContent();