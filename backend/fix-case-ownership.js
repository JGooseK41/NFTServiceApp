/**
 * Fix case ownership - Link existing cases to server wallet
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function fixCaseOwnership() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@dpg-ctblpudds78s73ck5nkg-a.oregon-postgres.render.com/nftservice_db?sslmode=require',
        ssl: { rejectUnauthorized: false }
    });
    
    const DISK_PATH = '/var/data/cases';
    const SERVER_WALLET = process.env.SERVER_WALLET || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY';
    
    console.log(`\n=== FIXING CASE OWNERSHIP FOR ${SERVER_WALLET} ===\n`);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // Get list of case directories from disk
        let casesOnDisk = [];
        try {
            const dirs = await fs.readdir(DISK_PATH);
            for (const dir of dirs) {
                const pdfPath = path.join(DISK_PATH, dir, 'document.pdf');
                try {
                    await fs.access(pdfPath);
                    casesOnDisk.push(dir);
                    console.log(`Found case on disk: ${dir}`);
                } catch (e) {
                    // Not a valid case directory
                }
            }
        } catch (e) {
            console.log('Could not read disk directory:', e.message);
            // Use known cases as fallback
            casesOnDisk = ['34-2312-235579', '34-9633897', '34-4343902', '34-6805299'];
            console.log('Using known cases:', casesOnDisk);
        }
        
        console.log(`\nFound ${casesOnDisk.length} cases on disk\n`);
        
        // For each case on disk, ensure it has proper ownership
        for (const caseId of casesOnDisk) {
            console.log(`\nProcessing case: ${caseId}`);
            
            // Check if case exists in cases table
            const caseCheck = await client.query(
                'SELECT id, server_address FROM cases WHERE id = $1',
                [caseId]
            );
            
            if (caseCheck.rows.length > 0) {
                const currentServer = caseCheck.rows[0].server_address;
                if (currentServer !== SERVER_WALLET) {
                    // Update to correct server
                    await client.query(
                        'UPDATE cases SET server_address = $1 WHERE id = $2',
                        [SERVER_WALLET, caseId]
                    );
                    console.log(`  ✅ Updated cases table: ${currentServer} -> ${SERVER_WALLET}`);
                } else {
                    console.log(`  ✓ Already correctly owned in cases table`);
                }
            } else {
                // Insert into cases table
                await client.query(`
                    INSERT INTO cases (
                        id, 
                        server_address, 
                        status, 
                        created_at,
                        pdf_path
                    ) VALUES ($1, $2, $3, NOW(), $4)
                    ON CONFLICT (id) DO UPDATE 
                    SET server_address = $2
                `, [
                    caseId,
                    SERVER_WALLET,
                    'served',
                    path.join(DISK_PATH, caseId, 'document.pdf')
                ]);
                console.log(`  ✅ Added to cases table with server ${SERVER_WALLET}`);
            }
            
            // Also check case_service_records
            const serviceCheck = await client.query(
                'SELECT case_number, server_address FROM case_service_records WHERE case_number = $1',
                [caseId]
            );
            
            if (serviceCheck.rows.length > 0) {
                const currentServer = serviceCheck.rows[0].server_address;
                if (currentServer !== SERVER_WALLET) {
                    await client.query(
                        'UPDATE case_service_records SET server_address = $1 WHERE case_number = $2',
                        [SERVER_WALLET, caseId]
                    );
                    console.log(`  ✅ Updated case_service_records: ${currentServer} -> ${SERVER_WALLET}`);
                } else {
                    console.log(`  ✓ Already correctly owned in case_service_records`);
                }
            } else {
                // Insert into case_service_records
                await client.query(`
                    INSERT INTO case_service_records (
                        case_number,
                        server_address,
                        alert_token_id,
                        document_token_id,
                        created_at
                    ) VALUES ($1, $2, 0, 0, NOW())
                    ON CONFLICT (case_number) DO UPDATE 
                    SET server_address = $2
                `, [caseId, SERVER_WALLET]);
                console.log(`  ✅ Added to case_service_records with server ${SERVER_WALLET}`);
            }
        }
        
        // Final check - count cases for this server
        const finalCount = await client.query(
            'SELECT COUNT(*) as count FROM cases WHERE server_address = $1',
            [SERVER_WALLET]
        );
        
        const serviceCount = await client.query(
            'SELECT COUNT(*) as count FROM case_service_records WHERE server_address = $1',
            [SERVER_WALLET]
        );
        
        console.log('\n=== SUMMARY ===');
        console.log(`Cases table: ${finalCount.rows[0].count} cases for ${SERVER_WALLET}`);
        console.log(`Case service records: ${serviceCount.rows[0].count} records for ${SERVER_WALLET}`);
        console.log('\n✅ Case ownership fixed!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

// Run if called directly
if (require.main === module) {
    fixCaseOwnership();
}

module.exports = fixCaseOwnership;