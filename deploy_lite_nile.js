/**
 * Deploy LegalNoticeNFT_Lite to TRON Nile Testnet
 *
 * Prerequisites:
 * 1. Get Nile testnet TRX from: https://nileex.io/join/getJoinPage
 * 2. Set your private key in .env file: NILE_PRIVATE_KEY=your_key
 *
 * Run: node deploy_lite_nile.js
 */

const TronWebModule = require('tronweb');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

// TronWeb v5/v6 compatibility
const TronWeb = TronWebModule.TronWeb || TronWebModule;

// Nile Testnet Configuration
const NILE_CONFIG = {
    fullHost: 'https://nile.trongrid.io',
    feeLimit: 500_000_000,  // 500 TRX limit
    userFeePercentage: 100,
    originEnergyLimit: 10_000_000,
    privateKey: process.env.NILE_PRIVATE_KEY || process.env.TRON_PRIVATE_KEY || process.env.PRIVATE_KEY
};

// Contract parameters
const SERVICE_FEE = 10_000_000; // 10 TRX in SUN

async function compileContract() {
    console.log('📄 Compiling LegalNoticeNFT_Lite.sol...\n');

    const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Lite.sol');

    if (!fs.existsSync(contractPath)) {
        throw new Error(`Contract not found at: ${contractPath}`);
    }

    // Create build directory
    const buildDir = path.join(__dirname, 'build', 'contracts');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
    }

    try {
        // Compile with solc
        const outputPath = path.join(buildDir, 'LegalNoticeNFT_Lite.json');

        // Use solcjs or system solc
        const cmd = `solc --optimize --optimize-runs 200 --combined-json abi,bin ${contractPath}`;
        console.log('Running:', cmd);

        const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        const compiled = JSON.parse(output);

        // Find the contract in output
        const contractKey = Object.keys(compiled.contracts).find(k => k.includes('LegalNoticeNFT_Lite'));

        if (!contractKey) {
            throw new Error('Contract not found in compiled output');
        }

        const contract = compiled.contracts[contractKey];

        const result = {
            abi: JSON.parse(contract.abi),
            bytecode: contract.bin
        };

        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log('✅ Compiled successfully!\n');

        return result;

    } catch (error) {
        console.error('Solc compilation failed:', error.message);
        console.log('\nTrying alternative compilation with tronbox...\n');

        // Try tronbox compile as fallback
        try {
            execSync('npx tronbox compile', { encoding: 'utf8', stdio: 'inherit' });

            // Read from tronbox build
            const tronboxBuild = path.join(__dirname, 'build', 'contracts', 'LegalNoticeNFT_Lite.json');
            if (fs.existsSync(tronboxBuild)) {
                const built = JSON.parse(fs.readFileSync(tronboxBuild, 'utf8'));
                return {
                    abi: built.abi,
                    bytecode: built.bytecode.replace('0x', '')
                };
            }
        } catch (e) {
            // Continue to manual input
        }

        console.log('\n⚠️  Automatic compilation failed.');
        console.log('Please compile manually using Remix or TronIDE:');
        console.log('1. Go to https://tronscan.org/#/tools/contract-compiler');
        console.log('2. Or use Remix: https://remix.ethereum.org');
        console.log('3. Compile LegalNoticeNFT_Lite.sol with Solidity 0.8.6, optimizer 200 runs');
        console.log('4. Save ABI to: build/contracts/LegalNoticeNFT_Lite.abi');
        console.log('5. Save Bytecode to: build/contracts/LegalNoticeNFT_Lite.bin');
        console.log('\nThen run this script again.\n');

        // Check for pre-compiled files
        const abiPath = path.join(buildDir, 'LegalNoticeNFT_Lite.abi');
        const binPath = path.join(buildDir, 'LegalNoticeNFT_Lite.bin');

        if (fs.existsSync(abiPath) && fs.existsSync(binPath)) {
            console.log('✅ Found pre-compiled files, using those...\n');
            return {
                abi: JSON.parse(fs.readFileSync(abiPath, 'utf8')),
                bytecode: fs.readFileSync(binPath, 'utf8').trim()
            };
        }

        throw new Error('Could not compile contract. Please compile manually.');
    }
}

