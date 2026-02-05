/**
 * Query blockchain for NFT token data
 * Run: node query-blockchain-tokens.js
 */

const TronWebModule = require('tronweb');
require('dotenv').config();

// TronWeb v6 uses a different initialization
const TronWeb = TronWebModule.TronWeb || TronWebModule;

// Try without API key first (public rate limited)
const tronWeb = typeof TronWeb === 'function' ? new TronWeb({
    fullHost: 'https://api.trongrid.io'
}) : TronWeb;

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

// Token IDs to check (from the diagnostic)
const TOKEN_IDS = [1, 17, 29, 37];

async function queryTokens() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('BLOCKCHAIN TOKEN QUERY');
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);

        for (const tokenId of TOKEN_IDS) {
            console.log(`\n--- TOKEN #${tokenId} ---`);

            try {
                // Check owner
                const owner = await contract.ownerOf(tokenId).call();
                console.log(`Owner: ${tronWeb.address.fromHex(owner)}`);

                // Check token type (ALERT=0, DOCUMENT=1)
                try {
                    const tokenType = await contract.tokenTypes(tokenId).call();
                    console.log(`Type: ${tokenType == 0 ? 'ALERT' : 'DOCUMENT'}`);
                } catch (e) {
                    console.log(`Type: Unable to fetch`);
                }

                // Get token URI
                try {
                    const uri = await contract.tokenURI(tokenId).call();
                    console.log(`URI: ${uri ? (uri.length > 100 ? uri.substring(0, 100) + '...' : uri) : 'Empty'}`);
                } catch (e) {
                    console.log(`URI: Unable to fetch`);
                }

                // If it's an alert token (odd number typically), get alert data
                if (tokenId % 2 === 1) {
                    try {
                        const alert = await contract.alertNotices(tokenId).call();
                        console.log(`Alert Notice Data:`);
                        console.log(`  Recipient: ${alert.recipient ? tronWeb.address.fromHex(alert.recipient) : 'N/A'}`);
                        console.log(`  Sender: ${alert.sender ? tronWeb.address.fromHex(alert.sender) : 'N/A'}`);
                        console.log(`  Document ID: ${alert.documentId?.toString() || 'N/A'}`);
                        console.log(`  Timestamp: ${alert.timestamp ? new Date(Number(alert.timestamp) * 1000).toISOString() : 'N/A'}`);
                        console.log(`  Case Number: ${alert.caseNumber || 'N/A'}`);
                        console.log(`  Issuing Agency: ${alert.issuingAgency || 'N/A'}`);
                        console.log(`  Notice Type: ${alert.noticeType || 'N/A'}`);
                        console.log(`  Preview Image: ${alert.previewImage ? (alert.previewImage.length > 50 ? alert.previewImage.substring(0, 50) + '...' : alert.previewImage) : 'N/A'}`);
                    } catch (e) {
                        console.log(`  Alert data error: ${e.message}`);
                    }
                }

                // Check for document notice data (even numbers or document_id + 1)
                const docId = tokenId % 2 === 0 ? tokenId : tokenId + 1;
                try {
                    const doc = await contract.documentNotices(docId).call();
                    console.log(`Document Notice Data (ID ${docId}):`);
                    console.log(`  Encrypted IPFS: ${doc.encryptedIPFS || 'N/A'}`);
                    console.log(`  Decryption Key: ${doc.decryptionKey ? 'Present (hidden)' : 'N/A'}`);
                    console.log(`  Authorized Viewer: ${doc.authorizedViewer ? tronWeb.address.fromHex(doc.authorizedViewer) : 'N/A'}`);
                    console.log(`  Alert ID: ${doc.alertId?.toString() || 'N/A'}`);
                    console.log(`  Is Restricted: ${doc.isRestricted}`);
                } catch (e) {
                    console.log(`  Document data (ID ${docId}) error: ${e.message}`);
                }

            } catch (e) {
                console.log(`Error querying token ${tokenId}: ${e.message}`);
            }
        }

        // Also check total supply
        console.log(`\n--- CONTRACT STATS ---`);
        try {
            const totalSupply = await contract.totalSupply().call();
            console.log(`Total Supply: ${totalSupply.toString()}`);
        } catch (e) {
            console.log(`Total supply: Unable to fetch`);
        }

        try {
            const totalNotices = await contract.totalNotices().call();
            console.log(`Total Notices: ${totalNotices.toString()}`);
        } catch (e) {
            console.log(`Total notices: Unable to fetch`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

queryTokens();
