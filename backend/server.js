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
  'https://blockserved.com',
  'http://localhost:8080',
  'http://localhost:3000'
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
  credentials: true
}));
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
    
    const query = `
      SELECT 
        wallet_address,
        agency_name,
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
      hasDocument
    } = req.body;

    const query = `
      INSERT INTO served_notices 
      (notice_id, alert_id, document_id, server_address, recipient_address, 
       notice_type, issuing_agency, case_number, document_hash, ipfs_hash, has_document)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (notice_id) 
      DO UPDATE SET 
        alert_id = EXCLUDED.alert_id,
        document_id = EXCLUDED.document_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      noticeId,
      alertId,
      documentId,
      serverAddress.toLowerCase(),
      recipientAddress.toLowerCase(),
      noticeType,
      issuingAgency,
      caseNumber,
      documentHash,
      ipfsHash,
      hasDocument
    ];

    const result = await pool.query(query, values);
    
    // Update process server stats
    await pool.query(`
      UPDATE process_servers 
      SET total_notices_served = total_notices_served + 1
      WHERE LOWER(wallet_address) = LOWER($1)
    `, [serverAddress]);
    
    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (action_type, actor_address, target_id, details, ip_address)
       VALUES ('notice_served', $1, $2, $3, $4)`,
      [serverAddress, noticeId, JSON.stringify({ recipientAddress, noticeType }), 
       req.headers['x-forwarded-for'] || req.connection.remoteAddress]
    );

    res.json({ success: true, servedNotice: result.rows[0] });
  } catch (error) {
    console.error('Error tracking served notice:', error);
    res.status(500).json({ error: 'Failed to track served notice' });
  }
});

// Get all notices for a process server with full status
app.get('/api/servers/:serverAddress/notices', async (req, res) => {
  try {
    const { serverAddress } = req.params;
    const { status, limit = 100 } = req.query;
    
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
      serverAddress.toLowerCase(),
      recipientAddress.toLowerCase(),
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

// Document management routes
const documentsRouter = require('./routes/documents');
app.use('/api/documents', documentsRouter);

// Notice management routes (new workflow-based)
const noticesRouter = require('./routes/notices');
app.use('/api/notices', noticesRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;