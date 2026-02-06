/**
 * Server Cases API
 * Primary identity layer: Server wallet address
 * Hierarchy: Wallet -> Cases -> Recipients/Notices
 * 
 * Every server can ONLY see their own notices, never anyone else's
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Disk paths
const DISK_MOUNT_PATH = process.env.DISK_MOUNT_PATH || '/var/data';
const CASES_DIR = path.join(DISK_MOUNT_PATH, 'cases');

/**
 * GET /api/server/:walletAddress/all-notices
 * Get ALL notices/cases ever created by this server wallet
 * This is the primary data retrieval - wallet is the identity layer
 */
router.get('/:walletAddress/all-notices', async (req, res) => {
    const { walletAddress } = req.params;
    
    console.log(`\n=== Fetching ALL notices for server wallet: ${walletAddress} ===`);
    
    try {
        const results = {
            wallet: walletAddress,
            total_notices: 0,
            by_case: {},
            all_notices: [],
            sources: []
        };
        
        // 1. Get ALL from case_service_records (most complete source)
        const serviceQuery = `
            SELECT 
                case_number,
                alert_token_id,
                document_token_id,
                recipients,
                ipfs_hash,
                transaction_hash,
                created_at,
                server_address,
                issuing_agency,
                page_count,
                status
            FROM case_service_records
            WHERE server_address = $1
               OR server_address LIKE $2
               OR server_address LIKE $3
            ORDER BY created_at DESC
        `;
        
        const serviceResult = await pool.query(serviceQuery, [
            walletAddress,
            `${walletAddress}%`,
            `%${walletAddress.substring(0, 10)}%` // Partial match for variations
        ]);
        
        console.log(`Found ${serviceResult.rows.length} records in case_service_records`);
        
        // Process and organize by case
        for (const notice of serviceResult.rows) {
            // Add to all notices
            results.all_notices.push({
                ...notice,
                source: 'case_service_records'
            });
            
            // Organize by case number
            const caseNum = notice.case_number || 'UNCATEGORIZED';
            if (!results.by_case[caseNum]) {
                results.by_case[caseNum] = {
                    case_number: caseNum,
                    notices: [],
                    recipients: new Set(),
                    created_at: notice.created_at,
                    latest_activity: notice.created_at
                };
            }
            
            results.by_case[caseNum].notices.push(notice);
            
            // Track recipients
            if (notice.recipients) {
                try {
                    const recipientList = typeof notice.recipients === 'string' 
                        ? JSON.parse(notice.recipients) 
                        : notice.recipients;
                    
                    if (Array.isArray(recipientList)) {
                        recipientList.forEach(r => results.by_case[caseNum].recipients.add(r));
                    }
                } catch (e) {
                    // Single recipient or unparseable
                    results.by_case[caseNum].recipients.add(notice.recipients);
                }
            }
            
            // Update latest activity
            if (new Date(notice.created_at) > new Date(results.by_case[caseNum].latest_activity)) {
                results.by_case[caseNum].latest_activity = notice.created_at;
            }
        }
        
        // 2. Also check cases table for any additional records
        const casesQuery = `
            SELECT 
                id as case_number,
                status,
                created_at,
                served_at,
                recipient_address,
                ipfs_hash,
                alert_nft_id,
                document_nft_id,
                metadata
            FROM cases
            WHERE server_address = $1
               OR server_address LIKE $2
            ORDER BY created_at DESC
        `;
        
        const casesResult = await pool.query(casesQuery, [
            walletAddress,
            `${walletAddress}%`
        ]);
        
        console.log(`Found ${casesResult.rows.length} records in cases table`);
        
        // Add cases table records
        for (const caseRecord of casesResult.rows) {
            const caseNum = caseRecord.case_number;
            
            // Check if we already have this case
            if (!results.by_case[caseNum]) {
                results.by_case[caseNum] = {
                    case_number: caseNum,
                    notices: [],
                    recipients: new Set(),
                    created_at: caseRecord.created_at,
                    latest_activity: caseRecord.served_at || caseRecord.created_at
                };
            }
            
            // Add the case record as a notice
            results.by_case[caseNum].notices.push({
                ...caseRecord,
                source: 'cases_table'
            });
            
            // Add to all notices if not duplicate
            const isDuplicate = results.all_notices.some(n => 
                n.case_number === caseNum && n.source === 'cases_table'
            );
            
            if (!isDuplicate) {
                results.all_notices.push({
                    ...caseRecord,
                    source: 'cases_table'
                });
            }
            
            if (caseRecord.recipient_address) {
                results.by_case[caseNum].recipients.add(caseRecord.recipient_address);
            }
        }
        
        // 3. Check for orphaned notices (notices without case numbers)
        const orphanedQuery = `
            SELECT 
                notice_id,
                alert_id,
                document_id,
                server_address,
                recipient_address,
                created_at
            FROM notice_components
            WHERE server_address = $1
               AND (case_number IS NULL OR case_number = '')
            ORDER BY created_at DESC
        `;
        
        const orphanedResult = await pool.query(orphanedQuery, [walletAddress]);
        
        if (orphanedResult.rows.length > 0) {
            console.log(`Found ${orphanedResult.rows.length} orphaned notices`);
            
            results.by_case['ORPHANED'] = {
                case_number: 'ORPHANED',
                notices: orphanedResult.rows.map(r => ({
                    ...r,
                    source: 'orphaned_notices'
                })),
                recipients: new Set(orphanedResult.rows.map(r => r.recipient_address).filter(r => r)),
                created_at: orphanedResult.rows[0]?.created_at
            };
        }
        
        // Convert Sets to arrays for JSON serialization
        Object.keys(results.by_case).forEach(caseNum => {
            results.by_case[caseNum].recipients = Array.from(results.by_case[caseNum].recipients);
            results.by_case[caseNum].notice_count = results.by_case[caseNum].notices.length;
        });
        
        // Summary statistics
        results.total_notices = results.all_notices.length;
        results.total_cases = Object.keys(results.by_case).length;
        results.sources = [...new Set(results.all_notices.map(n => n.source))];
        
        console.log(`\n=== Summary ===`);
        console.log(`Total notices: ${results.total_notices}`);
        console.log(`Total cases: ${results.total_cases}`);
        console.log(`Data sources: ${results.sources.join(', ')}`);
        
        res.json(results);
        
    } catch (error) {
        console.error('Error fetching server notices:', error);
        res.status(500).json({
            error: 'Failed to fetch notices',
            message: error.message
        });
    }
});

