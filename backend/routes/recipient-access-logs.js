/**
 * Recipient Access Logs API
 * Comprehensive logging for all recipient interactions with BlockServed
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const cors = require('cors');

// CORS configuration
const corsOptions = {
    origin: [
        'https://blockserved.com',
        'https://www.blockserved.com',
        'https://theblockservice.com',
        'https://www.theblockservice.com',
        'https://nft-legal-service.netlify.app',
        'http://localhost:8080',
        'http://localhost:3000',
        'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Timezone', 'X-Wallet-Provider', 'X-Visitor-Id', 'X-Fingerprint', 'X-Fingerprint-Confidence', 'X-Screen-Resolution']
};

router.use(cors(corsOptions));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

/**
 * Format timestamp with both UTC and local time based on timezone
 * @param {Date} timestamp - The timestamp to format
 * @param {string} recipientTimezone - The recipient's timezone (e.g., 'America/New_York')
 * @returns {object} - Object with utc, local, and timezone info
 */
function formatTimestampWithTimezone(timestamp, recipientTimezone = null) {
    if (!timestamp) return null;

    const date = new Date(timestamp);

    const result = {
        utc: date.toISOString(),
        utc_formatted: date.toUTCString(),
        unix_timestamp: Math.floor(date.getTime() / 1000)
    };

    // Add recipient local time if timezone is available
    if (recipientTimezone) {
        try {
            result.recipient_local = date.toLocaleString('en-US', {
                timeZone: recipientTimezone,
                dateStyle: 'full',
                timeStyle: 'long'
            });
            result.recipient_timezone = recipientTimezone;
        } catch (e) {
            // Invalid timezone, skip
        }
    }

    // Add server local time (default server timezone)
    result.server_local = date.toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long'
    });

    return result;
}

/**
 * Enhance activity records with formatted timestamps
 * @param {Array} records - Array of database records
 * @param {string} timestampField - The field containing the timestamp
 * @returns {Array} - Enhanced records with formatted timestamps
 */
function enhanceRecordsWithTimestamps(records, timestampField) {
    return records.map(record => {
        const timezone = record.recipient_timezone || record.timezone || null;
        return {
            ...record,
            timestamps: formatTimestampWithTimezone(record[timestampField], timezone)
        };
    });
}

