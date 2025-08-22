/**
 * Fix BlockServed - Debug and populate recipient data
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function checkRecipientData() {
    try {
        console.log('=== CHECKING BLOCKSERVED DATA ===\n');
        
        // Check if notice_components table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'notice_components'
            )
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('❌ notice_components table does not exist!');
            console.log('Creating table...');
            
            await pool.query(`
                CREATE TABLE notice_components (
                    id SERIAL PRIMARY KEY,
                    notice_id VARCHAR(255),
                    alert_id VARCHAR(255),
                    document_id VARCHAR(255),
                    alert_token_id VARCHAR(255),
                    document_token_id VARCHAR(255),
                    case_number VARCHAR(255),
                    recipient_address VARCHAR(255),
                    server_address VARCHAR(255),
                    notice_type VARCHAR(255),
                    issuing_agency VARCHAR(255),
                    transaction_hash VARCHAR(255),
                    ipfs_hash VARCHAR(255),
                    encryption_key TEXT,
                    page_count INTEGER DEFAULT 1,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            console.log('✅ Table created');
        }
        
        // Check what data we have
        const dataCheck = await pool.query(`
            SELECT COUNT(*) as count FROM notice_components
        `);
        
        console.log(`Found ${dataCheck.rows[0].count} notice records\n`);
        
        // Get sample data
        const samples = await pool.query(`
            SELECT * FROM notice_components LIMIT 5
        `);
        
        if (samples.rows.length > 0) {
            console.log('Sample records:');
            samples.rows.forEach(row => {
                console.log(`- Case ${row.case_number}: ${row.recipient_address} (Alert #${row.alert_token_id})`);
            });
        }
        
        // Now check case_service_records for data we can import
        console.log('\n=== CHECKING CASE SERVICE RECORDS ===\n');
        
        const serviceRecords = await pool.query(`
            SELECT * FROM case_service_records WHERE transaction_hash IS NOT NULL
        `);
        
        console.log(`Found ${serviceRecords.rows.length} served cases with transaction hashes\n`);
        
        if (serviceRecords.rows.length > 0) {
            console.log('Would you like to import these into notice_components for BlockServed access?');
            console.log('Run: node fix-blockserved.js --import');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

async function importServiceRecords() {
    try {
        console.log('=== IMPORTING SERVICE RECORDS ===\n');
        
        // Get all service records
        const serviceRecords = await pool.query(`
            SELECT * FROM case_service_records WHERE transaction_hash IS NOT NULL
        `);
        
        let imported = 0;
        
        for (const record of serviceRecords.rows) {
            // Parse recipients array
            let recipients = [];
            if (record.recipients) {
                if (typeof record.recipients === 'string') {
                    try {
                        recipients = JSON.parse(record.recipients);
                    } catch (e) {
                        recipients = [record.recipients];
                    }
                } else if (Array.isArray(record.recipients)) {
                    recipients = record.recipients;
                } else if (record.recipients.recipients) {
                    recipients = record.recipients.recipients;
                }
            }
            
            // Create a notice_component for each recipient
            for (const recipientAddress of recipients) {
                try {
                    await pool.query(`
                        INSERT INTO notice_components (
                            notice_id,
                            alert_id,
                            document_id,
                            alert_token_id,
                            document_token_id,
                            case_number,
                            recipient_address,
                            server_address,
                            notice_type,
                            issuing_agency,
                            transaction_hash,
                            ipfs_hash,
                            encryption_key,
                            page_count,
                            status,
                            created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                        ON CONFLICT DO NOTHING
                    `, [
                        `notice_${record.case_number}`,
                        `alert_${record.alert_token_id}`,
                        `doc_${record.document_token_id}`,
                        record.alert_token_id,
                        record.document_token_id,
                        record.case_number,
                        recipientAddress,
                        record.server_address,
                        'Legal Notice',
                        'Legal Services',
                        record.transaction_hash,
                        record.ipfs_hash,
                        record.encryption_key,
                        record.page_count || 1,
                        'served',
                        record.served_at || new Date()
                    ]);
                    
                    imported++;
                    console.log(`✅ Imported notice for ${recipientAddress} (Case ${record.case_number})`);
                    
                } catch (err) {
                    console.error(`Failed to import for ${recipientAddress}:`, err.message);
                }
            }
        }
        
        console.log(`\n✅ Successfully imported ${imported} notice records`);
        
        // Also check if we need notice_images data
        const imageCheck = await pool.query(`
            SELECT COUNT(*) FROM notice_images WHERE alert_image IS NOT NULL
        `);
        
        console.log(`\nFound ${imageCheck.rows[0].count} cases with alert images`);
        
    } catch (error) {
        console.error('Import error:', error);
    } finally {
        await pool.end();
    }
}

// Add specific recipient test data
async function addTestRecipient(walletAddress, caseNumber) {
    try {
        console.log(`Adding test data for wallet ${walletAddress}, case ${caseNumber}`);
        
        await pool.query(`
            INSERT INTO notice_components (
                notice_id,
                alert_id,
                document_id,
                alert_token_id,
                document_token_id,
                case_number,
                recipient_address,
                server_address,
                notice_type,
                issuing_agency,
                transaction_hash,
                status,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            ON CONFLICT DO NOTHING
        `, [
            `notice_test_${Date.now()}`,
            `alert_test_${Date.now()}`,
            `doc_test_${Date.now()}`,
            '999',
            '1000',
            caseNumber,
            walletAddress,
            'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
            'Test Notice',
            'Test Agency',
            '0x' + 'a'.repeat(64),
            'served'
        ]);
        
        console.log('✅ Test recipient added');
        
    } catch (error) {
        console.error('Error adding test recipient:', error);
    } finally {
        await pool.end();
    }
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--import')) {
    importServiceRecords();
} else if (args.includes('--test')) {
    const walletIndex = args.indexOf('--wallet');
    const caseIndex = args.indexOf('--case');
    
    if (walletIndex > -1 && caseIndex > -1) {
        const wallet = args[walletIndex + 1];
        const caseNum = args[caseIndex + 1];
        addTestRecipient(wallet, caseNum);
    } else {
        console.log('Usage: node fix-blockserved.js --test --wallet ADDRESS --case CASENUMBER');
    }
} else {
    checkRecipientData();
}