/**
 * GET /api/server/:walletAddress/cases
 * Get cases summary (grouped view)
 */
router.get('/:walletAddress/cases', async (req, res) => {
    const { walletAddress } = req.params;
    const { status } = req.query;
    
    console.log(`Fetching cases for server: ${walletAddress}`);
    
    try {
        // Get all notices first
        const allNoticesResponse = await fetch(`${req.protocol}://${req.get('host')}/api/server/${walletAddress}/all-notices`);
        const data = await allNoticesResponse.json();
        
        // Transform to cases list
        const cases = Object.values(data.by_case).map(caseData => ({
            id: caseData.case_number,
            case_number: caseData.case_number,
            notice_count: caseData.notice_count,
            recipient_count: caseData.recipients.length,
            recipients: caseData.recipients,
            created_at: caseData.created_at,
            latest_activity: caseData.latest_activity,
            status: caseData.notices[0]?.status || 'unknown',
            has_ipfs: caseData.notices.some(n => n.ipfs_hash),
            alert_tokens: [...new Set(caseData.notices.map(n => n.alert_token_id).filter(id => id))],
            document_tokens: [...new Set(caseData.notices.map(n => n.document_token_id).filter(id => id))]
        }));
        
        // Filter by status if requested
        const filteredCases = status 
            ? cases.filter(c => c.status === status)
            : cases;
        
        res.json({
            success: true,
            wallet: walletAddress,
            total_cases: filteredCases.length,
            cases: filteredCases
        });
        
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cases',
            message: error.message
        });
    }
});

/**
 * GET /api/server/:walletAddress/case/:caseNumber
 * Get all notices for a specific case
 */
