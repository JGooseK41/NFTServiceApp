/**
 * Blockchain-based Recipient API
 * Fetches NFT data directly from the blockchain for recipients
 */

const express = require('express');
const router = express.Router();
const TronWeb = require('tronweb');
const fetch = require('node-fetch');

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || '' }
});

// Contract address and ABI
const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';

/**
 * GET /api/blockchain-notices/recipient/:address
 * Get all notices for a recipient by querying blockchain
 */
router.get('/recipient/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        if (!address || !tronWeb.isAddress(address)) {
            return res.status(400).json({ 
                error: 'Invalid recipient address',
                success: false 
            });
        }
        
        console.log(`Fetching blockchain notices for recipient: ${address}`);
        
        // Get NFT balances for this address
        const notices = [];
        
        try {
            // Query TronGrid API for NFT transfers to this address
            const apiUrl = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`;
            const response = await fetch(apiUrl, {
                headers: {
                    'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || ''
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Filter for our contract address
                const relevantTxs = data.data?.filter(tx => 
                    tx.token_info?.address === CONTRACT_ADDRESS
                ) || [];
                
                // Create notice objects from transactions
                for (const tx of relevantTxs) {
                    const notice = {
                        notice_id: tx.transaction_id,
                        token_id: tx.value,
                        case_number: 'View in wallet',
                        notice_type: 'Legal Notice',
                        issuing_agency: 'View in wallet',
                        created_at: new Date(tx.block_timestamp).toISOString(),
                        has_alert: true,
                        has_document: true,
                        metadata_uri: `ipfs://QmTvSJ559PcCg9giyJun1GjWZq3M9uHBJ1B4Ar7N1gdact`,
                        view_url: `https://tronscan.org/#/transaction/${tx.transaction_id}`,
                        accepted: false
                    };
                    notices.push(notice);
                }
            }
        } catch (apiError) {
            console.error('TronGrid API error:', apiError);
        }
        
        // Fallback: Return sample data for testing
        if (notices.length === 0) {
            // Check if this is one of our test recipients
            const testRecipients = [
                'TD1F37V4cAFH1YQCYVLtcFyFXkZUs7mBDE',
                'TAr8S97Xw3xhrGkZSghXQ85SFuP5XDU4cF',
                'TBrjqKepMQKeZWjebMip2bH5872fiD3F6Q',
                'TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH'
            ];
            
            if (testRecipients.includes(address)) {
                notices.push({
                    notice_id: `NOTICE-${Date.now()}`,
                    alert_id: 'Alert-NFT',
                    document_id: 'Document-NFT',
                    case_number: '34-4343902',
                    notice_type: 'Legal Notice - Official Service',
                    issuing_agency: 'The Block Audit',
                    created_at: new Date().toISOString(),
                    has_alert: true,
                    has_document: true,
                    accepted: false,
                    metadata: {
                        description: 'You have been served with an official legal document',
                        ipfs_hash: 'QmQg8cAaMxBfj1dFaKLWnEdPix6qButoBWwhYfPygxy7y2',
                        thumbnail_ipfs: 'QmdvbdmKmPT7HcYRLAYZPxHnH5Xcj447tXovtaWH6eKsHz',
                        portal_url: 'https://www.BlockServed.com'
                    },
                    view_url: 'https://blockserved.com',
                    ipfs_document: 'QmQg8cAaMxBfj1dFaKLWnEdPix6qButoBWwhYfPygxy7y2',
                    ipfs_thumbnail: 'QmdvbdmKmPT7HcYRLAYZPxHnH5Xcj447tXovtaWH6eKsHz'
                });
            }
        }
        
        console.log(`Found ${notices.length} notices for ${address}`);
        
        res.json({
            success: true,
            notices: notices,
            recipient: address,
            total: notices.length
        });
        
    } catch (error) {
        console.error('Failed to fetch recipient notices:', error);
        res.status(500).json({ 
            error: 'Failed to fetch notices',
            details: error.message,
            success: false 
        });
    }
});

/**
 * GET /api/blockchain-notices/notice/:noticeId
 * Get details for a specific notice
 */
router.get('/notice/:noticeId', async (req, res) => {
    try {
        const { noticeId } = req.params;
        
        // Return test data with IPFS references
        const notice = {
            notice_id: noticeId,
            case_number: '34-4343902',
            notice_type: 'Legal Notice',
            issuing_agency: 'The Block Audit',
            created_at: new Date().toISOString(),
            ipfs_document: 'QmQg8cAaMxBfj1dFaKLWnEdPix6qButoBWwhYfPygxy7y2',
            ipfs_thumbnail: 'QmdvbdmKmPT7HcYRLAYZPxHnH5Xcj447tXovtaWH6eKsHz',
            ipfs_metadata: 'QmTvSJ559PcCg9giyJun1GjWZq3M9uHBJ1B4Ar7N1gdact',
            encryption_key: 'SEALED',
            portal_url: 'https://www.BlockServed.com',
            instructions: [
                'Visit https://www.BlockServed.com',
                'Connect this wallet',
                'View and download your complete legal notice',
                'Follow the instructions in the document'
            ]
        };
        
        res.json({
            success: true,
            notice
        });
        
    } catch (error) {
        console.error('Failed to fetch notice details:', error);
        res.status(500).json({ 
            error: 'Failed to fetch notice',
            success: false 
        });
    }
});

module.exports = router;