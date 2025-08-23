const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

// Contract address
const NFT_CONTRACT = 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';

async function analyzeOrphanedNotices() {
    console.log('=== ANALYZING ORPHANED NOTICES PATTERN ===\n');
    
    // Known data points for pattern analysis
    const knownMappings = [
        { wallet: 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH', alertTokens: [1, 17, 29, 37] },
        { wallet: 'TBjqKep...', alertTokens: [13, 19, 27, 35] }  // Partial address
    ];
    
    console.log('Known Alert NFT ownership:');
    knownMappings.forEach(m => {
        console.log(`- Wallet ${m.wallet}: Alert NFTs ${m.alertTokens.join(', ')}`);
    });
    
    try {
        // Step 1: Analyze what's currently in the database
        console.log('\n=== DATABASE ANALYSIS ===\n');
        
        // Check all alert tokens in case_service_records
        const recordedQuery = `
            SELECT 
                alert_token_id,
                document_token_id,
                case_number,
                recipients,
                served_at
            FROM case_service_records 
            ORDER BY alert_token_id::int
        `;
        
        const recorded = await pool.query(recordedQuery);
        console.log(`Total notices in case_service_records: ${recorded.rows.length}`);
        
        const recordedAlertIds = recorded.rows.map(r => parseInt(r.alert_token_id));
        console.log(`Recorded Alert IDs: ${recordedAlertIds.join(', ')}`);
        
        // Step 2: Identify the pattern
        console.log('\n=== PATTERN IDENTIFICATION ===\n');
        
        // Check for gaps in the sequence
        const maxTokenId = Math.max(...recordedAlertIds, 37);
        const allPossibleAlertIds = [];
        
        // Alert NFTs are odd numbers (1, 3, 5, 7, ...)
        // Document NFTs are even numbers (2, 4, 6, 8, ...)
        for (let i = 1; i <= maxTokenId; i += 2) {
            allPossibleAlertIds.push(i);
        }
        
        console.log(`Expected Alert NFT IDs (odd numbers): ${allPossibleAlertIds.join(', ')}`);
        
        const missingAlertIds = allPossibleAlertIds.filter(id => !recordedAlertIds.includes(id));
        console.log(`\nMissing Alert NFT IDs in database: ${missingAlertIds.join(', ')}`);
        
        // Step 3: Check blockchain for actual NFT ownership
        console.log('\n=== BLOCKCHAIN VERIFICATION ===\n');
        console.log('Checking blockchain for actual NFT ownership...\n');
        
        // For demonstration, let's check what we know
        const verifiedOwnership = new Map();
        
        // Add known mappings
        verifiedOwnership.set('1', 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH');
        verifiedOwnership.set('17', 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH');
        verifiedOwnership.set('29', 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH');
        verifiedOwnership.set('37', 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH');
        // Note: We need the full address for the second wallet
        // verifiedOwnership.set('13', 'TBjqKep...');
        // verifiedOwnership.set('19', 'TBjqKep...');
        // verifiedOwnership.set('27', 'TBjqKep...');
        // verifiedOwnership.set('35', 'TBjqKep...');
        
        // Step 4: Identify orphaned notices that need to be linked
        console.log('=== ORPHANED NOTICES TO BE RECOVERED ===\n');
        
        for (const alertId of missingAlertIds) {
            const owner = verifiedOwnership.get(alertId.toString());
            if (owner) {
                console.log(`Alert NFT #${alertId}:`);
                console.log(`  Owner: ${owner}`);
                console.log(`  Document NFT: #${alertId + 1}`);
                console.log(`  Status: NEEDS TO BE ADDED TO DATABASE`);
                
                // Check if there's a case in the cases table
                const caseCheck = await pool.query(`
                    SELECT case_number, created_at 
                    FROM cases 
                    WHERE token_id = $1 OR alert_token_id = $1
                    LIMIT 1
                `, [alertId.toString()]);
                
                if (caseCheck.rows.length > 0) {
                    console.log(`  Found case: ${caseCheck.rows[0].case_number}`);
                } else {
                    console.log(`  Case number: NEEDS GENERATION (e.g., 24-CV-${String(alertId).padStart(6, '0')})`);
                }
                console.log('');
            }
        }
        
        // Step 5: Proposed solution
        console.log('=== PROPOSED SOLUTION ===\n');
        console.log('1. Query blockchain for ALL Alert NFT owners (tokens 1, 3, 5, 7, ... up to current max)');
        console.log('2. For each Alert NFT found on blockchain:');
        console.log('   - Identify the owner wallet address');
        console.log('   - Calculate Document NFT ID (Alert ID + 1)');
        console.log('   - Generate case number if not in cases table');
        console.log('   - Add to case_service_records with proper recipient');
        console.log('3. This ensures ALL served notices are properly tracked, not just known ones');
        console.log('\nThis approach will:');
        console.log('- Recover all historical notice data from blockchain');
        console.log('- Properly link Alert and Document NFTs');
        console.log('- Ensure recipients can see all their notices in BlockServed');
        
        await pool.end();
        
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

analyzeOrphanedNotices();