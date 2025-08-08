const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://nftservice:nftservice123@localhost:5432/nftservice_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ================================================
// WORKFLOW STAGE 1: PRE-CREATION
// ================================================

// Create a pending notice (before blockchain)
router.post('/pending', async (req, res) => {
  try {
    const {
      caseNumber,
      serverAddress,
      recipientAddress,
      recipientName,
      noticeType,
      issuingAgency,
      jurisdiction,
      documentFileUrl,
      documentThumbnailUrl,
      documentPreviewUrl,
      documentMetadata,
      alertNftDescription,
      documentNftDescription
    } = req.body;

    const query = `
      INSERT INTO pending_notices (
        case_number, server_address, recipient_address, recipient_name,
        notice_type, issuing_agency, jurisdiction,
        document_file_url, document_thumbnail_url, document_preview_url,
        document_metadata, alert_nft_description, document_nft_description,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
      RETURNING *
    `;

    const values = [
      caseNumber,
      serverAddress.toLowerCase(),
      recipientAddress?.toLowerCase(),
      recipientName,
      noticeType,
      issuingAgency,
      jurisdiction,
      documentFileUrl,
      documentThumbnailUrl,
      documentPreviewUrl,
      documentMetadata,
      alertNftDescription,
      documentNftDescription
    ];

    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      pendingNotice: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating pending notice:', error);
    res.status(500).json({ error: 'Failed to create pending notice' });
  }
});

// Update pending notice status
router.patch('/pending/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const query = `
      UPDATE pending_notices 
      SET status = $1, 
          ready_at = CASE WHEN $1 = 'ready' THEN CURRENT_TIMESTAMP ELSE ready_at END,
          sent_at = CASE WHEN $1 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending notice not found' });
    }

    res.json({
      success: true,
      pendingNotice: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating pending notice:', error);
    res.status(500).json({ error: 'Failed to update pending notice' });
  }
});

// ================================================
// WORKFLOW STAGE 2: DELIVERY (After blockchain send)
// ================================================