async function deploy() {
    console.log('='.repeat(60));
    console.log('DEPLOY LegalNoticeNFT_Lite to NILE TESTNET');
    console.log('='.repeat(60) + '\n');

    // Check private key
    if (!NILE_CONFIG.privateKey) {
        console.error('❌ ERROR: No private key found!');
        console.error('   Set NILE_PRIVATE_KEY or PRIVATE_KEY in your .env file');
        console.error('\n   To get testnet TRX:');
        console.error('   1. Go to https://nileex.io/join/getJoinPage');
        console.error('   2. Enter your wallet address');
        console.error('   3. Request test TRX\n');
        process.exit(1);
    }

    // Initialize TronWeb
    const tronWeb = new TronWeb({
        fullHost: NILE_CONFIG.fullHost,
        privateKey: NILE_CONFIG.privateKey
    });

    const deployerAddress = tronWeb.address.fromPrivateKey(NILE_CONFIG.privateKey);
    console.log('Deployer Address:', deployerAddress);
    console.log('Network: Nile Testnet');
    console.log('Service Fee:', SERVICE_FEE / 1_000_000, 'TRX\n');

    // Check balance
    const balance = await tronWeb.trx.getBalance(deployerAddress);
    const balanceTRX = balance / 1_000_000;
    console.log('Balance:', balanceTRX, 'TRX');

    if (balanceTRX < 100) {
        console.error('\n❌ ERROR: Insufficient balance! Need at least 100 TRX');
        console.error('   Get testnet TRX from: https://nileex.io/join/getJoinPage\n');
        process.exit(1);
    }

    // Compile contract
    const { abi, bytecode } = await compileContract();

    console.log('ABI functions:', abi.filter(x => x.type === 'function').length);
    console.log('Bytecode size:', bytecode.length / 2, 'bytes\n');

    console.log('🚀 Deploying contract...\n');

    try {
        // Deploy
        const tx = await tronWeb.transactionBuilder.createSmartContract({
            abi: abi,
            bytecode: bytecode,
            feeLimit: NILE_CONFIG.feeLimit,
            callValue: 0,
            userFeePercentage: NILE_CONFIG.userFeePercentage,
            originEnergyLimit: NILE_CONFIG.originEnergyLimit,
            parameters: [SERVICE_FEE] // Constructor parameter
        }, deployerAddress);

        // Sign
        const signedTx = await tronWeb.trx.sign(tx);

        // Broadcast
        const result = await tronWeb.trx.sendRawTransaction(signedTx);

        if (result.result) {
            console.log('✅ Transaction broadcast successful!');
            console.log('   TX Hash:', result.txid);

            // Wait for confirmation
            console.log('\n⏳ Waiting for confirmation (30 seconds)...\n');
            await new Promise(resolve => setTimeout(resolve, 30000));

            // Get contract address
            const txInfo = await tronWeb.trx.getTransactionInfo(result.txid);

            if (txInfo.contract_address) {
                const contractAddress = tronWeb.address.fromHex(txInfo.contract_address);

                console.log('='.repeat(60));
                console.log('🎉 DEPLOYMENT SUCCESSFUL!');
                console.log('='.repeat(60));
                console.log('\nContract Address:', contractAddress);
                console.log('Contract (Hex):', txInfo.contract_address);
                console.log('TX Hash:', result.txid);
                console.log('Energy Used:', txInfo.receipt?.energy_usage_total || 'N/A');
                console.log('Network: Nile Testnet');
                console.log('\nView on TronScan:');
                console.log(`https://nile.tronscan.org/#/contract/${contractAddress}`);

                // Save deployment info
                const deploymentInfo = {
                    network: 'nile',
                    contractAddress: contractAddress,
                    contractAddressHex: txInfo.contract_address,
                    txHash: result.txid,
                    deployer: deployerAddress,
                    serviceFee: SERVICE_FEE,
                    deployedAt: new Date().toISOString(),
                    abi: abi
                };

                const deploymentPath = path.join(__dirname, 'deployments', 'lite_nile.json');
                fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
                fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
                console.log('\n✅ Deployment info saved to:', deploymentPath);

                // Next steps
                console.log('\n' + '='.repeat(60));
                console.log('NEXT STEPS:');
                console.log('='.repeat(60));
                console.log('1. Update your frontend config with the new contract address');
                console.log('2. Test serving a notice');
                console.log('3. Verify on TronScan (optional)');
                console.log('4. When ready, deploy to mainnet with: node deploy_lite_mainnet.js');

            } else {
                console.log('⚠️  Contract address not found yet. Check TX on TronScan:');
                console.log(`https://nile.tronscan.org/#/transaction/${result.txid}`);
            }

        } else {
            console.error('❌ Deployment failed:', result);
        }

    } catch (error) {
        console.error('❌ Deployment error:', error.message);
        if (error.message.includes('balance')) {
            console.error('\n   Get testnet TRX from: https://nileex.io/join/getJoinPage');
        }
        process.exit(1);
    }
}

deploy().catch(console.error);
