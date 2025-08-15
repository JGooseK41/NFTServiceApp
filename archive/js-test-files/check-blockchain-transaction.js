/**
 * Check Blockchain Transaction
 * See what was actually sent to the blockchain
 */

async function checkBlockchainTransaction() {
    console.log('\n🔍 CHECKING BLOCKCHAIN TRANSACTIONS');
    console.log('=' .repeat(60));
    
    if (!window.tronWeb) {
        console.error('TronWeb not initialized');
        return;
    }
    
    // Get your wallet transactions
    const yourWallet = window.tronWeb.defaultAddress.base58;
    console.log('Your wallet:', yourWallet);
    console.log('');
    
    try {
        // Get recent transactions
        console.log('Fetching recent transactions...\n');
        
        const transactions = await tronWeb.trx.getTransactionsRelated(yourWallet, 'all', 30, 0);
        
        // Filter for contract interactions
        const contractTxs = transactions.filter(tx => 
            tx.raw_data && 
            tx.raw_data.contract && 
            tx.raw_data.contract[0].type === 'TriggerSmartContract'
        );
        
        console.log(`Found ${contractTxs.length} smart contract transactions\n`);
        
        // Look for serveNotice transactions
        for (const tx of contractTxs.slice(0, 10)) { // Check last 10
            const contract = tx.raw_data.contract[0];
            const params = contract.parameter.value;
            
            if (params.contract_address === window.CONTRACT_ADDRESS?.substring(2).toLowerCase()) {
                console.log('📝 Transaction:', tx.txID);
                console.log('   Timestamp:', new Date(tx.raw_data.timestamp).toLocaleString());
                
                // Decode the function call
                const functionSelector = params.function_selector;
                console.log('   Function:', functionSelector);
                
                // Get transaction info for more details
                const txInfo = await tronWeb.trx.getTransactionInfo(tx.txID);
                
                if (txInfo.receipt) {
                    console.log('   Status:', txInfo.receipt.result || 'SUCCESS');
                    console.log('   Energy Used:', txInfo.receipt.energy_usage);
                    console.log('   Fee:', (txInfo.fee / 1000000) + ' TRX');
                }
                
                // Check if this is a serveNotice call
                if (functionSelector && functionSelector.includes('serve')) {
                    console.log('\n   ⚠️ This is a serve notice transaction!');
                    
                    // The data field contains the encoded parameters
                    if (params.data) {
                        const dataSize = params.data.length / 2; // Convert hex to bytes
                        console.log('   Data size:', dataSize, 'bytes');
                        console.log('   Data size (KB):', (dataSize / 1024).toFixed(2), 'KB');
                        
                        // Check if data is truncated (blockchain has max size)
                        if (dataSize < 300000) { // Less than 300KB
                            console.log('   ⚠️ Data seems small for a 47-page document!');
                        }
                        
                        // Show first part of data
                        console.log('   Data preview:', params.data.substring(0, 200) + '...');
                    }
                    
                    // Check events
                    if (txInfo.log) {
                        console.log('\n   Events emitted:');
                        for (const log of txInfo.log) {
                            if (log.topics && log.topics[0]) {
                                // Decode event signature
                                const eventSig = log.topics[0];
                                console.log('   - Event signature:', eventSig);
                                
                                // Try to decode NFT token IDs from events
                                if (log.topics.length > 1) {
                                    for (let i = 1; i < log.topics.length; i++) {
                                        const value = parseInt(log.topics[i], 16);
                                        if (value > 0 && value < 1000000000) {
                                            console.log(`     Token ID: ${value}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                console.log('-'.repeat(40));
            }
        }
        
        // Now check what's stored in the contract for specific tokens
        console.log('\n📦 CHECKING ON-CHAIN STORAGE:');
        console.log('-'.repeat(40));
        
        // Try some token IDs that might exist
        const tokenIdsToCheck = [1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15];
        
        for (const tokenId of tokenIdsToCheck) {
            try {
                // Check if token exists
                const uri = await window.legalContract.tokenURI(tokenId).call();
                
                console.log(`\nToken #${tokenId} EXISTS`);
                
                // Check the URI format
                if (uri.startsWith('data:')) {
                    // On-chain storage
                    console.log('  Storage: ON-CHAIN');
                    console.log('  URI Size:', (uri.length / 1024).toFixed(2), 'KB');
                    
                    // Decode and check content
                    const [header, data] = uri.split(',');
                    if (header.includes('base64')) {
                        const decoded = atob(data);
                        const metadata = JSON.parse(decoded);
                        
                        if (metadata.image) {
                            console.log('  Image Size:', (metadata.image.length / 1024).toFixed(2), 'KB');
                        }
                        if (metadata.document_data) {
                            console.log('  Document Size:', (metadata.document_data.length / 1024).toFixed(2), 'KB');
                            
                            // Check if it's truncated
                            const estimatedPages = Math.round(metadata.document_data.length * 0.75 / 1024 / 50);
                            console.log('  Estimated Pages:', estimatedPages);
                            
                            if (estimatedPages < 47) {
                                console.log('  ⚠️ Document appears TRUNCATED!');
                            }
                        }
                    }
                } else if (uri.startsWith('ipfs://')) {
                    // IPFS storage
                    const ipfsHash = uri.replace('ipfs://', '');
                    console.log('  Storage: IPFS');
                    console.log('  IPFS Hash:', ipfsHash);
                    console.log('  Gateway URL:', `https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
                } else {
                    console.log('  Storage: Unknown format');
                    console.log('  URI:', uri.substring(0, 100));
                }
                
            } catch (e) {
                // Token doesn't exist, continue
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TRANSACTION CHECK COMPLETE');
    console.log('='.repeat(60));
}

// Run the check
window.checkBlockchainTx = checkBlockchainTransaction;

console.log('🔍 Blockchain Transaction Checker Loaded!');
console.log('Run: checkBlockchainTx() to check your transactions');