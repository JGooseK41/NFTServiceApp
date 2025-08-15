/**
 * CHECK LAST ALERT
 * Finds and checks the most recent alert token
 */

console.log('🔍 CHECKING LAST ALERT TOKEN');
console.log('=' .repeat(70));

window.CheckLastAlert = {
    
    async findLastAlert() {
        console.log('\n📊 Finding the last alert token...\n');
        
        try {
            // Get your wallet address
            const wallet = window.tronWeb.defaultAddress.base58;
            console.log('Your wallet:', wallet);
            
            // Check localStorage for recent transactions
            const recentTx = localStorage.getItem('lastTransactionHash');
            if (recentTx) {
                console.log('Found recent transaction:', recentTx);
                await this.checkTransaction(recentTx);
            }
            
            // Check for alert IDs in DOM
            this.checkDOM();
            
            // Check recent served notices
            await this.checkBackendNotices();
            
        } catch (error) {
            console.error('Error:', error);
        }
    },
    
    async checkTransaction(txHash) {
        console.log('\n📝 Checking transaction:', txHash);
        
        try {
            const tx = await window.tronWeb.trx.getTransaction(txHash);
            
            if (tx && tx.ret && tx.ret[0].contractRet === 'SUCCESS') {
                console.log('✅ Transaction successful');
                
                // Look for token IDs in logs
                if (tx.log) {
                    tx.log.forEach(log => {
                        if (log.topics && log.topics.length >= 4) {
                            // Transfer event has tokenId as 4th topic
                            const tokenId = parseInt(log.topics[3], 16);
                            if (tokenId > 0 && tokenId % 2 === 1) { // Odd = Alert
                                console.log(`Found Alert Token #${tokenId}`);
                                this.checkAlertMetadata(tokenId, log.address);
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Transaction check error:', error);
        }
    },
    
    checkDOM() {
        console.log('\n🔍 Checking page for alert IDs...\n');
        
        // Look for alert IDs in the page
        const elements = document.querySelectorAll('*');
        const alertIds = new Set();
        
        elements.forEach(el => {
            const text = el.textContent || '';
            
            // Look for patterns like "Alert #27" or "Token 27"
            const matches = text.match(/(?:Alert|Token)\s*#?\s*(\d+)/gi);
            if (matches) {
                matches.forEach(match => {
                    const id = parseInt(match.replace(/\D/g, ''));
                    if (id > 0 && id % 2 === 1) { // Odd numbers are alerts
                        alertIds.add(id);
                    }
                });
            }
        });
        
        if (alertIds.size > 0) {
            const sorted = Array.from(alertIds).sort((a, b) => b - a);
            console.log('Found alert IDs in page:', sorted);
            console.log('Most recent alert:', sorted[0]);
            
            // Check the most recent one
            if (sorted[0] === 27) {
                console.log('\n🎯 Alert #27 is the most recent!');
            }
        } else {
            console.log('No alert IDs found in page');
        }
    },
    
    async checkBackendNotices() {
        console.log('\n💾 Checking backend for recent notices...\n');
        
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/cases', {
                headers: {
                    'X-Server-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const cases = data.cases || data;
                
                if (Array.isArray(cases) && cases.length > 0) {
                    // Get alert IDs
                    const alertIds = cases
                        .map(c => c.alert_id || c.alertId)
                        .filter(id => id && !isNaN(id))
                        .map(id => parseInt(id))
                        .sort((a, b) => b - a);
                    
                    if (alertIds.length > 0) {
                        console.log('Alert IDs from backend:', alertIds.slice(0, 5));
                        console.log('Most recent:', alertIds[0]);
                        
                        // Check if it's 27
                        if (alertIds.includes(27)) {
                            console.log('✅ Alert #27 found in backend!');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Backend check error:', error);
        }
    },
    
    async checkAlertMetadata(alertId, contractAddress) {
        console.log(`\n🔍 Checking metadata for Alert #${alertId}...`);
        
        try {
            // Try different contract addresses
            const contracts = [
                contractAddress,
                'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb',
                'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh'
            ].filter(Boolean);
            
            for (const addr of contracts) {
                try {
                    console.log(`Trying contract: ${addr}`);
                    
                    // Simple raw call
                    const functionSelector = 'tokenURI(uint256)';
                    const parameter = [
                        {type: 'uint256', value: alertId}
                    ];
                    
                    const transaction = await window.tronWeb.transactionBuilder.triggerConstantContract(
                        addr,
                        functionSelector,
                        {},
                        parameter
                    );
                    
                    if (transaction.result.result) {
                        const hex = transaction.constant_result[0];
                        // Decode the hex result
                        let uri = '';
                        try {
                            // Try to decode as string
                            const decoded = window.tronWeb.toUtf8(hex);
                            if (decoded && decoded.length > 0) {
                                uri = decoded;
                            }
                        } catch (e) {
                            // Try alternate decoding
                            uri = window.tronWeb.utils.abi.decodeParams(['string'], hex)[0];
                        }
                        
                        if (uri) {
                            console.log(`\n✅ Found tokenURI for Alert #${alertId}!`);
                            console.log('Contract:', addr);
                            
                            // Analyze the URI
                            if (uri.startsWith('data:application/json;base64,')) {
                                console.log('📊 Format: BASE64 ✅');
                                console.log('This alert will display properly!');
                                
                                // Decode and show details
                                const base64 = uri.split(',')[1];
                                const json = atob(base64);
                                const metadata = JSON.parse(json);
                                console.log('Name:', metadata.name);
                                console.log('Image type:', metadata.image?.startsWith('data:image') ? 'BASE64 ✅' : 'External ⚠️');
                                
                            } else if (uri.includes('ipfs')) {
                                console.log('📊 Format: IPFS ❌');
                                console.log('This alert needs to be converted to BASE64!');
                                console.log('IPFS URI:', uri);
                            }
                            
                            return uri;
                        }
                    }
                } catch (e) {
                    // Try next contract
                }
            }
            
            console.log(`Could not fetch metadata for Alert #${alertId}`);
            
        } catch (error) {
            console.error('Metadata check error:', error);
        }
    },
    
    async run() {
        console.log('🚀 Starting search for last alert...\n');
        
        await this.findLastAlert();
        
        // Specifically check #27
        console.log('\n' + '=' .repeat(70));
        console.log('📍 SPECIFICALLY CHECKING ALERT #27:');
        await this.checkAlertMetadata(27);
        
        console.log('\n' + '=' .repeat(70));
        console.log('✅ Check complete!');
    }
};

// Run automatically
CheckLastAlert.run();

console.log('\n📚 Commands:');
console.log('CheckLastAlert.run() - Full check');
console.log('CheckLastAlert.checkAlertMetadata(27) - Check specific alert');
console.log('CheckLastAlert.findLastAlert() - Find most recent');