// Create logging tables on startup
async function initializeLoggingTables() {
    try {
        // Table for wallet connections
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_connections (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(255) NOT NULL,
                connected_at TIMESTAMP DEFAULT NOW(),
                connected_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'),
                ip_address VARCHAR(45),
                user_agent TEXT,
                session_id VARCHAR(255),
                visitor_id VARCHAR(100),
                browser_info JSONB,
                recipient_timezone VARCHAR(100),
                is_return_visitor BOOLEAN DEFAULT FALSE,
                visit_count INTEGER DEFAULT 1,
                referrer_domain VARCHAR(255),
                accept_language TEXT
            )
        `);

        // Add columns if they don't exist (migration for existing tables)
        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS connected_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC')
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS recipient_timezone VARCHAR(100)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(100)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS is_return_visitor BOOLEAN DEFAULT FALSE
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 1
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS referrer_domain VARCHAR(255)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS accept_language TEXT
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS browser_fingerprint VARCHAR(100)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS fingerprint_confidence INTEGER DEFAULT 0
        `).catch(() => {});

        // Wallet provider columns for easier querying
        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS wallet_provider VARCHAR(100)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS wallet_version VARCHAR(50)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(100)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS wallet_network VARCHAR(255)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS is_in_app_browser BOOLEAN DEFAULT FALSE
        `).catch(() => {});

        // Multi-chain support columns
        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS chain_type VARCHAR(50)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_connections
            ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50)
        `).catch(() => {});

        // Table for notice views
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_notice_views (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                viewed_at TIMESTAMP DEFAULT NOW(),
                viewed_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'),
                view_duration_seconds INTEGER,
                ip_address VARCHAR(45),
                user_agent TEXT,
                action_type VARCHAR(50), -- 'list_view', 'detail_view', 'document_open'
                session_id VARCHAR(255),
                recipient_timezone VARCHAR(100)
            )
        `);

        // Add recipient_timezone column if it doesn't exist (migration for existing tables)
        await pool.query(`
            ALTER TABLE recipient_notice_views
            ADD COLUMN IF NOT EXISTS recipient_timezone VARCHAR(100)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_notice_views
            ADD COLUMN IF NOT EXISTS viewed_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC')
        `).catch(() => {});
        
        // Table for document downloads/prints
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_document_actions (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                action_type VARCHAR(50) NOT NULL, -- 'download', 'print', 'email'
                action_at TIMESTAMP DEFAULT NOW(),
                action_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'),
                ip_address VARCHAR(45),
                user_agent TEXT,
                success BOOLEAN DEFAULT true,
                metadata JSONB,
                recipient_timezone VARCHAR(100)
            )
        `);

        // Add recipient_timezone column if it doesn't exist (migration for existing tables)
        await pool.query(`
            ALTER TABLE recipient_document_actions
            ADD COLUMN IF NOT EXISTS recipient_timezone VARCHAR(100)
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_document_actions
            ADD COLUMN IF NOT EXISTS action_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC')
        `).catch(() => {});
        
        // Enhanced acknowledgments table with more details
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_acknowledgments (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                signature TEXT,
                acknowledged_at TIMESTAMP DEFAULT NOW(),
                acknowledged_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'),
                ip_address VARCHAR(45),
                user_agent TEXT,
                geolocation JSONB,
                device_info JSONB,
                legally_binding BOOLEAN DEFAULT true,
                recipient_timezone VARCHAR(100),
                UNIQUE(case_number, wallet_address)
            )
        `);

        // Add columns if they don't exist (migration for existing tables)
        await pool.query(`
            ALTER TABLE recipient_acknowledgments
            ADD COLUMN IF NOT EXISTS acknowledged_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC')
        `).catch(() => {});

        await pool.query(`
            ALTER TABLE recipient_acknowledgments
            ADD COLUMN IF NOT EXISTS recipient_timezone VARCHAR(100)
        `).catch(() => {});

        // Signature events table - tracks all signature-related actions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_signature_events (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                event_at TIMESTAMP DEFAULT NOW(),
                event_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC'),
                ip_address VARCHAR(45),
                user_agent TEXT,
                recipient_timezone VARCHAR(100),
                session_id VARCHAR(255),
                details JSONB
            )
        `);

        // Add UTC timestamp column if it doesn't exist (migration for existing tables)
        await pool.query(`
            ALTER TABLE recipient_signature_events
            ADD COLUMN IF NOT EXISTS event_at_utc TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC')
        `).catch(() => {});

        // Rename timezone to recipient_timezone for consistency (migration for existing tables)
        await pool.query(`
            ALTER TABLE recipient_signature_events
            RENAME COLUMN timezone TO recipient_timezone
        `).catch(() => {});

        // Add recipient_timezone if it doesn't exist (in case rename failed)
        await pool.query(`
            ALTER TABLE recipient_signature_events
            ADD COLUMN IF NOT EXISTS recipient_timezone VARCHAR(100)
        `).catch(() => {});

        console.log('✅ Logging tables initialized');
    } catch (error) {
        console.error('Error initializing logging tables:', error);
    }
}

// Initialize on startup
initializeLoggingTables();

/**
 * POST /api/recipient-logs/connection
 * Log wallet connection to BlockServed
 */
