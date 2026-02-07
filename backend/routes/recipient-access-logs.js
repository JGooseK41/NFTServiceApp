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
    allowedHeaders: ['Content-Type', 'Authorization']
};

router.use(cors(corsOptions));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Create logging tables on startup
async function initializeLoggingTables() {
    try {
        // Table for wallet connections
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_connections (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(255) NOT NULL,
                connected_at TIMESTAMP DEFAULT NOW(),
                ip_address VARCHAR(45),
                user_agent TEXT,
                session_id VARCHAR(255),
                browser_info JSONB
            )
        `);
        
        // Table for notice views
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_notice_views (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                viewed_at TIMESTAMP DEFAULT NOW(),
                view_duration_seconds INTEGER,
                ip_address VARCHAR(45),
                user_agent TEXT,
                action_type VARCHAR(50), -- 'list_view', 'detail_view', 'document_open'
                session_id VARCHAR(255)
            )
        `);
        
        // Table for document downloads/prints
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_document_actions (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                action_type VARCHAR(50) NOT NULL, -- 'download', 'print', 'email'
                action_at TIMESTAMP DEFAULT NOW(),
                ip_address VARCHAR(45),
                user_agent TEXT,
                success BOOLEAN DEFAULT true,
                metadata JSONB
            )
        `);
        
        // Enhanced acknowledgments table with more details
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipient_acknowledgments (
                id SERIAL PRIMARY KEY,
                case_number VARCHAR(255) NOT NULL,
                wallet_address VARCHAR(255) NOT NULL,
                signature TEXT,
                acknowledged_at TIMESTAMP DEFAULT NOW(),
                ip_address VARCHAR(45),
                user_agent TEXT,
                geolocation JSONB,
                device_info JSONB,
                legally_binding BOOLEAN DEFAULT true,
                UNIQUE(case_number, wallet_address)
            )
        `);
        
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
        const { wallet_address, session_id, browser_info } = req.body;
        
        // Get IP address (handle proxies)
        const ipAddress = req.headers['x-forwarded-for'] || 
                         req.headers['x-real-ip'] || 
                         req.connection.remoteAddress ||
                         req.ip;
        
        // Extract clean IP if it includes port
        const cleanIp = ipAddress.includes(':') ? ipAddress.split(':').pop() : ipAddress;
        
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
        
        // Enhanced browser info with geolocation
        const enhancedBrowserInfo = {
            ...browser_info,
            ipGeolocation: ipGeolocation,
            headers: {
                acceptLanguage: req.headers['accept-language'],
                acceptEncoding: req.headers['accept-encoding'],
                accept: req.headers['accept']
            }
        };
        
        const result = await pool.query(`
            INSERT INTO recipient_connections (
                wallet_address,
                ip_address,
                user_agent,
                session_id,
                browser_info
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, connected_at
        `, [
            wallet_address,
            cleanIp,
            req.headers['user-agent'],
            session_id,
            enhancedBrowserInfo
        ]);
        
        console.log(`Wallet connected: ${wallet_address} from ${cleanIp} (${ipGeolocation?.city || 'Unknown'}, ${ipGeolocation?.country || 'Unknown'}) at ${result.rows[0].connected_at}`);
        
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
            view_duration_seconds 
        } = req.body;
        
        await pool.query(`
            INSERT INTO recipient_notice_views (
                case_number,
                wallet_address,
                action_type,
                view_duration_seconds,
                ip_address,
                user_agent,
                session_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            case_number,
            wallet_address,
            action_type || 'detail_view',
            view_duration_seconds,
            req.ip || req.connection.remoteAddress,
            req.headers['user-agent'],
            session_id
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
            metadata 
        } = req.body;
        
        await pool.query(`
            INSERT INTO recipient_document_actions (
                case_number,
                wallet_address,
                action_type,
                ip_address,
                user_agent,
                metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            case_number,
            wallet_address,
            action_type,
            req.ip || req.connection.remoteAddress,
            req.headers['user-agent'],
            metadata
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
            device_info 
        } = req.body;
        
        const result = await pool.query(`
            INSERT INTO recipient_acknowledgments (
                case_number,
                wallet_address,
                signature,
                ip_address,
                user_agent,
                geolocation,
                device_info
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (case_number, wallet_address) 
            DO UPDATE SET 
                signature = EXCLUDED.signature,
                acknowledged_at = NOW()
            RETURNING acknowledged_at
        `, [
            case_number,
            wallet_address,
            signature,
            req.ip || req.connection.remoteAddress,
            req.headers['user-agent'],
            geolocation,
            device_info
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
        
        res.json({
            success: true,
            wallet_address: wallet,
            activity: {
                connections: connections.rows,
                notice_views: views.rows,
                document_actions: actions.rows,
                acknowledgments: acknowledgments.rows,
                summary: {
                    total_connections: connections.rows.length,
                    total_views: views.rows.length,
                    total_actions: actions.rows.length,
                    total_acknowledgments: acknowledgments.rows.length,
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
        
        res.json({
            success: true,
            case_number: caseNumber,
            activity: {
                views: views.rows,
                document_actions: actions.rows,
                acknowledgments: acknowledgments.rows,
                summary: {
                    total_views: views.rows.length,
                    unique_viewers: [...new Set(views.rows.map(v => v.wallet_address))].length,
                    total_acknowledgments: acknowledgments.rows.length,
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