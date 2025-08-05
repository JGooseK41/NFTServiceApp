const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(morgan('combined'));

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
    
    const query = `
      INSERT INTO notice_acceptances 
      (notice_id, acceptor_address, transaction_hash, ip_address, location_data, accepted_at, real_ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      noticeId,
      acceptorAddress,
      transactionHash,
      ipAddress || realIp,
      JSON.stringify(location),
      timestamp || new Date(),
      realIp
    ];
    
    const result = await pool.query(query, values);
    res.json({ success: true, acceptanceLog: result.rows[0] });
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

// Store additional notice metadata
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