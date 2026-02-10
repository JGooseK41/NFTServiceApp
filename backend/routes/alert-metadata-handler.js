/**
 * ALERT METADATA HANDLER
 * Handles base64 Alert NFT metadata for backend and BlockServed integration
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * Generate base64 Alert metadata
 * Used by both internal system and BlockServed
 */
router.post('/generate-alert-metadata', async (req, res) => {
    try {
        const { 
            alertId, 
            caseNumber, 
            recipient, 
            recipientName,
            issuingAgency, 
            description,
            status 
        } = req.body;

        console.log(`Generating base64 metadata for Alert #${alertId}`);

        // Create SVG image with BlockServed.com message
        const svg = `<svg width="850" height="1100" xmlns="http://www.w3.org/2000/svg">
            <rect width="850" height="1100" fill="white"/>
            <rect x="25" y="25" width="800" height="1050" fill="none" stroke="red" stroke-width="5" stroke-dasharray="10,5"/>
            
            <text x="425" y="120" font-family="Arial Black" font-size="52" fill="red" text-anchor="middle" font-weight="900">LEGAL NOTICE</text>
            
            <rect x="325" y="150" width="200" height="60" fill="red" rx="10"/>
            <text x="425" y="190" font-family="Arial" font-size="32" fill="white" text-anchor="middle" font-weight="bold">Alert #${alertId || 'PENDING'}</text>
            
            <circle cx="425" cy="350" r="90" fill="none" stroke="gold" stroke-width="8"/>
            <text x="425" y="340" font-family="Arial Black" font-size="28" fill="gold" text-anchor="middle" font-weight="bold">OFFICIAL</text>
            <text x="425" y="370" font-family="Arial Black" font-size="28" fill="gold" text-anchor="middle" font-weight="bold">DOCUMENT</text>
            
            <rect x="100" y="470" width="650" height="120" fill="#f0f0f0" stroke="#333" stroke-width="2" rx="5"/>
            <text x="425" y="510" font-family="Arial" font-size="20" fill="black" text-anchor="middle" font-weight="bold">Case: ${caseNumber || 'PENDING'}</text>
            <text x="425" y="540" font-family="Arial" font-size="18" fill="black" text-anchor="middle">To: ${recipientName || 'To Be Served'}</text>
            <text x="425" y="570" font-family="Arial" font-size="16" fill="#666" text-anchor="middle">From: ${issuingAgency || 'N/A'}</text>
            
            <rect x="50" y="620" width="750" height="180" fill="#0066CC" rx="15"/>
            <text x="425" y="680" font-family="Arial Black" font-size="42" fill="white" text-anchor="middle" font-weight="900">VIEW &amp; ACCEPT AT</text>
            <text x="425" y="740" font-family="Arial Black" font-size="56" fill="white" text-anchor="middle" font-weight="900">BlockServed.com</text>
            <text x="425" y="780" font-family="Arial" font-size="24" fill="white" text-anchor="middle">Secure Digital Legal Service</text>
            
            <rect x="200" y="830" width="450" height="50" fill="#FFD700" rx="5"/>
            <text x="425" y="862" font-family="Arial Black" font-size="24" fill="black" text-anchor="middle" font-weight="bold">ACTION REQUIRED</text>
            
            <text x="425" y="920" font-family="Arial" font-size="20" fill="black" text-anchor="middle">This NFT certifies legal document delivery</text>
            <text x="425" y="950" font-family="Arial" font-size="20" fill="black" text-anchor="middle">Full document requires digital signature</text>
            
            <rect x="0" y="1000" width="850" height="100" fill="#f8f8f8"/>
            <text x="425" y="1040" font-family="Arial" font-size="16" fill="#666" text-anchor="middle">Blockchain Verified • Immutable Record</text>
            <text x="425" y="1065" font-family="Arial" font-size="14" fill="#999" text-anchor="middle">TRON Network • TRC-721 NFT</text>
        </svg>`;

        // Convert SVG to base64
        const svgBase64 = Buffer.from(svg).toString('base64');
        const imageDataUri = `data:image/svg+xml;base64,${svgBase64}`;

        // Create metadata object
        const metadata = {
            name: `Legal Notice Alert #${alertId || 'PENDING'}`,
            description: `OFFICIAL LEGAL NOTICE\n\nCase: ${caseNumber || 'Pending'}\nRecipient: ${recipientName || 'To Be Served'}\nAgency: ${issuingAgency || 'N/A'}\nStatus: ${status || 'Active'}\n\nThis NFT represents an official legal notice requiring acknowledgment.`,
            image: imageDataUri,
            external_url: 'https://theblockservice.com',
            attributes: [
                {
                    trait_type: "Type",
                    value: "Alert NFT"
                },
                {
                    trait_type: "Status",
                    value: status || "Active"
                },
                {
                    trait_type: "Case Number",
                    value: caseNumber || "Pending"
                },
                {
                    trait_type: "Agency",
                    value: issuingAgency || "N/A"
                },
                {
                    trait_type: "Delivery Method",
                    value: "Blockchain Verified"
                }
            ],
            // BlockServed integration data
            blockserved: {
                version: "1.0",
                alertId: alertId,
                caseNumber: caseNumber,
                recipientAddress: recipient,
                canView: true,
                requiresSignature: true
            }
        };

        // Add timestamp if available
        if (req.body.timestamp) {
            metadata.attributes.push({
                trait_type: "Served Date",
                value: new Date(req.body.timestamp).toISOString()
            });
        }

        // Convert metadata to base64 data URI
        const metadataJson = JSON.stringify(metadata);
        const metadataBase64 = Buffer.from(metadataJson).toString('base64');
        const dataUri = `data:application/json;base64,${metadataBase64}`;

        // Store in database for reference
        if (alertId) {
            await pool.query(`
                INSERT INTO alert_metadata (
                    alert_id,
                    metadata_uri,
                    metadata_type,
                    case_number,
                    recipient_address,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (alert_id) 
                DO UPDATE SET 
                    metadata_uri = $2,
                    metadata_type = $3,
                    updated_at = NOW()
            `, [alertId, dataUri, 'base64', caseNumber, recipient]);
        }

        res.json({
            success: true,
            alertId: alertId,
            metadataUri: dataUri,
            metadataSize: `${(dataUri.length / 1024).toFixed(2)} KB`,
            type: 'base64',
            metadata: metadata, // Return decoded for verification
            message: 'Base64 metadata generated successfully'
        });

    } catch (error) {
        console.error('Error generating alert metadata:', error);
        res.status(500).json({ 
            error: 'Failed to generate alert metadata',
            details: error.message 
        });
    }
});

