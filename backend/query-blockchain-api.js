/**
 * Query blockchain using TronGrid API directly
 * Run: node query-blockchain-api.js
 */

const axios = require('axios');

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
const CONTRACT_HEX = '418c5fd00a8dc31aa8d6a32e4be64cb8e3ecc8a1f5';
const TRONGRID_API = 'https://api.trongrid.io';

// Token IDs to check
const TOKEN_IDS = [1, 17, 29, 37];

// Convert address to hex format for API
function toHex(address) {
    // Simple base58 to hex would need a library, so let's use known conversions
    const knownAddresses = {
        'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH': '41f8d5b8e1f7a6c3b2e1d4f5a6b7c8d9e0f1a2b3c4',
        'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN': '418c5fd00a8dc31aa8d6a32e4be64cb8e3ecc8a1f5'
    };
    return knownAddresses[address] || address;
}

async function queryContract(functionSelector, parameter) {
    try {
        const response = await axios.post(`${TRONGRID_API}/wallet/triggersmartcontract`, {
            owner_address: CONTRACT_HEX,
            contract_address: CONTRACT_HEX,
            function_selector: functionSelector,
            parameter: parameter || '',
            visible: false
        });
        return response.data;
    } catch (e) {
        console.error(`Error calling ${functionSelector}:`, e.message);
        return null;
    }
}

async function getAccountNFTs(walletAddress) {
    try {
        // Get account info including TRC721 tokens
        const response = await axios.get(
            `${TRONGRID_API}/v1/accounts/${walletAddress}`,
            { params: { only_confirmed: true } }
        );
        return response.data;
    } catch (e) {
        console.error('Error getting account:', e.message);
        return null;
    }
}

async function getContractInfo() {
    try {
        const response = await axios.get(
            `${TRONGRID_API}/v1/contracts/${CONTRACT_ADDRESS}`
        );
        return response.data;
    } catch (e) {
        console.error('Error getting contract:', e.message);
        return null;
    }
}

async function getContractEvents(eventName = null) {
    try {
        const url = eventName
            ? `${TRONGRID_API}/v1/contracts/${CONTRACT_ADDRESS}/events?event_name=${eventName}&limit=50`
            : `${TRONGRID_API}/v1/contracts/${CONTRACT_ADDRESS}/events?limit=50`;

        const response = await axios.get(url);
        return response.data;
    } catch (e) {
        console.error('Error getting events:', e.message);
        return null;
    }
}

async function getTransactionInfo(txHash) {
    try {
        const response = await axios.get(
            `${TRONGRID_API}/v1/transactions/${txHash}`
        );
        return response.data;
    } catch (e) {
        console.error('Error getting transaction:', e.message);
        return null;
    }
}

async function main() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('BLOCKCHAIN QUERY VIA TRONGRID API');
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`${'='.repeat(60)}\n`);

    // 1. Get contract info
    console.log('1. CONTRACT INFO:');
    console.log('-'.repeat(40));
    const contractInfo = await getContractInfo();
    if (contractInfo && contractInfo.data) {
        const data = contractInfo.data[0];
        console.log(`  Name: ${data.name || 'N/A'}`);
        console.log(`  Creator: ${data.creator?.address || 'N/A'}`);
        console.log(`  Created: ${data.date_created ? new Date(data.date_created).toISOString() : 'N/A'}`);
    }

    // 2. Get recent events (Transfer events show NFT movements)
    console.log('\n2. RECENT TRANSFER EVENTS:');
    console.log('-'.repeat(40));
    const events = await getContractEvents('Transfer');
    if (events && events.data) {
        const transfers = events.data.slice(0, 10);
        transfers.forEach(evt => {
            const tokenId = evt.result?.tokenId || evt.result?._tokenId;
            const from = evt.result?.from || evt.result?._from;
            const to = evt.result?.to || evt.result?._to;
            console.log(`  Token #${tokenId}: ${from?.substring(0, 10)}... -> ${to?.substring(0, 10)}...`);
            console.log(`    Time: ${new Date(evt.block_timestamp).toISOString()}`);
        });
    } else {
        console.log('  No events found or error');
    }

    // 3. Check transaction hash from diagnostic (token 37)
    const knownTxHash = '5d9b720b22fa2a203b39d221fe8657e272304b20737377e0003bfd84dcecc4c0';
    console.log(`\n3. TRANSACTION FOR TOKEN 37:`);
    console.log('-'.repeat(40));
    console.log(`  Hash: ${knownTxHash}`);
    const txInfo = await getTransactionInfo(knownTxHash);
    if (txInfo && txInfo.data) {
        const data = txInfo.data[0];
        console.log(`  Block: ${data.blockNumber}`);
        console.log(`  Timestamp: ${new Date(data.block_timestamp).toISOString()}`);
        console.log(`  Status: ${data.ret?.[0]?.contractRet || 'N/A'}`);

        // Try to decode contract data
        if (data.raw_data?.contract?.[0]?.parameter?.value) {
            const contractData = data.raw_data.contract[0].parameter.value;
            console.log(`  Contract: ${contractData.contract_address}`);
            console.log(`  Data length: ${contractData.data?.length || 0} chars`);
        }
    }

    // 4. Get wallet's NFT holdings
    const wallet = 'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH';
    console.log(`\n4. WALLET NFT HOLDINGS:`);
    console.log('-'.repeat(40));
    console.log(`  Wallet: ${wallet}`);

    const accountInfo = await getAccountNFTs(wallet);
    if (accountInfo && accountInfo.data) {
        const data = accountInfo.data[0];
        if (data.trc721token_balances) {
            console.log(`  TRC721 Tokens:`);
            data.trc721token_balances.forEach(token => {
                if (token.contract_address === CONTRACT_ADDRESS ||
                    token.contract_address?.includes('8c5fd00a8dc31aa8d6a32e4be64cb8e3ecc8a1f5')) {
                    console.log(`    Contract: ${token.contract_address}`);
                    console.log(`    Token IDs: ${JSON.stringify(token.token_ids || token.balance)}`);
                }
            });
        } else {
            console.log('  No TRC721 data in response');
        }
    }

    // 5. Query specific events for our tokens
    console.log(`\n5. NOTICE CREATED EVENTS:`);
    console.log('-'.repeat(40));
    const noticeEvents = await getContractEvents('NoticeCreated');
    if (noticeEvents && noticeEvents.data) {
        noticeEvents.data.slice(0, 10).forEach(evt => {
            console.log(`  Alert: #${evt.result?.alertId}, Doc: #${evt.result?.documentId}`);
            console.log(`    Recipient: ${evt.result?.recipient}`);
            console.log(`    Server: ${evt.result?.server}`);
            console.log(`    Time: ${new Date(evt.block_timestamp).toISOString()}`);
        });
    } else {
        console.log('  No NoticeCreated events found');
    }
}

main().catch(console.error);
