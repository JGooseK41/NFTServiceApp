/**
 * DEBUG NFT METADATA
 * Figure out why only first NFT shows metadata
 */

console.log('🔍 Loading NFT metadata debugger...');

window.NFTMetadataDebugger = {
    
    // Check specific token's metadata
    async checkToken(tokenId) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Checking Token #${tokenId}`);
        console.log('='.repeat(60));
        
        try {
            if (!window.legalContract) {
                console.error('❌ Contract not loaded');
                return;
            }
            
            // Get token URI
            const uri = await window.legalContract.tokenURI(tokenId).call();
            console.log('Token URI:', uri || '(empty)');
            
            if (!uri) {
                console.log('❌ No metadata URI set for this token');
                return;
            }
            
            // Parse metadata
            if (uri.startsWith('ipfs://')) {
                const httpUrl = uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
                console.log('IPFS URL:', httpUrl);
                
                try {
                    const response = await fetch(httpUrl);
                    const metadata = await response.json();
                    console.log('✅ Metadata content:', metadata);
                } catch (e) {
                    console.error('Failed to fetch IPFS metadata:', e);
                }
                
            } else if (uri.startsWith('data:application/json')) {
                const base64 = uri.split(',')[1];
                const metadata = JSON.parse(atob(base64));
                console.log('✅ Metadata content (data URI):', metadata);
                
            } else {
                console.log('Unknown URI format:', uri);
            }
            
            // Check owner
            const owner = await window.legalContract.ownerOf(tokenId).call();
            console.log('Owner:', owner);
            
            // Check token type
            const tokenType = await window.legalContract.tokenTypes(tokenId).call();
            console.log('Token Type:', tokenType === 0 ? 'Alert' : 'Document');
            
        } catch (error) {
            console.error('Error checking token:', error);
        }
    },
    
    // Check multiple tokens
    async checkRange(start, end) {
        console.log(`\nChecking tokens ${start} to ${end}...`);
        
        for (let i = start; i <= end; i++) {
            await this.checkToken(i);
        }
    },
    
    // Check last transaction's tokens
    async checkLastTransaction() {
        console.log('\n🔍 Checking last transaction tokens...');
        
        // Get transaction data from storage
        const txData = sessionStorage.getItem('lastTransactionResult');
        if (txData) {
            const parsed = JSON.parse(txData);
            console.log('Last transaction:', parsed);
            
            if (parsed.alertId) {
                await this.checkToken(parsed.alertId);
            }
            if (parsed.documentId) {
                await this.checkToken(parsed.documentId);
            }
        } else {
            console.log('No recent transaction data found');
        }
    },
    
    // Monitor next transaction
    monitorNextTransaction() {
        console.log('📹 Monitoring next transaction for metadata...');
        
        // Hook into contract calls
        if (window.legalContract && window.legalContract.serveNotice) {
            const original = window.legalContract.serveNotice;
            
            window.legalContract.serveNotice = function(...args) {
                console.log('🎯 Transaction starting with args:', args);
                
                // Check metadata URI
                const metadataURI = args[9]; // 10th parameter
                console.log('Metadata URI being sent:', metadataURI);
                
                if (!metadataURI || metadataURI.length === 0) {
                    console.error('⚠️ WARNING: No metadata URI provided!');
                }
                
                const result = original.apply(this, args);
                const originalSend = result.send;
                
                result.send = async function(options) {
                    console.log('Send options:', options);
                    const txResult = await originalSend.call(this, options);
                    
                    console.log('Transaction result:', txResult);
                    
                    // Store for checking
                    sessionStorage.setItem('lastTransactionResult', JSON.stringify({
                        txId: txResult,
                        args: args,
                        metadataURI: metadataURI
                    }));
                    
                    return txResult;
                };
                
                return result;
            };
            
            console.log('✅ Transaction monitoring active');
        }
    },
    
    // Compare working vs non-working tokens
    async compareTokens(workingId, brokenId) {
        console.log('\n📊 COMPARING TOKENS');
        console.log('='.repeat(60));
        
        console.log('WORKING Token #' + workingId + ':');
        const workingURI = await window.legalContract.tokenURI(workingId).call();
        console.log('  URI:', workingURI ? '✅ Has URI' : '❌ No URI');
        console.log('  Length:', workingURI?.length || 0);
        
        console.log('\nBROKEN Token #' + brokenId + ':');  
        const brokenURI = await window.legalContract.tokenURI(brokenId).call();
        console.log('  URI:', brokenURI ? '✅ Has URI' : '❌ No URI');
        console.log('  Length:', brokenURI?.length || 0);
        
        if (workingURI && !brokenURI) {
            console.log('\n❌ PROBLEM: Broken token has no metadata URI!');
            console.log('This means the metadata is not being set during minting.');
        }
        
        // Check if it's an Alert vs Document issue
        const workingType = await window.legalContract.tokenTypes(workingId).call();
        const brokenType = await window.legalContract.tokenTypes(brokenId).call();
        
        console.log('\nToken Types:');
        console.log('  Working:', workingType === 0 ? 'Alert' : 'Document');
        console.log('  Broken:', brokenType === 0 ? 'Alert' : 'Document');
        
        if (workingType === 0 && brokenType === 1) {
            console.log('\n💡 Pattern: Alert NFTs have metadata, Document NFTs don\'t');
            console.log('The contract only sets metadata for Alert tokens!');
        }
    }
};

// Auto-monitor
NFTMetadataDebugger.monitorNextTransaction();

console.log('✅ NFT Metadata Debugger loaded');
console.log('');
console.log('Commands:');
console.log('  NFTMetadataDebugger.checkToken(1)     - Check specific token');
console.log('  NFTMetadataDebugger.checkRange(1, 10) - Check token range');
console.log('  NFTMetadataDebugger.compareTokens(1, 2) - Compare working vs broken');
console.log('  NFTMetadataDebugger.checkLastTransaction() - Check last tx tokens');