/**
 * Get Alert metadata for BlockServed
 * Returns decoded metadata for easy integration
 */
router.get('/alert/:alertId/metadata', async (req, res) => {
    try {
        const { alertId } = req.params;
        
        // First check database
        const dbResult = await pool.query(`
            SELECT metadata_uri, metadata_type, case_number, recipient_address
            FROM alert_metadata
            WHERE alert_id = $1
        `, [alertId]);

        if (dbResult.rows.length > 0) {
            const data = dbResult.rows[0];
            
            // If base64, decode it
            if (data.metadata_type === 'base64' && data.metadata_uri.startsWith('data:')) {
                const base64Data = data.metadata_uri.split(',')[1];
                const decodedJson = Buffer.from(base64Data, 'base64').toString();
                const metadata = JSON.parse(decodedJson);
                
                res.json({
                    success: true,
                    alertId: alertId,
                    type: 'base64',
                    metadata: metadata,
                    raw_uri: data.metadata_uri,
                    blockserved_compatible: true
                });
            } else {
                // Return as-is for IPFS or other types
                res.json({
                    success: true,
                    alertId: alertId,
                    type: data.metadata_type,
                    uri: data.metadata_uri,
                    case_number: data.case_number,
                    recipient: data.recipient_address
                });
            }
        } else {
            // Try to fetch from blockchain
            res.status(404).json({
                error: 'Alert metadata not found in database',
                alertId: alertId,
                suggestion: 'Check blockchain directly'
            });
        }

    } catch (error) {
        console.error('Error fetching alert metadata:', error);
        res.status(500).json({ 
            error: 'Failed to fetch alert metadata',
            details: error.message 
        });
    }
});