// Record notice delivery to blockchain
router.post('/delivered', async (req, res) => {
  try {
    const {
      pendingNoticeId,
      caseNumber,
      serverAddress,
      recipientAddress,
      alertId,
      alertTxHash,
      alertThumbnailUrl,
      alertNftDescription,
      alertTokenUri,
      documentId,
      documentTxHash,
      documentIpfsHash,
      documentEncryptionKey,
      documentUnencryptedUrl,
      noticeType,
      issuingAgency,
      jurisdiction,
      contractAddress
    } = req.body;

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Insert into active_notices
      const insertQuery = `
        INSERT INTO active_notices (
          pending_notice_id, case_number, server_address, recipient_address,
          alert_id, alert_tx_hash, alert_thumbnail_url, alert_nft_description,
          alert_token_uri, alert_delivered_at,
          document_id, document_tx_hash, document_ipfs_hash, 
          document_encryption_key, document_unencrypted_url, document_created_at,
          notice_type, issuing_agency, jurisdiction, contract_address
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP,
          $10, $11, $12, $13, $14, 
          CASE WHEN $10 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
          $15, $16, $17, $18
        )
        RETURNING *
      `;

      const values = [
        pendingNoticeId,
        caseNumber,
        serverAddress.toLowerCase(),
        recipientAddress.toLowerCase(),
        alertId,
        alertTxHash,
        alertThumbnailUrl,
        alertNftDescription,
        alertTokenUri,
        documentId,
        documentTxHash,
        documentIpfsHash,
        documentEncryptionKey,
        documentUnencryptedUrl,
        noticeType,
        issuingAgency,
        jurisdiction,
        contractAddress
      ];

      const result = await pool.query(insertQuery, values);
      const activeNotice = result.rows[0];

      // Update pending notice status
      if (pendingNoticeId) {
        await pool.query(
          'UPDATE pending_notices SET status = $1, sent_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['sent', pendingNoticeId]
        );
      }

      // Log event
      await pool.query(`
        INSERT INTO notice_events (
          notice_id, event_type, actor_address, actor_type, 
          details, transaction_hash
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        activeNotice.id,
        'sent_to_blockchain',
        serverAddress,
        'server',
        JSON.stringify({ alertId, documentId }),
        alertTxHash
      ]);

      await pool.query('COMMIT');

      res.json({
        success: true,
        notice: activeNotice
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error recording delivered notice:', error);
    res.status(500).json({ error: 'Failed to record delivered notice' });
  }
});

// ================================================
// WORKFLOW STAGE 3: ACKNOWLEDGMENT/SIGNATURE
// ================================================

// Record notice acknowledgment/signature
router.post('/:noticeId/acknowledge', async (req, res) => {
  try {
    const { noticeId } = req.params;
    const {
      acknowledgedBy,
      transactionHash,
      ipAddress,
      userAgent,
      locationData
    } = req.body;

    await pool.query('BEGIN');

    try {
      // Update active notice
      const updateQuery = `
        UPDATE active_notices 
        SET is_acknowledged = true,
            acknowledged_at = CURRENT_TIMESTAMP,
            acknowledgment_tx_hash = $1
        WHERE id = $2 OR alert_id = $2 OR document_id = $2
        RETURNING *
      `;

      const result = await pool.query(updateQuery, [transactionHash, noticeId]);
      
      if (result.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Notice not found' });
      }

      const notice = result.rows[0];

      // Log event
      await pool.query(`
        INSERT INTO notice_events (
          notice_id, event_type, actor_address, actor_type,
          ip_address, user_agent, location_data, details, transaction_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        notice.id,
        'acknowledged',
        acknowledgedBy.toLowerCase(),
        'recipient',
        ipAddress,
        userAgent,
        locationData,
        JSON.stringify({ timestamp: new Date() }),
        transactionHash
      ]);

      await pool.query('COMMIT');

      res.json({
        success: true,
        notice
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error recording acknowledgment:', error);
    res.status(500).json({ error: 'Failed to record acknowledgment' });
  }
});

// ================================================
// DATA RETRIEVAL ENDPOINTS
// ================================================

// Get notices for a server (with proper structure)
router.get('/server/:serverAddress', async (req, res) => {
  try {
    const { serverAddress } = req.params;
    const { limit = 100, offset = 0, groupByCases = false } = req.query;

    if (groupByCases === 'true') {
      // Return grouped by cases
      const query = `
        SELECT * FROM cases_summary 
        WHERE LOWER(server_address) = LOWER($1)
        ORDER BY last_served DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [serverAddress, limit, offset]);
      
      res.json({
        cases: result.rows,
        total: result.rows.length
      });
    } else {
      // Return individual notices
      const query = `
        SELECT 
          an.*,
          pn.document_file_url,
          pn.document_metadata,
          pn.recipient_name,
          (
            SELECT COUNT(*) 
            FROM notice_events ne 
            WHERE ne.notice_id = an.id AND ne.event_type = 'viewed'
          ) as view_count
        FROM active_notices an
        LEFT JOIN pending_notices pn ON an.pending_notice_id = pn.id
        WHERE LOWER(an.server_address) = LOWER($1)
        ORDER BY an.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [serverAddress, limit, offset]);

      // Get total count
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM served_notices WHERE LOWER(server_address) = LOWER($1)',
        [serverAddress]
      );

      res.json({
        notices: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }
  } catch (error) {
    console.error('Error fetching server notices:', error);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

// Get specific notice details
router.get('/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;

    const query = `
      SELECT 
        an.*,
        pn.document_file_url,
        pn.document_metadata,
        pn.recipient_name,
        pn.document_preview_url,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'event_type', ne.event_type,
              'occurred_at', ne.occurred_at,
              'actor_address', ne.actor_address,
              'details', ne.details
            ) ORDER BY ne.occurred_at DESC
          )
          FROM notice_events ne
          WHERE ne.notice_id = an.id
        ) as events
      FROM active_notices an
      LEFT JOIN pending_notices pn ON an.pending_notice_id = pn.id
      WHERE an.id = $1 OR an.alert_id = $1 OR an.document_id = $1
    `;

    const result = await pool.query(query, [noticeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching notice:', error);
    res.status(500).json({ error: 'Failed to fetch notice' });
  }
});

// Log notice view
router.post('/:noticeId/view', async (req, res) => {
  try {
    const { noticeId } = req.params;
    const {
      viewerAddress,
      ipAddress,
      userAgent,
      locationData
    } = req.body;

    // Find the notice
    const noticeResult = await pool.query(
      'SELECT id FROM active_notices WHERE id = $1 OR alert_id = $1 OR document_id = $1',
      [noticeId]
    );

    if (noticeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    const notice = noticeResult.rows[0];

    // Log view event
    await pool.query(`
      INSERT INTO notice_events (
        notice_id, event_type, actor_address, actor_type,
        ip_address, user_agent, location_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      notice.id,
      'viewed',
      viewerAddress?.toLowerCase(),
      viewerAddress ? 'viewer' : 'anonymous',
      ipAddress,
      userAgent,
      locationData
    ]);

    // Update view count and last viewed
    await pool.query(`
      UPDATE active_notices 
      SET view_count = view_count + 1,
          last_viewed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [notice.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging view:', error);
    res.status(500).json({ error: 'Failed to log view' });
  }
});

// Get audit trail for a notice
router.get('/:noticeId/audit', async (req, res) => {
  try {
    const { noticeId } = req.params;

    // Find the notice
    const noticeResult = await pool.query(
      'SELECT * FROM active_notices WHERE id = $1 OR alert_id = $1 OR document_id = $1',
      [noticeId]
    );

    if (noticeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    const notice = noticeResult.rows[0];

    // Get all events
    const eventsResult = await pool.query(`
      SELECT * FROM notice_events 
      WHERE notice_id = $1 
      ORDER BY occurred_at DESC
    `, [notice.id]);

    res.json({
      notice: notice,
      events: eventsResult.rows,
      summary: {
        total_views: eventsResult.rows.filter(e => e.event_type === 'viewed').length,
        acknowledged: notice.is_acknowledged,
        acknowledged_at: notice.acknowledged_at
      }
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

module.exports = router;