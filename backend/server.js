const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
// Allow multiple origins for CORS
const allowedOrigins = [
  'https://nft-legal-service.netlify.app',
  'https://theblockservice.com',
  'https://www.theblockservice.com',
  'https://blockserved.com',
  'https://www.blockserved.com',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Rejected CORS origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Server-Address'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Additional CORS headers for all responses (fallback)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Server-Address');
  }
  
  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  next();
});

app.use(express.json());
app.use(morgan('combined'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make pool available to routes
app.locals.pool = pool;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ======================
// VIEW TRACKING ENDPOINTS
// ======================

// Log when a notice is viewed
app.post('/api/notices/:noticeId/views', async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { 
      viewerAddress, 
      ipAddress,
      userAgent,
      location,
      timestamp 
    } = req.body;

    // Get actual IP if behind proxy
    const realIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    const query = `
      INSERT INTO notice_views 
      (notice_id, viewer_address, ip_address, user_agent, location_data, viewed_at, real_ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      noticeId,
      viewerAddress,
      ipAddress || realIp,
      userAgent || req.headers['user-agent'],
      JSON.stringify(location),
      timestamp || new Date(),
      realIp
    ];
    
    const result = await pool.query(query, values);
    res.json({ success: true, viewLog: result.rows[0] });
  } catch (error) {
    console.error('Error logging view:', error);
    res.status(500).json({ error: 'Failed to log view' });
  }
});

// Log when a notice is accepted
app.post('/api/notices/:noticeId/acceptances', async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { 
      acceptorAddress,
      transactionHash,
      ipAddress,
      location,
      timestamp 
    } = req.body;

    const realIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // First, log the acceptance
    const acceptanceQuery = `
      INSERT INTO notice_acceptances 
      (notice_id, acceptor_address, transaction_hash, ip_address, location_data, accepted_at, real_ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (notice_id) DO UPDATE SET
        transaction_hash = EXCLUDED.transaction_hash,
        ip_address = EXCLUDED.ip_address,
        location_data = EXCLUDED.location_data,
        accepted_at = EXCLUDED.accepted_at,
        real_ip = EXCLUDED.real_ip
      RETURNING *
    `;
    
    const acceptanceValues = [
      noticeId,
      acceptorAddress,
      transactionHash,
      ipAddress || realIp,
      JSON.stringify(location),
      timestamp || new Date(),
      realIp
    ];
    
    const acceptanceResult = await pool.query(acceptanceQuery, acceptanceValues);
    
    // Update the served_notices table to mark as accepted
    await pool.query(
      `UPDATE served_notices 
       SET accepted = true, 
           accepted_at = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE notice_id = $1`,
      [noticeId, timestamp || new Date()]
    );
    
    // Log this as an audit event
    await pool.query(
      `INSERT INTO audit_logs (action_type, actor_address, target_id, details, ip_address)
       VALUES ('notice_accepted', $1, $2, $3, $4)`,
      [acceptorAddress, noticeId, JSON.stringify({ transactionHash, location }), realIp]
    );
    
    res.json({ success: true, acceptanceLog: acceptanceResult.rows[0] });
  } catch (error) {
    console.error('Error logging acceptance:', error);
    res.status(500).json({ error: 'Failed to log acceptance' });
  }
});

// Get audit trail for a notice
app.get('/api/notices/:noticeId/audit', async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { serverAddress } = req.query;
    
    // Verify the requester is the process server who created the notice
    // In production, add proper authentication here
    
    // Get view logs
    const viewsQuery = `
      SELECT * FROM notice_views 
      WHERE notice_id = $1 
      ORDER BY viewed_at DESC
    `;
    const viewsResult = await pool.query(viewsQuery, [noticeId]);
    
    // Get acceptance logs
    const acceptancesQuery = `
      SELECT * FROM notice_acceptances 
      WHERE notice_id = $1 
      ORDER BY accepted_at DESC
    `;
    const acceptancesResult = await pool.query(acceptancesQuery, [noticeId]);
    
    res.json({
      noticeId,
      views: viewsResult.rows,
      acceptances: acceptancesResult.rows,
      summary: {
        totalViews: viewsResult.rows.length,
        uniqueViewers: new Set(viewsResult.rows.map(v => v.viewer_address)).size,
        accepted: acceptancesResult.rows.length > 0,
        firstViewedAt: viewsResult.rows[viewsResult.rows.length - 1]?.viewed_at,
        lastViewedAt: viewsResult.rows[0]?.viewed_at,
        acceptedAt: acceptancesResult.rows[0]?.accepted_at
      }
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

// ======================
// BLOCKCHAIN CACHE ENDPOINTS
// ======================

// Save blockchain data to cache
app.post('/api/cache/blockchain', async (req, res) => {
  try {
    const { type, id, data, network, contractAddress, timestamp } = req.body;
    
    // Create cache table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blockchain_cache (
        id SERIAL PRIMARY KEY,
        cache_key VARCHAR(255) UNIQUE,
        type VARCHAR(50),
        notice_id VARCHAR(100),
        data JSONB,
        network VARCHAR(50),
        contract_address VARCHAR(100),
        timestamp BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const cacheKey = `${contractAddress}_${type}_${id}`;
    
    const query = `
      INSERT INTO blockchain_cache (cache_key, type, notice_id, data, network, contract_address, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (cache_key) 
      DO UPDATE SET 
        data = EXCLUDED.data,
        timestamp = EXCLUDED.timestamp,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [cacheKey, type, id.toString(), JSON.stringify(data), network, contractAddress, timestamp];
    const result = await pool.query(query, values);
    
    res.json({ success: true, cached: result.rows[0] });
  } catch (error) {
    console.error('Error caching blockchain data:', error);
    res.status(500).json({ error: 'Failed to cache data' });
  }
});

// Get cached blockchain data
app.get('/api/cache/blockchain', async (req, res) => {
  try {
    const { contract } = req.query;
    
    // Create table if doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blockchain_cache (
        id SERIAL PRIMARY KEY,
        cache_key VARCHAR(255) UNIQUE,
        type VARCHAR(50),
        notice_id VARCHAR(100),
        data JSONB,
        network VARCHAR(50),
        contract_address VARCHAR(100),
        timestamp BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const query = `
      SELECT type, notice_id as id, data, timestamp 
      FROM blockchain_cache 
      WHERE contract_address = $1 
      AND timestamp > $2
      ORDER BY updated_at DESC
    `;
    
    // Only return cache from last 30 minutes
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    const result = await pool.query(query, [contract, thirtyMinutesAgo]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cached data:', error);
    res.status(500).json({ error: 'Failed to fetch cache' });
  }
});

// Clear cache for a specific contract
app.delete('/api/cache/blockchain/:contract', async (req, res) => {
  try {
    const { contract } = req.params;
    
    const query = 'DELETE FROM blockchain_cache WHERE contract_address = $1';
    const result = await pool.query(query, [contract]);
    
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// ======================
// PROCESS SERVER REGISTRY
// ======================

// Register a new process server
app.post('/api/process-servers', async (req, res) => {
  try {
    const { 
      walletAddress,
      agencyName,
      contactEmail,
      phoneNumber,
      website,
      licenseNumber,
      jurisdictions,
      verificationDocuments 
    } = req.body;
    
    const query = `
      INSERT INTO process_servers 
      (wallet_address, agency_name, contact_email, phone_number, website, 
       license_number, jurisdictions, verification_documents, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      ON CONFLICT (wallet_address) 
      DO UPDATE SET 
        agency_name = EXCLUDED.agency_name,
        contact_email = EXCLUDED.contact_email,
        phone_number = EXCLUDED.phone_number,
        website = EXCLUDED.website,
        license_number = EXCLUDED.license_number,
        jurisdictions = EXCLUDED.jurisdictions,
        verification_documents = EXCLUDED.verification_documents,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      walletAddress.toLowerCase(),
      agencyName,
      contactEmail,
      phoneNumber,
      website,
      licenseNumber,
      JSON.stringify(jurisdictions),
      JSON.stringify(verificationDocuments)
    ];
    
    const result = await pool.query(query, values);
    res.json({ success: true, processServer: result.rows[0] });
  } catch (error) {
    console.error('Error registering process server:', error);
    res.status(500).json({ error: 'Failed to register process server' });
  }
});

// Get approved process servers
app.get('/api/process-servers', async (req, res) => {
  try {
    const { status = 'approved' } = req.query;
    
    // Check which column exists to avoid errors
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'process_servers' 
      AND column_name IN ('agency', 'agency_name')
    `);
    
    const columns = columnCheck.rows.map(r => r.column_name);
    const agencyColumn = columns.includes('agency_name') ? 'agency_name' : 
                        columns.includes('agency') ? 'agency' : 'NULL';
    
    const query = `
      SELECT 
        wallet_address,
        ${agencyColumn} as agency_name,
        contact_email,
        phone_number,
        website,
        jurisdictions,
        created_at,
        total_notices_served,
        average_rating
      FROM process_servers 
      WHERE status = $1
      ORDER BY average_rating DESC, total_notices_served DESC
    `;
    
    const result = await pool.query(query, [status]);
    res.json({ processServers: result.rows });
  } catch (error) {
    console.error('Error fetching process servers:', error);
    res.status(500).json({ error: 'Failed to fetch process servers' });
  }
});

// Get process server details
app.get('/api/process-servers/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const query = `
      SELECT * FROM process_servers 
      WHERE LOWER(wallet_address) = LOWER($1)
    `;
    
    const result = await pool.query(query, [walletAddress]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process server not found' });
    }
    
    // Get recent notices served by this server
    const noticesQuery = `
      SELECT 
        notice_id,
        created_at,
        recipient_jurisdiction,
        notice_type,
        accepted
      FROM served_notices 
      WHERE LOWER(server_address) = LOWER($1)
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const noticesResult = await pool.query(noticesQuery, [walletAddress]);
    
    res.json({ 
      processServer: result.rows[0],
      recentNotices: noticesResult.rows
    });
  } catch (error) {
    console.error('Error fetching process server details:', error);
    res.status(500).json({ error: 'Failed to fetch process server details' });
  }
});

// ======================
// NOTICE METADATA
// ======================

// Track a newly served notice
app.post('/api/notices/served', async (req, res) => {
  try {
    const {
      noticeId,
      alertId,
      documentId,
      serverAddress,
      recipientAddress,
      noticeType,
      issuingAgency,
      caseNumber,
      documentHash,
      ipfsHash,
      hasDocument,
      compiledDocumentId,
      compiledDocumentUrl,
      compiledThumbnailUrl,
      pageCount
    } = req.body;

    console.log('Recording served notice:', {
      noticeId,
      alertId,
      documentId,
      serverAddress,
      recipientAddress,
      caseNumber,
      noticeType,
      issuingAgency
    });

    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS served_notices (
        id SERIAL PRIMARY KEY,
        notice_id VARCHAR(100) UNIQUE,
        alert_id VARCHAR(100),
        document_id VARCHAR(100),
        server_address VARCHAR(100),
        recipient_address VARCHAR(100),
        notice_type VARCHAR(100),
        issuing_agency VARCHAR(200),
        case_number VARCHAR(100),
        document_hash TEXT,
        ipfs_hash TEXT,
        has_document BOOLEAN DEFAULT false,
        accepted BOOLEAN DEFAULT false,
        accepted_at TIMESTAMP,
        recipient_jurisdiction VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const query = `
      INSERT INTO served_notices 
      (notice_id, alert_id, document_id, server_address, recipient_address, 
       notice_type, issuing_agency, case_number, document_hash, ipfs_hash, has_document)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (notice_id) 
      DO UPDATE SET 
        alert_id = COALESCE(EXCLUDED.alert_id, served_notices.alert_id),
        document_id = COALESCE(EXCLUDED.document_id, served_notices.document_id),
        server_address = COALESCE(EXCLUDED.server_address, served_notices.server_address),
        recipient_address = COALESCE(EXCLUDED.recipient_address, served_notices.recipient_address),
        case_number = COALESCE(EXCLUDED.case_number, served_notices.case_number),
        issuing_agency = COALESCE(EXCLUDED.issuing_agency, served_notices.issuing_agency),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      noticeId,
      alertId || null,
      documentId || null,
      serverAddress || null,  // Keep original case for TRON addresses
      recipientAddress || null,  // Keep original case for TRON addresses
      noticeType || 'Legal Notice',
      issuingAgency || '',
      caseNumber || '',
      documentHash || '',
      ipfsHash || '',
      hasDocument || false
    ];

    let result;
    try {
      result = await pool.query(query, values);
      console.log('Notice saved successfully:', result.rows[0]);
    } catch (dbError) {
      // If insert fails due to duplicate, try to get the existing record
      if (dbError.code === '23505') { // Unique violation
        console.log('Notice already exists, returning existing record');
        const existingResult = await pool.query(
          'SELECT * FROM served_notices WHERE notice_id = $1',
          [noticeId]
        );
        if (existingResult.rows.length > 0) {
          return res.json({ success: true, servedNotice: existingResult.rows[0], message: 'Notice already exists' });
        }
      }
      throw dbError;
    }
    
    // Update process server stats only if we have a server address
    if (serverAddress) {
      await pool.query(`
        UPDATE process_servers 
        SET total_notices_served = total_notices_served + 1
        WHERE LOWER(wallet_address) = LOWER($1)
      `, [serverAddress]).catch(err => {
        console.warn('Could not update process server stats:', err.message);
      });
    }
    
    // Log audit event
    if (serverAddress) {
      await pool.query(
        `INSERT INTO audit_logs (action_type, actor_address, target_id, details, ip_address)
         VALUES ('notice_served', $1, $2, $3, $4)`,
        [serverAddress, noticeId, JSON.stringify({ recipientAddress, noticeType }), 
         req.headers['x-forwarded-for'] || req.connection.remoteAddress]
      ).catch(err => {
        console.warn('Could not log audit event:', err.message);
      });
    }

    res.json({ success: true, servedNotice: result.rows[0] });
  } catch (error) {
    console.error('Error tracking served notice:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to track served notice' });
  }
});

// Debug endpoint to get ALL notices (regardless of server)
app.get('/api/notices/all', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const query = `
      SELECT * FROM served_notices 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    res.json({ 
      notices: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching all notices:', error);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

// Get all notices for a process server with full status
app.get('/api/servers/:serverAddress/notices', async (req, res) => {
  try {
    const { serverAddress } = req.params;
    const { status, limit = 100 } = req.query;
    
    console.log(`Fetching notices for server: ${serverAddress}`);
    
    let query = `
      SELECT 
        sn.*,
        COUNT(DISTINCT nv.id) as view_count,
        MAX(nv.viewed_at) as last_viewed_at,
        na.accepted_at as acceptance_timestamp,
        na.transaction_hash as acceptance_tx_hash,
        na.ip_address as acceptance_ip,
        na.location_data as acceptance_location
      FROM served_notices sn
      LEFT JOIN notice_views nv ON nv.notice_id = sn.notice_id
      LEFT JOIN notice_acceptances na ON na.notice_id = sn.notice_id
      WHERE LOWER(sn.server_address) = LOWER($1)
    `;
    
    const queryParams = [serverAddress];
    
    // Add status filter if provided
    if (status === 'accepted') {
      query += ' AND sn.accepted = true';
    } else if (status === 'pending') {
      query += ' AND sn.accepted = false';
    }
    
    query += `
      GROUP BY sn.id, na.accepted_at, na.transaction_hash, na.ip_address, na.location_data
      ORDER BY sn.created_at DESC
      LIMIT $2
    `;
    
    queryParams.push(limit);
    
    const result = await pool.query(query, queryParams);
    
    console.log(`Found ${result.rows.length} notices for server ${serverAddress}`);
    
    // Calculate summary statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_notices,
        COUNT(CASE WHEN accepted = true THEN 1 END) as accepted_count,
        COUNT(CASE WHEN accepted = false THEN 1 END) as pending_count
      FROM served_notices
      WHERE LOWER(server_address) = LOWER($1)
    `, [serverAddress]);
    
    // Map created_at to served_at for frontend compatibility
    const mappedNotices = result.rows.map(notice => ({
      ...notice,
      served_at: notice.created_at || notice.updated_at
    }));
    
    // Log a sample of the notices for debugging
    if (mappedNotices.length > 0) {
      console.log('Sample notice:', {
        notice_id: mappedNotices[0].notice_id,
        case_number: mappedNotices[0].case_number,
        server_address: mappedNotices[0].server_address,
        recipient_address: mappedNotices[0].recipient_address
      });
    }
    
    res.json({ 
      notices: mappedNotices,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching server notices:', error);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

// Store additional notice metadata (legacy endpoint, kept for compatibility)
app.post('/api/notices/:noticeId/metadata', async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { 
      serverAddress,
      recipientAddress,
      noticeType,
      jurisdiction,
      caseNumber,
      documentHash
    } = req.body;
    
    const query = `
      INSERT INTO served_notices 
      (notice_id, server_address, recipient_address, notice_type, 
       recipient_jurisdiction, case_number, document_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (notice_id) DO UPDATE SET
        recipient_jurisdiction = EXCLUDED.recipient_jurisdiction,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      noticeId,
      serverAddress,  // Keep original case for TRON addresses
      recipientAddress,  // Keep original case for TRON addresses
      noticeType,
      jurisdiction,
      caseNumber,
      documentHash
    ];
    
    const result = await pool.query(query, values);
    
    // Update process server stats
    await pool.query(`
      UPDATE process_servers 
      SET total_notices_served = total_notices_served + 1
      WHERE LOWER(wallet_address) = LOWER($1)
    `, [serverAddress]);
    
    res.json({ success: true, metadata: result.rows[0] });
  } catch (error) {
    console.error('Error storing notice metadata:', error);
    res.status(500).json({ error: 'Failed to store notice metadata' });
  }
});

// ======================
// WALLET CONNECTION TRACKING
// ======================

// Track wallet connections and queries
app.post('/api/wallet-connections', async (req, res) => {
  try {
    const {
      walletAddress,
      eventType,
      ipAddress,
      location,
      userAgent,
      site
    } = req.body;

    const realIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Log the connection
    const result = await pool.query(
      `INSERT INTO wallet_connections 
      (wallet_address, event_type, ip_address, real_ip, user_agent, location_data, site)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        walletAddress.toLowerCase(),
        eventType,
        ipAddress || realIp,
        realIp,
        userAgent,
        JSON.stringify(location),
        site
      ]
    );

    // Check how many notices this wallet has
    const noticeCount = await pool.query(
      `SELECT COUNT(*) as count 
       FROM served_notices 
       WHERE LOWER(recipient_address) = LOWER($1)`,
      [walletAddress]
    );

    // Update notice count
    await pool.query(
      `UPDATE wallet_connections 
       SET notice_count = $1 
       WHERE id = $2`,
      [noticeCount.rows[0].count, result.rows[0].id]
    );

    // Log to audit trail
    await pool.query(
      `INSERT INTO audit_logs (action_type, actor_address, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventType, walletAddress, null, JSON.stringify({ site, location }), realIp]
    );

    res.json({ 
      success: true, 
      connectionId: result.rows[0].id,
      noticeCount: noticeCount.rows[0].count 
    });
  } catch (error) {
    console.error('Error tracking wallet connection:', error);
    res.status(500).json({ error: 'Failed to track wallet connection' });
  }
});

// Log when notices are found for a connected wallet
app.post('/api/wallet-connections/notices-found', async (req, res) => {
  try {
    const { walletAddress, noticeIds } = req.body;

    // Update the latest connection for this wallet
    await pool.query(
      `UPDATE wallet_connections 
       SET notice_count = $1 
       WHERE wallet_address = $2 
       AND connected_at = (
         SELECT MAX(connected_at) 
         FROM wallet_connections 
         WHERE wallet_address = $2
       )`,
      [noticeIds.length, walletAddress.toLowerCase()]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating wallet notices:', error);
    res.status(500).json({ error: 'Failed to update wallet notices' });
  }
});

// Get wallet connection history for a specific wallet
app.get('/api/wallets/:walletAddress/connections', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const connections = await pool.query(
      `SELECT * FROM wallet_connections 
       WHERE LOWER(wallet_address) = LOWER($1) 
       ORDER BY connected_at DESC 
       LIMIT 100`,
      [walletAddress]
    );

    res.json(connections.rows);
  } catch (error) {
    console.error('Error fetching wallet connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Document management routes - Using persistent database storage
// This prevents document loss on Render deployments
// Use unified document storage in notice_components table
const documentsUnifiedRouter = require('./routes/documents-unified');
app.use('/api/documents', documentsUnifiedRouter);

// Token Registry - Comprehensive token tracking system
const tokenRegistryRouter = require('./routes/token-registry');
app.use('/api/tokens', tokenRegistryRouter);

// Audit Tracking - Complete recipient interaction tracking
const auditTrackingRouter = require('./routes/audit-tracking');
app.use('/api/audit', auditTrackingRouter);

// Document Access Control - Ensure only recipients can view documents
const documentAccessControlRouter = require('./routes/document-access-control');
app.use('/api/access', documentAccessControlRouter);

// Fallback to original documents router for backward compatibility
// const documentsRouter = require('./routes/documents');
// app.use('/api/documents-legacy', documentsRouter);

// Batch document upload routes - using fixed version with better transaction handling
const batchRouter = require('./routes/batch-documents-fixed');
app.use('/api/batch', batchRouter);

// Transaction validation routes - validate BEFORE renting energy
const validatorRouter = require('./routes/transaction-validator');
app.use('/api/validate', validatorRouter);

// Transaction staging routes - backend as single source of truth
console.log('Loading staging router...');
try {
    const stagingRouter = require('./routes/transaction-staging');
    app.use('/api/stage', stagingRouter);
    console.log('✅ Staging router loaded successfully');
} catch (error) {
    console.error('❌ Failed to load staging router:', error.message);
    console.error('Stack:', error.stack);
}

// Drafts routes - save and resume NFT creation
console.log('Loading drafts router...');
try {
    const draftsRouter = require('./routes/drafts');
    app.use('/api/drafts', draftsRouter);
    console.log('✅ Drafts router loaded successfully');
} catch (error) {
    console.error('❌ Failed to load drafts router:', error.message);
}

// Quick CORS test endpoint at server level
app.get('/api/cors-test', (req, res) => {
    console.log('CORS test endpoint hit from:', req.headers.origin);
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Server-Address');
    }
    res.json({ 
        success: true, 
        message: 'Server-level CORS test',
        origin: origin,
        timestamp: new Date().toISOString(),
        version: '2024.08.11.01'
    });
});

// Migration routes (for database updates)
const migrationsRouter = require('./routes/migrations');
app.use('/api/migrations', migrationsRouter);

// Notice management routes (new workflow-based)
const noticesRouter = require('./routes/notices');
app.use('/api/notices', noticesRouter);

// Notice view tracking routes (for recipient view-only access)
const noticeViewsRouter = require('./routes/notice-views');
app.use('/api/notices', noticeViewsRouter);

// Case management routes (unified system)
const casesRouter = require('./routes/cases');
app.use('/api', casesRouter);

// Simple cases route (no joins)
const simpleCasesRouter = require('./routes/simple-cases');
app.use('/api', simpleCasesRouter);

// Blockchain sync routes
const blockchainSyncRouter = require('./routes/blockchain-sync');
app.use('/api', blockchainSyncRouter);

// Audit log routes
const auditRouter = require('./routes/audit');
app.use('/api/audit', auditRouter);

// Notice images routes (for process servers to view unencrypted images)
const noticeImagesRouter = require('./routes/notice-images');
app.use('/', noticeImagesRouter);

// Recipient access routes (public notice info and view logging)
const recipientAccessRouter = require('./routes/recipient-access');
app.use('/api/notices', recipientAccessRouter);
console.log('✅ Recipient access routes loaded');

// Complete document storage routes (dual IPFS + backend)
const documentsCompleteRouter = require('./routes/documents-complete');
app.use('/api/documents', documentsCompleteRouter);
console.log('✅ Complete document storage routes loaded');

// Admin dashboard routes
const adminDashboardRouter = require('./routes/admin-dashboard');
app.use('/api/admin', adminDashboardRouter);
console.log('✅ Admin dashboard routes loaded');

// Server registration routes
const serverRegistrationRouter = require('./routes/server-registration');
app.use('/', serverRegistrationRouter);

// Process servers management routes (admin dashboard)
try {
    const processServersRouter = require('./routes/process-servers');
    app.use('/api/process-servers', processServersRouter);
    console.log('✅ Process servers router loaded successfully');
} catch (error) {
    console.error('❌ Failed to load process servers router:', error.message);
}

// Admin process servers routes (simple version for dashboard)
try {
    const adminProcessServers = require('./routes/admin-process-servers');
    app.use('/api/admin/process-servers', adminProcessServers);
    console.log('✅ Admin process servers router loaded');
} catch (error) {
    console.warn('⚠️ Could not load admin process servers router:', error.message);
}

// Notice staging routes (for blockchain data flow)
try {
    const noticeStagingRouter = require('./routes/notice-staging');
    app.use('/api/notices', noticeStagingRouter);
    console.log('✅ Notice staging router loaded');
} catch (error) {
    console.warn('⚠️ Could not load notice staging router:', error.message);
}

// Migration route for process servers table
try {
    const migrateProcessServers = require('./routes/migrate-process-servers');
    app.use('/api/migrate-process-servers', migrateProcessServers);
    console.log('✅ Process servers migration route loaded');
} catch (error) {
    console.error('❌ Failed to load migration route:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database tables on startup
async function initializeDatabase() {
  try {
    console.log('Initializing database tables...');
    
    // Create all required tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS served_notices (
        id SERIAL PRIMARY KEY,
        notice_id VARCHAR(100) UNIQUE,
        alert_id VARCHAR(100),
        document_id VARCHAR(100),
        server_address VARCHAR(100),
        recipient_address VARCHAR(100),
        notice_type VARCHAR(100),
        issuing_agency VARCHAR(200),
        case_number VARCHAR(100),
        document_hash TEXT,
        ipfs_hash TEXT,
        has_document BOOLEAN DEFAULT false,
        accepted BOOLEAN DEFAULT false,
        accepted_at TIMESTAMP,
        recipient_jurisdiction VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notice_views (
        id SERIAL PRIMARY KEY,
        notice_id VARCHAR(100),
        viewer_address VARCHAR(100),
        ip_address VARCHAR(100),
        user_agent TEXT,
        location_data JSONB,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        real_ip VARCHAR(100)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notice_acceptances (
        id SERIAL PRIMARY KEY,
        notice_id VARCHAR(100) UNIQUE,
        acceptor_address VARCHAR(100),
        transaction_hash VARCHAR(100),
        ip_address VARCHAR(100),
        location_data JSONB,
        accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        real_ip VARCHAR(100)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action_type VARCHAR(100),
        actor_address VARCHAR(100),
        target_id VARCHAR(100),
        details JSONB,
        ip_address VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_servers (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(100) UNIQUE,
        agency_name VARCHAR(200),
        contact_email VARCHAR(200),
        phone_number VARCHAR(50),
        website VARCHAR(200),
        license_number VARCHAR(100),
        jurisdictions JSONB,
        verification_documents JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        total_notices_served INTEGER DEFAULT 0,
        average_rating DECIMAL(3,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_connections (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(100),
        event_type VARCHAR(100),
        ip_address VARCHAR(100),
        real_ip VARCHAR(100),
        user_agent TEXT,
        location_data JSONB,
        site VARCHAR(200),
        notice_count INTEGER DEFAULT 0,
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blockchain_cache (
        id SERIAL PRIMARY KEY,
        cache_key VARCHAR(255) UNIQUE,
        type VARCHAR(50),
        notice_id VARCHAR(100),
        data JSONB,
        network VARCHAR(50),
        contract_address VARCHAR(100),
        timestamp BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create tables required by notices routes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_notices (
        id SERIAL PRIMARY KEY,
        case_number VARCHAR(100),
        server_address VARCHAR(100),
        recipient_address VARCHAR(100),
        recipient_name VARCHAR(200),
        notice_type VARCHAR(100),
        issuing_agency VARCHAR(200),
        jurisdiction VARCHAR(100),
        document_file_url TEXT,
        document_thumbnail_url TEXT,
        document_preview_url TEXT,
        document_metadata JSONB,
        alert_nft_description TEXT,
        document_nft_description TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        ready_at TIMESTAMP,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS active_notices (
        id SERIAL PRIMARY KEY,
        pending_notice_id INTEGER,
        notice_id VARCHAR(100) UNIQUE,
        alert_id VARCHAR(100),
        document_id VARCHAR(100),
        server_address VARCHAR(100),
        recipient_address VARCHAR(100),
        notice_type VARCHAR(100),
        issuing_agency VARCHAR(200),
        case_number VARCHAR(100),
        document_hash TEXT,
        ipfs_hash TEXT,
        has_document BOOLEAN DEFAULT false,
        accepted BOOLEAN DEFAULT false,
        accepted_at TIMESTAMP,
        alert_tx_hash VARCHAR(100),
        alert_thumbnail_url TEXT,
        alert_nft_description TEXT,
        alert_token_uri TEXT,
        alert_delivered_at TIMESTAMP,
        document_tx_hash VARCHAR(100),
        document_ipfs_hash TEXT,
        document_encryption_key TEXT,
        document_unencrypted_url TEXT,
        document_created_at TIMESTAMP,
        contract_address VARCHAR(100),
        is_acknowledged BOOLEAN DEFAULT false,
        acknowledged_at TIMESTAMP,
        acknowledgment_tx_hash VARCHAR(100),
        view_count INTEGER DEFAULT 0,
        last_viewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notice_events (
        id SERIAL PRIMARY KEY,
        notice_id INTEGER,
        event_type VARCHAR(100),
        actor_address VARCHAR(100),
        actor_type VARCHAR(50),
        ip_address VARCHAR(100),
        user_agent TEXT,
        location_data JSONB,
        details JSONB,
        transaction_hash VARCHAR(100),
        occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '2024.08.11.02',
        timestamp: new Date().toISOString(),
        port: PORT,
        env: process.env.NODE_ENV || 'development'
    });
});

// Transaction Tracking Routes
const transactionRoutes = require('./routes/transaction-tracking');
app.use('/api/transactions', transactionRoutes);

// Mobile Document Viewer API Endpoints
app.post('/api/documents/view/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { recipientAddress, signed = false } = req.body;
    
    console.log(`📱 Mobile document view request: ${noticeId} by ${recipientAddress}`);
    
    // Verify recipient is authorized to view this document
    const noticeQuery = await pool.query(
      'SELECT * FROM blockchain_data WHERE notice_id = $1 AND recipient_address = $2',
      [noticeId, recipientAddress]
    );
    
    if (noticeQuery.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - you are not authorized to view this document'
      });
    }
    
    const notice = noticeQuery.rows[0];
    
    // Return document URL (unencrypted for authenticated users)
    res.json({
      success: true,
      documentUrl: notice.document_url || notice.preview_image,
      imageUrl: notice.preview_image,
      noticeType: notice.notice_type,
      caseNumber: notice.case_number,
      issuingAgency: notice.issuing_agency,
      timestamp: notice.created_at,
      signed: signed
    });
    
  } catch (error) {
    console.error('Mobile document view error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve document'
    });
  }
});

// Audit logging endpoint
app.post('/api/audit/log', async (req, res) => {
  try {
    const { action, notice_id, user_address, details } = req.body;
    
    console.log(`📋 Audit log: ${action} by ${user_address}`);
    
    // Log to audit table
    await pool.query(
      `INSERT INTO audit_trail (action, notice_id, user_address, details, occurred_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [action, notice_id, user_address, JSON.stringify(details)]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Audit logging error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log audit entry'
    });
  }
});

// Initialize blockchain sync service
let blockchainSync;
async function initializeBlockchainSync() {
  try {
    if (process.env.CONTRACT_ADDRESS) {
      blockchainSync = require('./services/blockchain-sync');
      await blockchainSync.initialize();
      console.log('✅ Blockchain sync service initialized');
    } else {
      console.log('⚠️ CONTRACT_ADDRESS not set, blockchain sync disabled');
    }
  } catch (error) {
    console.error('Failed to initialize blockchain sync:', error);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Server version: 2024.08.11.02');
  
  // Initialize database tables
  await initializeDatabase();
  
  // Initialize blockchain sync
  await initializeBlockchainSync();
});

module.exports = app;