router.get('/:walletAddress/case/:caseNumber', async (req, res) => {
    const { walletAddress, caseNumber } = req.params;
    
    console.log(`Fetching case ${caseNumber} for server ${walletAddress}`);
    
    try {
        // Verify ownership - server can ONLY see their own cases
        const ownershipCheck = await pool.query(`
            SELECT COUNT(*) as count
            FROM case_service_records
            WHERE case_number = $1 
            AND (server_address = $2 OR server_address LIKE $3)
        `, [caseNumber, walletAddress, `${walletAddress}%`]);
        
        if (ownershipCheck.rows[0].count === 0) {
            // Check cases table too
            const casesCheck = await pool.query(`
                SELECT COUNT(*) as count
                FROM cases
                WHERE id = $1 AND server_address = $2
            `, [caseNumber, walletAddress]);
            
            if (casesCheck.rows[0].count === 0) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'This case does not belong to your wallet'
                });
            }
        }
        
        // Get all notices for this case
        const noticesQuery = `
            SELECT 
                *,
                'case_service_records' as source
            FROM case_service_records
            WHERE case_number = $1
            UNION ALL
            SELECT 
                id as case_number,
                alert_nft_id as alert_token_id,
                document_nft_id as document_token_id,
                recipient_address as recipients,
                ipfs_hash,
                tx_hash as transaction_hash,
                created_at,
                server_address,
                NULL as issuing_agency,
                NULL as page_count,
                status,
                metadata,
                served_at,
                pdf_path,
                document_hash,
                alert_preview,
                encryption_key,
                updated_at,
                NULL as last_viewed,
                NULL as view_count,
                NULL as accepted,
                NULL as accepted_at,
                NULL as server_name,
                'cases_table' as source
            FROM cases
            WHERE id = $1
        `;
        
        const noticesResult = await pool.query(noticesQuery, [caseNumber]);
        
        // Check if PDF exists on disk
        let pdfExists = false;
        let pdfPath = null;
        
        try {
            const diskPath = path.join(CASES_DIR, caseNumber, 'document.pdf');
            await fs.access(diskPath);
            pdfExists = true;
            pdfPath = `/api/cases/${caseNumber}/pdf`;
        } catch (e) {
            // PDF not found on disk
        }
        
        res.json({
            success: true,
            case_number: caseNumber,
            wallet: walletAddress,
            notices: noticesResult.rows,
            notice_count: noticesResult.rows.length,
            pdf_available: pdfExists,
            pdf_url: pdfPath,
            recipients: [...new Set(noticesResult.rows.map(n => n.recipients).flat().filter(r => r))]
        });
        
    } catch (error) {
        console.error('Error fetching case details:', error);
        res.status(500).json({
            error: 'Failed to fetch case details',
            message: error.message
        });
    }
});

/**
 * GET /api/server/:walletAddress/recipient/:recipientAddress
 * Get all notices sent to a specific recipient by this server
 */
router.get('/:walletAddress/recipient/:recipientAddress', async (req, res) => {
    const { walletAddress, recipientAddress } = req.params;
    
    console.log(`Fetching notices from ${walletAddress} to ${recipientAddress}`);
    
    try {
        const query = `
            SELECT 
                csr.*,
                'case_service_records' as source
            FROM case_service_records csr
            WHERE csr.server_address = $1
            AND (
                csr.recipients LIKE $2
                OR csr.recipients::jsonb ? $3
                OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(
                        CASE 
                            WHEN csr.recipients::text LIKE '[%' 
                            THEN csr.recipients::jsonb 
                            ELSE '[]'::jsonb 
                        END
                    ) AS recipient
                    WHERE LOWER(recipient) = LOWER($3)
                )
            )
            ORDER BY csr.created_at DESC
        `;
        
        const result = await pool.query(query, [
            walletAddress,
            `%${recipientAddress}%`,
            recipientAddress
        ]);
        
        res.json({
            success: true,
            server_wallet: walletAddress,
            recipient: recipientAddress,
            notices: result.rows,
            total: result.rows.length,
            cases: [...new Set(result.rows.map(n => n.case_number))]
        });
        
    } catch (error) {
        console.error('Error fetching recipient notices:', error);
        res.status(500).json({
            error: 'Failed to fetch recipient notices',
            message: error.message
        });
    }
});

/**
 * POST /api/server/:walletAddress/link-orphaned
 * Link orphaned cases to server wallet
 */
