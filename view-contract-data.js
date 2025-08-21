#!/usr/bin/env node

/**
 * Script to view on-chain notice data from the contract
 * This shows exactly what's stored on-chain for each notice
 */

const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io'
});

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// Minimal ABI for reading notice data
const ABI = [
    {
        "constant": true,
        "inputs": [{"name": "", "type": "uint256"}],
        "name": "notices",
        "outputs": [
            {"name": "recipient", "type": "address"},
            {"name": "encryptedIPFS", "type": "string"},
            {"name": "encryptionKey", "type": "string"},
            {"name": "issuingAgency", "type": "string"},
            {"name": "noticeType", "type": "string"},
            {"name": "caseNumber", "type": "string"},
            {"name": "caseDetails", "type": "string"},
            {"name": "legalRights", "type": "string"},
            {"name": "sponsorFees", "type": "bool"},
            {"name": "metadataURI", "type": "string"}
        ],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{"name": "", "type": "uint256"}],
        "name": "alertMetadata",
        "outputs": [
            {"name": "issuingAgency", "type": "string"},
            {"name": "noticeType", "type": "string"},
            {"name": "caseNumber", "type": "string"},
            {"name": "caseDetails", "type": "string"},
            {"name": "legalRights", "type": "string"},
            {"name": "metadataURI", "type": "string"}
        ],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    }
];

async function viewNoticeData() {
    try {
        const contract = await tronWeb.contract(ABI, CONTRACT_ADDRESS);
        
        console.log('='.repeat(80));
        console.log('ON-CHAIN NOTICE DATA FROM CONTRACT');
        console.log('Contract:', CONTRACT_ADDRESS);
        console.log('='.repeat(80));
        
        // View notices 14-17 (from your batch)
        const noticeIds = [14, 15, 16, 17];
        
        for (const noticeId of noticeIds) {
            console.log(`\n📋 NOTICE #${noticeId}`);
            console.log('-'.repeat(40));
            
            try {
                const notice = await contract.notices(noticeId).call();
                
                console.log('Recipient:', notice.recipient);
                console.log('Case Number:', notice.caseNumber);
                console.log('Issuing Agency:', notice.issuingAgency);
                console.log('Notice Type:', notice.noticeType);
                console.log('Case Details:', notice.caseDetails);
                console.log('Legal Rights:', notice.legalRights);
                console.log('IPFS Document:', notice.encryptedIPFS);
                console.log('Metadata URI:', notice.metadataURI);
                
                // Calculate token IDs (2 tokens per notice)
                const alertTokenId = (noticeId - 1) * 2 + 7;  // Starting from token 7
                const documentTokenId = alertTokenId + 1;
                
                console.log(`\n🎫 TOKEN IDs:`);
                console.log(`Alert NFT: #${alertTokenId}`);
                console.log(`Document NFT: #${documentTokenId}`);
                
                // Get token URI
                try {
                    const tokenUri = await contract.tokenURI(alertTokenId).call();
                    console.log('Token URI:', tokenUri);
                } catch (e) {
                    // Try alertMetadata
                    const metadata = await contract.alertMetadata(alertTokenId).call();
                    console.log('\n📄 Alert Metadata:');
                    console.log('  Agency:', metadata.issuingAgency);
                    console.log('  Type:', metadata.noticeType);
                    console.log('  Case:', metadata.caseNumber);
                    console.log('  Details:', metadata.caseDetails);
                    console.log('  Rights:', metadata.legalRights);
                    console.log('  URI:', metadata.metadataURI);
                }
                
            } catch (error) {
                console.log('Notice not found or error reading:', error.message);
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('HOW TO VIEW THIS DATA ON TRONSCAN:');
        console.log('1. Go to: https://tronscan.org/#/contract/' + CONTRACT_ADDRESS + '/code');
        console.log('2. Click "Read Contract" tab');
        console.log('3. Find "notices" function and enter notice ID (14-17)');
        console.log('4. Find "alertMetadata" function and enter token ID (31,33,35,37)');
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

viewNoticeData();