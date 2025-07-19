const { TronWeb } = require('tronweb');
const fs = require('fs');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

async function verifyContract() {
    const contractAddress = 'TXtSpuVBTnsvCwuqDYXtiZXTpgSXZSb2Bd';
    
    console.log('Verifying contract at:', contractAddress);
    console.log('===============================================\n');
    
    // Test with each ABI
    const tests = [
        {
            name: 'LegalNoticeNFT_Complete',
            abiPath: './contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi',
            tests: [
                { function: 'SERVICE_FEE', args: [], type: 'call' },
                { function: 'serviceFee', args: [], type: 'call' },
                { function: 'creationFee', args: [], type: 'call' },
                { function: 'feeCollector', args: [], type: 'call' },
                { function: 'calculateFee', args: ['TDbeaZQ25WzZ4Aqn4RJAZxmo6BeHdMeXGf'], type: 'call' }
            ]
        },
        {
            name: 'LegalNoticeNFT_Deploy',
            abiPath: './LegalNoticeNFT_Deploy_ABI.json',
            tests: [
                { function: 'SERVICE_FEE', args: [], type: 'call' },
                { function: 'calculateFee', args: ['TDbeaZQ25WzZ4Aqn4RJAZxmo6BeHdMeXGf'], type: 'call' }
            ]
        }
    ];
    
    for (const test of tests) {
        console.log(`Testing with ${test.name} ABI:`);
        console.log('-'.repeat(40));
        
        try {
            const abi = JSON.parse(fs.readFileSync(test.abiPath, 'utf8'));
            const contract = await tronWeb.contract(abi, contractAddress);
            
            let allPassed = true;
            
            for (const func of test.tests) {
                try {
                    const result = await contract[func.function](...func.args).call();
                    console.log(`✓ ${func.function}() works`);
                    if (func.function.includes('Fee') || func.function.includes('FEE')) {
                        console.log(`  Value: ${tronWeb.fromSun(result)} TRX`);
                    }
                } catch (e) {
                    console.log(`✗ ${func.function}() failed:`, e.message.split('\n')[0]);
                    allPassed = false;
                }
            }
            
            if (allPassed) {
                console.log(`\n>>> MATCH: This is ${test.name}! <<<\n`);
            }
            
        } catch (e) {
            console.log(`Failed to load ABI: ${e.message}`);
        }
        console.log();
    }
}

verifyContract();