/**
 * Verify base64 metadata integrity
 * Used to ensure metadata is valid and displayable
 */
router.post('/verify-metadata', async (req, res) => {
    try {
        const { metadataUri } = req.body;
        
        if (!metadataUri || !metadataUri.startsWith('data:')) {
            return res.status(400).json({
                valid: false,
                error: 'Invalid data URI format'
            });
        }

        // Extract and decode
        const [header, base64Data] = metadataUri.split(',');
        
        if (!header.includes('application/json')) {
            return res.status(400).json({
                valid: false,
                error: 'Not a JSON data URI'
            });
        }

        try {
            const decodedJson = Buffer.from(base64Data, 'base64').toString();
            const metadata = JSON.parse(decodedJson);
            
            // Verify required fields
            const hasRequiredFields = metadata.name && 
                                     metadata.description && 
                                     metadata.image;
            
            // Check if image is embedded
            const hasEmbeddedImage = metadata.image && 
                                    metadata.image.startsWith('data:image');
            
            res.json({
                valid: true,
                hasRequiredFields,
                hasEmbeddedImage,
                size: `${(metadataUri.length / 1024).toFixed(2)} KB`,
                willDisplayInWallet: hasRequiredFields && hasEmbeddedImage,
                metadata: metadata
            });
            
        } catch (e) {
            res.status(400).json({
                valid: false,
                error: 'Failed to decode metadata',
                details: e.message
            });
        }

    } catch (error) {
        console.error('Error verifying metadata:', error);
        res.status(500).json({ 
            error: 'Failed to verify metadata',
            details: error.message 
        });
    }
});

/**
 * BlockServed integration endpoint
 * Returns all necessary data for BlockServed to display alerts
 */
router.get('/blockserved/alert/:alertId', async (req, res) => {
    try {
        const { alertId } = req.params;
        
        // Get comprehensive alert data
        const alertData = await pool.query(`
            SELECT 
                am.alert_id,
                am.metadata_uri,
                am.metadata_type,
                am.case_number,
                am.recipient_address,
                n.recipient_name,
                n.server_address,
                n.issuing_agency,
                n.description,
                n.status,
                n.created_at,
                n.acknowledged_at
            FROM alert_metadata am
            LEFT JOIN notices n ON n.alert_nft_id = am.alert_id
            WHERE am.alert_id = $1
        `, [alertId]);

        if (alertData.rows.length === 0) {
            return res.status(404).json({
                error: 'Alert not found',
                alertId: alertId
            });
        }

        const data = alertData.rows[0];
        let metadata = null;

        // Decode base64 metadata if present
        if (data.metadata_type === 'base64' && data.metadata_uri) {
            try {
                const base64Data = data.metadata_uri.split(',')[1];
                const decodedJson = Buffer.from(base64Data, 'base64').toString();
                metadata = JSON.parse(decodedJson);
            } catch (e) {
                console.error('Failed to decode metadata:', e);
            }
        }

        // Return BlockServed-compatible response
        res.json({
            success: true,
            alert: {
                id: alertId,
                caseNumber: data.case_number,
                recipient: {
                    address: data.recipient_address,
                    name: data.recipient_name
                },
                server: {
                    address: data.server_address,
                    agency: data.issuing_agency
                },
                status: data.status,
                description: data.description,
                servedAt: data.created_at,
                acknowledgedAt: data.acknowledged_at,
                metadata: metadata,
                metadataType: data.metadata_type,
                displayImage: metadata?.image || null,
                canView: true,
                requiresSignature: data.status !== 'acknowledged'
            }
        });

    } catch (error) {
        console.error('BlockServed endpoint error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch alert for BlockServed',
            details: error.message 
        });
    }
});

module.exports = router;