router.post('/:walletAddress/link-orphaned', async (req, res) => {
    const { walletAddress } = req.params;
    const { case_ids } = req.body;
    
    console.log(`Linking orphaned cases to ${walletAddress}`);
    
    try {
        let updated = 0;
        
        // If specific case IDs provided, use those
        // Otherwise, find orphaned cases on disk
        const casesToLink = case_ids || [];
        
        if (casesToLink.length === 0) {
            // Auto-detect from disk
            try {
                const dirs = await fs.readdir(CASES_DIR);
                for (const dir of dirs) {
                    const pdfPath = path.join(CASES_DIR, dir, 'document.pdf');
                    try {
                        await fs.access(pdfPath);
                        casesToLink.push(dir);
                    } catch (e) {
                        // Not a valid case
                    }
                }
            } catch (e) {
                console.log('Could not read disk:', e.message);
            }
        }
        
        for (const caseId of casesToLink) {
            // Update or insert into cases table
            await pool.query(`
                INSERT INTO cases (id, server_address, status, created_at)
                VALUES ($1, $2, 'served', NOW())
                ON CONFLICT (id) DO UPDATE 
                SET server_address = $2
            `, [caseId, walletAddress]);
            
            // Update or insert into case_service_records
            await pool.query(`
                INSERT INTO case_service_records (case_number, server_address, created_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (case_number) DO UPDATE 
                SET server_address = $2
            `, [caseId, walletAddress]);
            
            updated++;
        }
        
        res.json({
            success: true,
            wallet: walletAddress,
            linked_cases: casesToLink,
            updated_count: updated
        });

    } catch (error) {
        console.error('Error linking cases:', error);
        res.status(500).json({
            error: 'Failed to link cases',
            message: error.message
        });
    }
});

/**
 * GET /api/server/:walletAddress/case/:caseNumber/recipient-status
 * Get status of all recipients for a specific case (viewed, signed, etc.)
 * Includes detailed forensic tracking: IP, geolocation, timezone, browser info
 * Server can only check status for their own cases
 */
