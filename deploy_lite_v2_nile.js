/**
 * Deploy LegalNoticeNFT_Lite_v2 to TRON Nile Testnet
 *
 * This version includes recipient funding (TRX sent to recipient for gas)
 *
 * Prerequisites:
 * 1. Get Nile testnet TRX from: https://nileex.io/join/getJoinPage
 * 2. Set your private key in .env file: NILE_PRIVATE_KEY=your_key
 *
 * Run: node deploy_lite_v2_nile.js
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

// Contract parameters (in SUN - 1 TRX = 1,000,000 SUN)
const SERVICE_FEE = 10_000_000;      // 10 TRX - Platform fee
const RECIPIENT_FUNDING = 20_000_000; // 20 TRX - Sent to recipient for gas

async function compileContract() {
    console.log('📄 Compiling LegalNoticeNFT_Lite_v2.sol...\n');

    const contractPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Lite_v2.sol');

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
        const outputPath = path.join(buildDir, 'LegalNoticeNFT_Lite_v2.json');

        // Use solcjs or system solc
        const cmd = `solc --optimize --optimize-runs 200 --combined-json abi,bin "${contractPath}"`;
        console.log('Running:', cmd);

        const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        const compiled = JSON.parse(output);

        // Find the contract in output
        const contractKey = Object.keys(compiled.contracts).find(k => k.includes('LegalNoticeNFT_Lite_v2'));

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

        // Check for pre-compiled files
        const abiPath = path.join(buildDir, 'LegalNoticeNFT_Lite_v2.abi');
        const binPath = path.join(buildDir, 'LegalNoticeNFT_Lite_v2.bin');

        if (fs.existsSync(abiPath) && fs.existsSync(binPath)) {
            console.log('✅ Found pre-compiled files, using those...\n');
            return {
                abi: JSON.parse(fs.readFileSync(abiPath, 'utf8')),
                bytecode: fs.readFileSync(binPath, 'utf8').trim()
            };
        }

        console.log('\n⚠️  Automatic compilation failed.');
        console.log('Please compile manually using Remix or TronIDE:');
        console.log('1. Go to https://tronscan.org/#/tools/contract-compiler');
        console.log('2. Or use Remix: https://remix.ethereum.org');
        console.log('3. Compile LegalNoticeNFT_Lite_v2.sol with Solidity 0.8.6, optimizer 200 runs');
        console.log('4. Save ABI to: build/contracts/LegalNoticeNFT_Lite_v2.abi');
        console.log('5. Save Bytecode to: build/contracts/LegalNoticeNFT_Lite_v2.bin');
        console.log('\nThen run this script again.\n');

        throw new Error('Could not compile contract. Please compile manually.');
    }
}

async function deploy() {
    console.log('='.repeat(60));
    console.log('DEPLOY LegalNoticeNFT_Lite_v2 to NILE TESTNET');
    console.log('='.repeat(60) + '\n');

    console.log('CONTRACT PARAMETERS:');
    console.log('  Service Fee:', SERVICE_FEE / 1_000_000, 'TRX (platform revenue)');
    console.log('  Recipient Funding:', RECIPIENT_FUNDING / 1_000_000, 'TRX (sent to recipient)');
    console.log('  Total per Notice:', (SERVICE_FEE + RECIPIENT_FUNDING) / 1_000_000, 'TRX\n');

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
    console.log('Network: Nile Testnet\n');

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
        // Deploy with TWO constructor parameters
        const tx = await tronWeb.transactionBuilder.createSmartContract({
            abi: abi,
            bytecode: bytecode,
            feeLimit: NILE_CONFIG.feeLimit,
            callValue: 0,
            userFeePercentage: NILE_CONFIG.userFeePercentage,
            originEnergyLimit: NILE_CONFIG.originEnergyLimit,
            parameters: [SERVICE_FEE, RECIPIENT_FUNDING] // Two constructor parameters
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
                console.log('\nFee Configuration:');
                console.log('  Service Fee:', SERVICE_FEE / 1_000_000, 'TRX');
                console.log('  Recipient Funding:', RECIPIENT_FUNDING / 1_000_000, 'TRX');
                console.log('\nView on TronScan:');
                console.log(`https://nile.tronscan.org/#/contract/${contractAddress}`);

                // Save deployment info
                const deploymentInfo = {
                    network: 'nile',
                    contractName: 'LegalNoticeNFT_Lite_v2',
                    contractAddress: contractAddress,
                    contractAddressHex: txInfo.contract_address,
                    txHash: result.txid,
                    deployer: deployerAddress,
                    serviceFee: SERVICE_FEE,
                    serviceFeeInTRX: SERVICE_FEE / 1_000_000,
                    recipientFunding: RECIPIENT_FUNDING,
                    recipientFundingInTRX: RECIPIENT_FUNDING / 1_000_000,
                    totalPerNotice: SERVICE_FEE + RECIPIENT_FUNDING,
                    totalPerNoticeInTRX: (SERVICE_FEE + RECIPIENT_FUNDING) / 1_000_000,
                    deployedAt: new Date().toISOString(),
                    abi: abi
                };

                const deploymentPath = path.join(__dirname, 'deployments', 'lite_v2_nile.json');
                fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
                fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
                console.log('\n✅ Deployment info saved to:', deploymentPath);

                // Also update the ABI file for frontend
                const abiPath = path.join(__dirname, 'js-v2', 'lite-contract-abi-v2.json');
                fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
                console.log('✅ ABI updated at:', abiPath);

                // Next steps
                console.log('\n' + '='.repeat(60));
                console.log('NEXT STEPS:');
                console.log('='.repeat(60));
                console.log('1. Update js-v2/config.js with the new contract address:');
                console.log(`   nile.contractAddress = "${contractAddress}"`);
                console.log('2. Test serving a notice (verify recipient receives TRX)');
                console.log('3. Test admin functions (setFee, setRecipientFunding)');
                console.log('4. When ready, deploy to mainnet');

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
