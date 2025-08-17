/**
 * Fetch Contract ABI from TronGrid
 * Gets the actual ABI from the deployed contract
 */

const axios = require('axios');

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN'; // V5 Mainnet

async function fetchContractABI() {
    try {
        console.log('🔍 Fetching contract information from TronGrid...');
        console.log(`Contract: ${CONTRACT_ADDRESS}`);
        
        // TronGrid API endpoint for contract info
        const url = `https://api.trongrid.io/v1/contracts/${CONTRACT_ADDRESS}`;
        
        const response = await axios.get(url, {
            headers: {
                'accept': 'application/json'
            }
        });
        
        if (response.data && response.data.data) {
            const contractData = response.data.data[0];
            
            console.log('\n📋 Contract Details:');
            console.log('Name:', contractData.name || 'Unknown');
            console.log('Compiler Version:', contractData.compiler_version || 'Unknown');
            console.log('Optimization:', contractData.optimization || false);
            console.log('Runs:', contractData.runs || 0);
            
            if (contractData.abi && contractData.abi.entrys) {
                console.log('\n✅ ABI Found! Saving to contract-abi.json...');
                
                // Format the ABI nicely
                const abi = contractData.abi.entrys;
                
                // Save to file
                const fs = require('fs');
                fs.writeFileSync(
                    'contract-abi.json', 
                    JSON.stringify(abi, null, 2)
                );
                
                console.log(`\n📊 ABI Summary:`);
                console.log(`Total Functions: ${abi.length}`);
                
                // Group by type
                const functions = abi.filter(item => item.type === 'Function');
                const events = abi.filter(item => item.type === 'Event');
                const constructors = abi.filter(item => item.type === 'Constructor');
                
                console.log(`- Functions: ${functions.length}`);
                console.log(`- Events: ${events.length}`);
                console.log(`- Constructor: ${constructors.length}`);
                
                // List all function names
                console.log('\n📝 Available Functions:');
                functions.forEach(func => {
                    const isView = func.stateMutability === 'View' || func.stateMutability === 'Pure';
                    const isPayable = func.stateMutability === 'Payable';
                    const tag = isView ? '[VIEW]' : isPayable ? '[PAYABLE]' : '[WRITE]';
                    console.log(`  ${tag} ${func.name}`);
                });
                
                // List all events
                if (events.length > 0) {
                    console.log('\n📢 Events:');
                    events.forEach(event => {
                        console.log(`  - ${event.name}`);
                    });
                }
                
                return abi;
                
            } else {
                console.log('\n⚠️ No ABI found in contract data');
                console.log('Contract may not be verified on TronGrid');
                
                // Try alternative method - fetch from blockchain directly
                console.log('\n🔄 Trying alternative method...');
                return await fetchContractABIAlternative();
            }
        }
        
    } catch (error) {
        console.error('❌ Error fetching contract ABI:', error.message);
        
        // Try alternative method
        console.log('\n🔄 Trying alternative method...');
        return await fetchContractABIAlternative();
    }
}

async function fetchContractABIAlternative() {
    try {
        // Get contract code
        const url = `https://api.trongrid.io/wallet/getcontract`;
        
        const response = await axios.post(url, {
            value: CONTRACT_ADDRESS,
            visible: true
        }, {
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            }
        });
        
        if (response.data && response.data.abi) {
            console.log('\n✅ ABI Found via alternative method!');
            
            const abi = response.data.abi.entrys || response.data.abi;
            
            // Save to file
            const fs = require('fs');
            fs.writeFileSync(
                'contract-abi-alt.json', 
                JSON.stringify(abi, null, 2)
            );
            
            console.log('Saved to contract-abi-alt.json');
            
            // List function names
            if (Array.isArray(abi)) {
                console.log('\n📝 Functions found:');
                abi.forEach(item => {
                    if (item.type === 'Function' || item.type === 'function') {
                        console.log(`  - ${item.name}`);
                    }
                });
            }
            
            return abi;
        } else {
            console.log('❌ No ABI found via alternative method');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Alternative method failed:', error.message);
        return null;
    }
}

// Run the script
fetchContractABI().then(abi => {
    if (abi) {
        console.log('\n✅ ABI successfully fetched!');
        console.log('You can now use the complete ABI from contract-abi.json');
    } else {
        console.log('\n❌ Could not fetch ABI from blockchain');
        console.log('The contract may not be verified or may need manual ABI definition');
    }
}).catch(error => {
    console.error('Fatal error:', error);
});