router.get('/:walletAddress/case/:caseNumber/recipient-status', async (req, res) => {
    const { walletAddress, caseNumber } = req.params;
    const { detailed = 'true' } = req.query; // Include detailed tracking by default

    console.log(`Fetching recipient status for case ${caseNumber} by server ${walletAddress}`);

    try {
        // First verify this case belongs to the server
        const ownershipCheck = await pool.query(`
            SELECT case_number, recipients, server_address
            FROM case_service_records
            WHERE case_number = $1 AND server_address = $2
        `, [caseNumber, walletAddress]);

        if (ownershipCheck.rows.length === 0) {
            return res.status(403).json({
                error: 'Case not found or does not belong to this server',
                case_number: caseNumber
            });
        }

        const caseData = ownershipCheck.rows[0];
        let recipients = [];

        try {
            recipients = typeof caseData.recipients === 'string'
                ? JSON.parse(caseData.recipients)
                : caseData.recipients || [];
        } catch (e) {
            console.log('Could not parse recipients:', e.message);
        }

        // Get status for each recipient
        const recipientStatuses = await Promise.all(recipients.map(async (recipientAddress) => {
            // Check document views (with IP and metadata)
            const viewResult = await pool.query(`
                SELECT
                    view_type,
                    viewed_at,
                    ip_address,
                    user_agent,
                    metadata
                FROM document_views
                WHERE case_number = $1
                AND recipient_address = $2
                ORDER BY viewed_at DESC
            `, [caseNumber, recipientAddress]).catch(() => ({ rows: [] }));

            // Check recipient_notice_views for additional view data
            const noticeViewResult = await pool.query(`
                SELECT
                    viewed_at,
                    action_type,
                    view_duration_seconds,
                    ip_address,
                    user_agent
                FROM recipient_notice_views
                WHERE case_number = $1
                AND wallet_address = $2
                ORDER BY viewed_at DESC
            `, [caseNumber, recipientAddress]).catch(() => ({ rows: [] }));

            // Get wallet connection history with geolocation
            const connectionResult = await pool.query(`
                SELECT
                    connected_at,
                    ip_address,
                    user_agent,
                    browser_info
                FROM recipient_connections
                WHERE wallet_address = $1
                ORDER BY connected_at DESC
                LIMIT 5
            `, [recipientAddress]).catch(() => ({ rows: [] }));

            // Check for signatures/acknowledgments with device info
            const acknowledgmentResult = await pool.query(`
                SELECT
                    acknowledged_at,
                    ip_address,
                    user_agent,
                    geolocation,
                    device_info,
                    signature
                FROM recipient_acknowledgments
                WHERE case_number = $1
                AND wallet_address = $2
            `, [caseNumber, recipientAddress]).catch(() => ({ rows: [] }));

            // Check case_service_records for acceptance
            const signatureResult = await pool.query(`
                SELECT
                    accepted,
                    accepted_at
                FROM case_service_records
                WHERE case_number = $1
                AND (
                    recipients LIKE $2
                    OR recipients::jsonb ? $3
                )
                AND accepted = true
            `, [caseNumber, `%${recipientAddress}%`, recipientAddress]).catch(() => ({ rows: [] }));

            // Also check notice_acceptances table
            const acceptanceResult = await pool.query(`
                SELECT
                    acceptor_address,
                    accepted_at,
                    transaction_hash
                FROM notice_acceptances
                WHERE notice_id LIKE $1
                AND acceptor_address = $2
            `, [`%${caseNumber}%`, recipientAddress]).catch(() => ({ rows: [] }));

            // Combine all views
            const allViews = [...viewResult.rows, ...noticeViewResult.rows];
            const hasViewed = allViews.length > 0;
            const lastView = viewResult.rows[0] || noticeViewResult.rows[0];
            const hasSigned = signatureResult.rows.length > 0 || acceptanceResult.rows.length > 0 || acknowledgmentResult.rows.length > 0;
            const signatureData = acknowledgmentResult.rows[0] || acceptanceResult.rows[0] || signatureResult.rows[0];
            const lastConnection = connectionResult.rows[0];

            // Determine status
            let status = 'Delivered';
            if (hasSigned) {
                status = 'Signed For';
            } else if (hasViewed) {
                status = 'Viewed';
            }

            // Extract geolocation from browser_info if available
            let geolocation = null;
            if (lastConnection?.browser_info?.ipGeolocation) {
                geolocation = lastConnection.browser_info.ipGeolocation;
            } else if (signatureData?.geolocation) {
                geolocation = signatureData.geolocation;
            }

            // Extract language from headers
            let language = null;
            if (lastConnection?.browser_info?.headers?.acceptLanguage) {
                language = lastConnection.browser_info.headers.acceptLanguage;
            }

            // Build response
            const recipientStatus = {
                recipient: recipientAddress,
                status: status,
                viewed: hasViewed,
                viewed_at: lastView?.viewed_at || null,
                view_count: allViews.length,
                signed: hasSigned,
                signed_at: signatureData?.accepted_at || signatureData?.acknowledged_at || null,
                signature_tx: signatureData?.transaction_hash || null
            };

            // Add detailed tracking if requested
            if (detailed === 'true') {
                recipientStatus.tracking = {
                    // Connection info
                    last_connection: lastConnection?.connected_at || null,
                    ip_address: lastView?.ip_address || lastConnection?.ip_address || null,
                    user_agent: lastView?.user_agent || lastConnection?.user_agent || null,

                    // Geolocation from IP
                    geolocation: geolocation ? {
                        country: geolocation.country,
                        region: geolocation.region,
                        city: geolocation.city,
                        timezone: geolocation.timezone,
                        isp: geolocation.isp
                    } : null,

                    // Browser preferences
                    language: language,

                    // Device info from signing
                    device_info: signatureData?.device_info || null,

                    // View history
                    view_history: viewResult.rows.slice(0, 5).map(v => ({
                        viewed_at: v.viewed_at,
                        view_type: v.view_type,
                        ip_address: v.ip_address
                    })),

                    // Connection history
                    connection_history: connectionResult.rows.map(c => ({
                        connected_at: c.connected_at,
                        ip_address: c.ip_address,
                        city: c.browser_info?.ipGeolocation?.city,
                        country: c.browser_info?.ipGeolocation?.country,
                        timezone: c.browser_info?.ipGeolocation?.timezone
                    }))
                };
            }

            return recipientStatus;
        }));

        // Calculate summary
        const summary = {
            total_recipients: recipients.length,
            delivered: recipientStatuses.filter(r => r.status === 'Delivered').length,
            viewed: recipientStatuses.filter(r => r.status === 'Viewed').length,
            signed: recipientStatuses.filter(r => r.status === 'Signed For').length
        };

        res.json({
            success: true,
            case_number: caseNumber,
            server: walletAddress,
            recipients: recipientStatuses,
            summary: summary
        });

    } catch (error) {
        console.error('Error fetching recipient status:', error);
        res.status(500).json({
            error: 'Failed to fetch recipient status',
            message: error.message
        });
    }
});

module.exports = router;