router.post('/connection', async (req, res) => {
    try {
        const { wallet_address, session_id, browser_info, timezone, visitor_id, fingerprint, fingerprint_confidence } = req.body;
        const clientTimezone = timezone || req.headers['x-timezone'] || browser_info?.timezone || null;
        const visitorId = visitor_id || req.headers['x-visitor-id'] || null;

        // Extract fingerprint from request body or headers
        const browserFingerprint = fingerprint || req.headers['x-fingerprint'] || browser_info?.fingerprint?.hash || null;
        const fpConfidence = fingerprint_confidence || parseInt(req.headers['x-fingerprint-confidence']) || browser_info?.fingerprint?.confidence || 0;

        // Extract forensic data from browser_info
        const forensics = browser_info?.forensics || {};
        const languagePrefs = browser_info?.languagePreferences || {};
        const fingerprintDetails = browser_info?.fingerprint || {};
        
        // Get IP address - use clientIp set by middleware (includes Cloudflare headers)
        const ipAddress = req.clientIp || req.ip || 'unknown';

        // Extract clean IP - handle comma-separated list (take first) and IPv6-mapped IPv4
        let cleanIp = ipAddress.split(',')[0].trim();
        if (cleanIp.startsWith('::ffff:')) {
            cleanIp = cleanIp.substring(7);
        }
        
        // Try to get geolocation from IP (using free service)
        let ipGeolocation = null;
        try {
            const fetch = require('node-fetch');
            const geoResponse = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`);
            const geoData = await geoResponse.json();
            if (geoData.status === 'success') {
                ipGeolocation = {
                    country: geoData.country,
                    countryCode: geoData.countryCode,
                    region: geoData.regionName,
                    city: geoData.city,
                    zip: geoData.zip,
                    latitude: geoData.lat,
                    longitude: geoData.lon,
                    timezone: geoData.timezone,
                    isp: geoData.isp,
                    org: geoData.org
                };
            }
        } catch (geoError) {
            console.log('Could not get IP geolocation:', geoError.message);
        }
        
        // Enhanced browser info with geolocation, forensics, and fingerprint
        const enhancedBrowserInfo = {
            ...browser_info,
            ipGeolocation: ipGeolocation,
            headers: {
                acceptLanguage: req.headers['accept-language'],
                acceptEncoding: req.headers['accept-encoding'],
                accept: req.headers['accept'],
                referer: req.headers['referer'] || req.headers['referrer']
            },
            serverCaptured: {
                visitorId: visitorId,
                browserFingerprint: browserFingerprint,
                fingerprintConfidence: fpConfidence,
                fingerprintDetails: fingerprintDetails,
                isReturnVisitor: forensics.isReturnVisitor || false,
                visitCount: forensics.visitCount || 1,
                firstVisit: forensics.firstVisit || null,
                lastVisit: forensics.lastVisit || null,
                referrer: forensics.referrer || req.headers['referer'] || null,
                referrerDomain: forensics.referrerDomain || null,
                isDirectVisit: forensics.isDirectVisit || !req.headers['referer'],
                entryUrl: forensics.entryUrl || null,
                queryParams: forensics.queryParams || {},
                acceptLanguageHeader: req.headers['accept-language'],
                languages: languagePrefs.allLanguages || browser_info?.languages || [browser_info?.language]
            }
        };

        // Extract wallet provider info from browser_info
        const walletProvider = browser_info?.walletProvider || null;
        const walletVersion = browser_info?.walletVersion || null;
        const walletType = browser_info?.walletType || null;
        const walletNetwork = browser_info?.walletNetwork || null;
        const isInAppBrowser = browser_info?.isInAppBrowser || false;

        const result = await pool.query(`
            INSERT INTO recipient_connections (
                wallet_address,
                ip_address,
                user_agent,
                session_id,
                visitor_id,
                browser_info,
                recipient_timezone,
                is_return_visitor,
                visit_count,
                referrer_domain,
                accept_language,
                browser_fingerprint,
                fingerprint_confidence,
                wallet_provider,
                wallet_version,
                wallet_type,
                wallet_network,
                is_in_app_browser,
                connected_at_utc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW() AT TIME ZONE 'UTC')
            RETURNING id, connected_at, connected_at_utc
        `, [
            wallet_address,
            cleanIp,
            req.headers['user-agent'],
            session_id,
            visitorId,
            enhancedBrowserInfo,
            clientTimezone,
            forensics.isReturnVisitor || false,
            forensics.visitCount || 1,
            forensics.referrerDomain || null,
            req.headers['accept-language'] || null,
            browserFingerprint,
            fpConfidence,
            walletProvider,
            walletVersion,
            walletType,
            walletNetwork,
            isInAppBrowser
        ]);

        // Log with forensic info including fingerprint and wallet provider
        const isReturn = forensics.visitCount > 1 ? ' (RETURN VISITOR)' : ' (NEW VISITOR)';
        const fpInfo = browserFingerprint ? ` [FP: ${browserFingerprint.substring(0, 15)}... ${fpConfidence}%]` : '';
        const walletInfo = walletProvider ? ` [Wallet: ${walletProvider} ${walletVersion || ''}]` : '';
        console.log(`Wallet connected: ${wallet_address} from ${cleanIp} (${ipGeolocation?.city || 'Unknown'}, ${ipGeolocation?.country || 'Unknown'})${isReturn}${fpInfo}${walletInfo} at ${result.rows[0].connected_at}`);
        
        res.json({
            success: true,
            connection_id: result.rows[0].id,
            timestamp: result.rows[0].connected_at
        });
    } catch (error) {
        console.error('Error logging connection:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recipient-logs/notice-view
 * Log when a recipient views a notice
 */
router.post('/notice-view', async (req, res) => {
    try {
        const {
            case_number,
            wallet_address,
            action_type,
            session_id,
            view_duration_seconds,
            timezone
        } = req.body;

        const clientTimezone = timezone || req.clientTimezone || req.headers['x-timezone'] || null;

        await pool.query(`
            INSERT INTO recipient_notice_views (
                case_number,
                wallet_address,
                action_type,
                view_duration_seconds,
                ip_address,
                user_agent,
                session_id,
                recipient_timezone,
                viewed_at_utc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'UTC')
        `, [
            case_number,
            wallet_address,
            action_type || 'detail_view',
            view_duration_seconds,
            req.clientIp || req.ip,
            req.headers['user-agent'],
            session_id,
            clientTimezone
        ]);
        
        console.log(`Notice viewed: ${case_number} by ${wallet_address} (${action_type})`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error logging notice view:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recipient-logs/document-action
 * Log document actions (download, print, etc.)
 */
router.post('/document-action', async (req, res) => {
    try {
        const {
            case_number,
            wallet_address,
            action_type,
            timezone,
            metadata
        } = req.body;

        const clientTimezone = timezone || req.clientTimezone || req.headers['x-timezone'] || null;

        await pool.query(`
            INSERT INTO recipient_document_actions (
                case_number,
                wallet_address,
                action_type,
                ip_address,
                user_agent,
                recipient_timezone,
                metadata,
                action_at_utc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() AT TIME ZONE 'UTC')
        `, [
            case_number,
            wallet_address,
            action_type,
            req.clientIp || req.ip,
            req.headers['user-agent'],
            clientTimezone,
            metadata ? JSON.stringify(metadata) : null
        ]);
        
        console.log(`Document action: ${action_type} for ${case_number} by ${wallet_address}`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error logging document action:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recipient-logs/acknowledgment
 * Enhanced acknowledgment logging with legal compliance
 */
router.post('/acknowledgment', async (req, res) => {
    try {
        const {
            case_number,
            wallet_address,
            signature,
            geolocation,
            device_info,
            timezone
        } = req.body;

        const clientTimezone = timezone || req.headers['x-timezone'] || null;

        const result = await pool.query(`
            INSERT INTO recipient_acknowledgments (
                case_number,
                wallet_address,
                signature,
                ip_address,
                user_agent,
                geolocation,
                device_info,
                recipient_timezone,
                acknowledged_at_utc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'UTC')
            ON CONFLICT (case_number, wallet_address)
            DO UPDATE SET
                signature = EXCLUDED.signature,
                acknowledged_at = NOW(),
                acknowledged_at_utc = NOW() AT TIME ZONE 'UTC',
                recipient_timezone = EXCLUDED.recipient_timezone
            RETURNING acknowledged_at, acknowledged_at_utc
        `, [
            case_number,
            wallet_address,
            signature,
            req.clientIp || req.ip,
            req.headers['user-agent'],
            geolocation,
            device_info,
            clientTimezone
        ]);
        
        // Also update case_service_records to 'signed' status
        await pool.query(`
            UPDATE case_service_records
            SET status = 'signed',
                accepted = true,
                accepted_at = NOW(),
                updated_at = NOW()
            WHERE case_number = $1
        `, [case_number]);
        
        console.log(`Legal acknowledgment: ${case_number} by ${wallet_address} at ${result.rows[0].acknowledged_at}`);

        res.json({
            success: true,
            acknowledged_at: result.rows[0].acknowledged_at,
            legally_binding: true
        });
    } catch (error) {
        console.error('Error logging acknowledgment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recipient-logs/signature-event
 * Log signature-related events (initiated, declined, failed)
 * This provides forensic evidence of user intent and interaction
 */
router.post('/signature-event', async (req, res) => {
    try {
        const {
            case_number,
            wallet_address,
            event_type,
            session_id,
            timestamp,
            details
        } = req.body;

        // Get IP address - use clientIp set by middleware (includes Cloudflare headers)
        let ipAddress = req.clientIp || req.ip || 'unknown';
        // Handle comma-separated list and IPv6-mapped IPv4
        ipAddress = ipAddress.split(',')[0].trim();
        if (ipAddress.startsWith('::ffff:')) {
            ipAddress = ipAddress.substring(7);
        }

        // Get timezone from header
        const recipientTimezone = req.headers['x-timezone'] || details?.timezone || null;

        const result = await pool.query(`
            INSERT INTO recipient_signature_events (
                case_number,
                wallet_address,
                event_type,
                ip_address,
                user_agent,
                recipient_timezone,
                session_id,
                details,
                event_at_utc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'UTC')
            RETURNING id, event_at, event_at_utc
        `, [
            case_number,
            wallet_address,
            event_type,
            ipAddress,
            req.headers['user-agent'],
            recipientTimezone,
            session_id,
            details
        ]);

        // Log with appropriate icon based on event type
        const icons = {
            'signature_initiated': '🖊️',
            'signature_declined': '❌',
            'signature_failed': '⚠️',
            'signature_failed_no_funds': '💰',
            'signature_completed': '✅'
        };
        const icon = icons[event_type] || '📝';

        console.log(`${icon} Signature event: ${event_type} for case ${case_number} by ${wallet_address}`);

        // Also log to audit_logs for comprehensive audit trail
        try {
            await pool.query(`
                INSERT INTO audit_logs (action_type, actor_address, target_id, details, ip_address, user_agent, accept_language, timezone)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                event_type,
                wallet_address,
                case_number,
                JSON.stringify({
                    ...details,
                    session_id,
                    event_type,
                    original_timestamp: timestamp
                }),
                ipAddress,
                req.headers['user-agent'],
                req.headers['accept-language'],
                recipientTimezone
            ]);
        } catch (auditError) {
            console.log('Could not log to audit_logs:', auditError.message);
        }

        res.json({
            success: true,
            event_id: result.rows[0].id,
            event_at: result.rows[0].event_at
        });
    } catch (error) {
        console.error('Error logging signature event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/recipient-logs/activity/:wallet
 * Get all activity for a specific wallet (for server to query)
 */
router.get('/activity/:wallet', async (req, res) => {
    try {
        const { wallet } = req.params;
        
        // Get connections
        const connections = await pool.query(`
            SELECT * FROM recipient_connections 
            WHERE wallet_address = $1 
            ORDER BY connected_at DESC 
            LIMIT 10
        `, [wallet]);
        
        // Get notice views
        const views = await pool.query(`
            SELECT * FROM recipient_notice_views 
            WHERE wallet_address = $1 
            ORDER BY viewed_at DESC
        `, [wallet]);
        
        // Get document actions
        const actions = await pool.query(`
            SELECT * FROM recipient_document_actions 
            WHERE wallet_address = $1 
            ORDER BY action_at DESC
        `, [wallet]);
        
        // Get acknowledgments
        const acknowledgments = await pool.query(`
            SELECT * FROM recipient_acknowledgments
            WHERE wallet_address = $1
            ORDER BY acknowledged_at DESC
        `, [wallet]);

        // Get signature events
        const signatureEvents = await pool.query(`
            SELECT * FROM recipient_signature_events
            WHERE wallet_address = $1
            ORDER BY event_at DESC
        `, [wallet]);

        // Enhance records with formatted timestamps
        const enhancedConnections = enhanceRecordsWithTimestamps(connections.rows, 'connected_at');
        const enhancedViews = enhanceRecordsWithTimestamps(views.rows, 'viewed_at');
        const enhancedActions = enhanceRecordsWithTimestamps(actions.rows, 'action_at');
        const enhancedAcknowledgments = enhanceRecordsWithTimestamps(acknowledgments.rows, 'acknowledged_at');
        const enhancedSignatureEvents = enhanceRecordsWithTimestamps(signatureEvents.rows, 'event_at');

        res.json({
            success: true,
            wallet_address: wallet,
            activity: {
                connections: enhancedConnections,
                notice_views: enhancedViews,
                document_actions: enhancedActions,
                acknowledgments: enhancedAcknowledgments,
                signature_events: enhancedSignatureEvents,
                summary: {
                    total_connections: connections.rows.length,
                    total_views: views.rows.length,
                    total_actions: actions.rows.length,
                    total_acknowledgments: acknowledgments.rows.length,
                    signature_attempts: signatureEvents.rows.filter(e => e.event_type === 'signature_initiated').length,
                    signature_declines: signatureEvents.rows.filter(e => e.event_type === 'signature_declined').length,
                    last_seen: connections.rows[0]?.connected_at || null
                }
            }
        });
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/recipient-logs/case-activity/:caseNumber
 * Get all recipient activity for a specific case (for server to query)
 */
router.get('/case-activity/:caseNumber', async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        // Get all views for this case
        const views = await pool.query(`
            SELECT * FROM recipient_notice_views 
            WHERE case_number = $1 
            ORDER BY viewed_at DESC
        `, [caseNumber]);
        
        // Get all document actions for this case
        const actions = await pool.query(`
            SELECT * FROM recipient_document_actions 
            WHERE case_number = $1 
            ORDER BY action_at DESC
        `, [caseNumber]);
        
        // Get all acknowledgments for this case
        const acknowledgments = await pool.query(`
            SELECT * FROM recipient_acknowledgments
            WHERE case_number = $1
            ORDER BY acknowledged_at DESC
        `, [caseNumber]);

        // Get all signature events for this case
        const signatureEvents = await pool.query(`
            SELECT * FROM recipient_signature_events
            WHERE case_number = $1
            ORDER BY event_at DESC
        `, [caseNumber]);

        // Enhance records with formatted timestamps
        const enhancedViews = enhanceRecordsWithTimestamps(views.rows, 'viewed_at');
        const enhancedActions = enhanceRecordsWithTimestamps(actions.rows, 'action_at');
        const enhancedAcknowledgments = enhanceRecordsWithTimestamps(acknowledgments.rows, 'acknowledged_at');
        const enhancedSignatureEvents = enhanceRecordsWithTimestamps(signatureEvents.rows, 'event_at');

        res.json({
            success: true,
            case_number: caseNumber,
            activity: {
                views: enhancedViews,
                document_actions: enhancedActions,
                acknowledgments: enhancedAcknowledgments,
                signature_events: enhancedSignatureEvents,
                summary: {
                    total_views: views.rows.length,
                    unique_viewers: [...new Set(views.rows.map(v => v.wallet_address))].length,
                    total_acknowledgments: acknowledgments.rows.length,
                    signature_attempts: signatureEvents.rows.filter(e => e.event_type === 'signature_initiated').length,
                    signature_declines: signatureEvents.rows.filter(e => e.event_type === 'signature_declined').length,
                    signature_failures: signatureEvents.rows.filter(e => e.event_type.includes('failed')).length,
                    first_viewed: views.rows[views.rows.length - 1]?.viewed_at || null,
                    last_viewed: views.rows[0]?.viewed_at || null,
                    acknowledged: acknowledgments.rows.length > 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching case activity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;