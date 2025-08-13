/**
 * Blockchain Diagnostics Tool
 * Check what data was actually sent to the blockchain
 */

class BlockchainDiagnostics {
    constructor() {
        this.contractAddress = window.CONTRACT_ADDRESS || 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';
    }

    /**
     * Check a specific token's metadata
     */
    async checkTokenMetadata(tokenId) {
        console.log(`\n🔍 Checking Token #${tokenId} Metadata\n${'='.repeat(50)}`);
        
        try {
            const contract = window.legalContract;
            if (!contract) {
                throw new Error('Contract not initialized');
            }

            // 1. Get Token URI
            console.log('1. Getting Token URI...');
            const tokenURI = await contract.tokenURI(tokenId).call();
            console.log('   Token URI:', tokenURI);
            
            // 2. Check if it's an alert or document
            const isEven = tokenId % 2 === 0;
            console.log(`   Token Type: ${isEven ? 'DOCUMENT' : 'ALERT'}`);
            
            // 3. Get the raw data from contract
            if (!isEven) { // Alert (odd token IDs)
                console.log('\n2. Getting Alert Data from Contract...');
                const alertData = await contract.alerts(tokenId).call();
                console.log('   Server (hex):', alertData[0]);
                console.log('   Server (address):', tronWeb.address.fromHex(alertData[0]));
                console.log('   Recipient (hex):', alertData[1]);
                console.log('   Recipient (address):', tronWeb.address.fromHex(alertData[1]));
                console.log('   Alert URI:', alertData[2]);
                console.log('   Description:', alertData[3]);
                console.log('   Thumbnail:', alertData[4]);
                console.log('   Jurisdiction:', alertData[5]);
                console.log('   Timestamp:', new Date(parseInt(alertData[6]) * 1000).toLocaleString());
                console.log('   Delivered:', alertData[7]);
            } else { // Document (even token IDs)
                console.log('\n2. Getting Document Data from Contract...');
                const docData = await contract.documents(tokenId).call();
                console.log('   Server (hex):', docData[0]);
                console.log('   Server (address):', tronWeb.address.fromHex(docData[0]));
                console.log('   Recipient (hex):', docData[1]);
                console.log('   Recipient (address):', tronWeb.address.fromHex(docData[1]));
                console.log('   Document URI:', docData[2]);
                console.log('   Description:', docData[3]);
                console.log('   Page Count:', docData[4].toString());
                console.log('   Document Hash:', docData[5]);
                console.log('   Timestamp:', new Date(parseInt(docData[6]) * 1000).toLocaleString());
                console.log('   Signed:', docData[7]);
                console.log('   Signature Hash:', docData[8]);
            }
            
            // 4. Parse the URI if it's a data URI or IPFS
            console.log('\n3. Analyzing URI Content...');
            if (tokenURI.startsWith('data:')) {
                // It's a data URI
                const [header, data] = tokenURI.split(',');
                console.log('   URI Type: Data URI');
                console.log('   Header:', header);
                
                if (header.includes('base64')) {
                    try {
                        const decoded = atob(data);
                        const metadata = JSON.parse(decoded);
                        console.log('\n   Decoded Metadata:');
                        console.log('   - Name:', metadata.name);
                        console.log('   - Description:', metadata.description?.substring(0, 100) + '...');
                        console.log('   - Image:', metadata.image?.substring(0, 100) + '...');
                        console.log('   - External URL:', metadata.external_url);
                        console.log('   - Attributes:', metadata.attributes);
                        
                        // Check image format
                        if (metadata.image) {
                            console.log('\n4. Checking Image Format...');
                            if (metadata.image.startsWith('data:image')) {
                                console.log('   ✅ Image is embedded as data URI');
                                const imageHeader = metadata.image.split(',')[0];
                                console.log('   Image format:', imageHeader);
                                
                                // Calculate image size
                                const imageData = metadata.image.split(',')[1];
                                const sizeInBytes = atob(imageData).length;
                                console.log('   Image size:', (sizeInBytes / 1024).toFixed(2), 'KB');
                            } else if (metadata.image.startsWith('ipfs://')) {
                                console.log('   📦 Image stored on IPFS:', metadata.image);
                            } else if (metadata.image.startsWith('http')) {
                                console.log('   🔗 Image URL:', metadata.image);
                            } else {
                                console.log('   ⚠️ Unknown image format');
                            }
                        }
                        
                        // Check for document data
                        if (metadata.document_data) {
                            console.log('\n5. Checking Document Data...');
                            console.log('   Document data length:', metadata.document_data.length, 'characters');
                            
                            // Estimate page count from base64 size
                            const docSizeKB = (metadata.document_data.length * 0.75) / 1024;
                            console.log('   Estimated document size:', docSizeKB.toFixed(2), 'KB');
                            console.log('   Estimated pages (at ~50KB/page):', Math.round(docSizeKB / 50));
                        }
                        
                    } catch (e) {
                        console.error('   Failed to parse metadata:', e);
                    }
                } else {
                    console.log('   Not base64 encoded');
                }
            } else if (tokenURI.startsWith('ipfs://')) {
                console.log('   URI Type: IPFS');
                console.log('   IPFS Hash:', tokenURI.replace('ipfs://', ''));
                console.log('   Gateway URL:', tokenURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'));
            } else if (tokenURI.startsWith('http')) {
                console.log('   URI Type: HTTP URL');
                console.log('   URL:', tokenURI);
            } else {
                console.log('   URI Type: Unknown format');
            }
            
            // 5. Check wallet compatibility
            console.log('\n6. Wallet Compatibility Check...');
            console.log('   TronLink expects:');
            console.log('   - tokenURI() returns valid JSON metadata');
            console.log('   - Metadata should have: name, description, image');
            console.log('   - Image should be accessible (data URI, IPFS, or HTTP)');
            
            if (tokenURI.startsWith('data:application/json')) {
                console.log('   ✅ Format is compatible with TronLink');
            } else {
                console.log('   ⚠️ May have compatibility issues with TronLink');
            }
            
        } catch (error) {
            console.error('Error checking token:', error);
        }
    }

    /**
     * Check transaction details
     */
    async checkTransaction(txHash) {
        console.log(`\n🔍 Checking Transaction ${txHash}\n${'='.repeat(50)}`);
        
        try {
            const tx = await tronWeb.trx.getTransaction(txHash);
            console.log('Transaction found:', tx);
            
            const info = await tronWeb.trx.getTransactionInfo(txHash);
            console.log('Transaction info:', info);
            
            // Decode the contract call
            if (tx.raw_data && tx.raw_data.contract) {
                const contract = tx.raw_data.contract[0];
                console.log('\nContract Call:');
                console.log('  Type:', contract.type);
                
                if (contract.parameter && contract.parameter.value) {
                    console.log('  Method:', contract.parameter.value.function_selector);
                    console.log('  Data length:', contract.parameter.value.data?.length || 0);
                }
            }
            
            // Check events
            if (info.log) {
                console.log('\nEvents emitted:');
                info.log.forEach((log, i) => {
                    console.log(`  Event ${i + 1}:`, log);
                });
            }
            
        } catch (error) {
            console.error('Error checking transaction:', error);
        }
    }

    /**
     * Check backend data for comparison
     */
    async checkBackendData(tokenId) {
        console.log(`\n🔍 Checking Backend Data for Token #${tokenId}\n${'='.repeat(50)}`);
        
        try {
            const backend = window.BACKEND_API_URL || 'https://nftserviceapp.onrender.com';
            
            // Check notice_components
            const response = await fetch(`${backend}/api/notices/by-token/${tokenId}`);
            if (response.ok) {
                const data = await response.json();
                console.log('Backend data found:', data);
                
                if (data.alert_thumbnail_data) {
                    console.log('Alert thumbnail size:', (data.alert_thumbnail_data.length / 1024).toFixed(2), 'KB');
                }
                
                if (data.document_data) {
                    console.log('Document data size:', (data.document_data.length / 1024).toFixed(2), 'KB');
                    
                    // Estimate page count
                    const estimatedPages = Math.round((data.document_data.length * 0.75) / 1024 / 50);
                    console.log('Estimated pages:', estimatedPages);
                }
            } else {
                console.log('No backend data found');
            }
        } catch (error) {
            console.error('Error checking backend:', error);
        }
    }

    /**
     * Run full diagnostics on a token
     */
    async runFullDiagnostics(tokenId) {
        console.log('\n' + '='.repeat(60));
        console.log(`FULL DIAGNOSTICS FOR TOKEN #${tokenId}`);
        console.log('='.repeat(60));
        
        await this.checkTokenMetadata(tokenId);
        await this.checkBackendData(tokenId);
        
        console.log('\n' + '='.repeat(60));
        console.log('DIAGNOSTICS COMPLETE');
        console.log('='.repeat(60));
    }
}

// Initialize and expose globally
window.diagnostics = new BlockchainDiagnostics();

// Add helper function for easy access
window.checkToken = async (tokenId) => {
    await window.diagnostics.runFullDiagnostics(tokenId);
};

window.checkTx = async (txHash) => {
    await window.diagnostics.checkTransaction(txHash);
};

console.log('🩺 Blockchain Diagnostics Loaded!');
console.log('Usage:');
console.log('  checkToken(943220201)  - Check alert token');
console.log('  checkToken(943220202)  - Check document token');
console.log('  checkTx("0x...")       - Check transaction');