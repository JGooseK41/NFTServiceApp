const express = require('express');
const router = express.Router();

/**
 * Audit Log API
 * Tracks all notice service attempts, including failures
 */

// Log a notice attempt
router.post('/log', async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const {
      sender_address,
      recipient_address,
      notice_type,
      case_number,
      status, // 'attempt', 'success', 'failed', 'validation_error', 'energy_error', 'ipfs_error', 'blockchain_error'
      error_message,
      error_code,
      transaction_hash,
      gas_used,
      fee_paid,
      document_hash,
      ipfs_hash,
      metadata,
      client_ip,
      user_agent
    } = req.body;

    // Get client IP and user agent from request
    const actualClientIp = client_ip || req.ip || req.connection.remoteAddress;
    const actualUserAgent = user_agent || req.get('user-agent');

    const query = `
      INSERT INTO audit_logs (
        sender_address,
        recipient_address,
        notice_type,
        case_number,
        status,
        error_message,
        error_code,
        transaction_hash,
        gas_used,
        fee_paid,
        document_hash,
        ipfs_hash,
        metadata,
        client_ip,
        user_agent,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      RETURNING *
    `;

    const values = [
      sender_address,
      recipient_address,
      notice_type,
      case_number,
      status,
      error_message,
      error_code,
      transaction_hash,
      gas_used,
      fee_paid,
      document_hash,
      ipfs_hash,
      JSON.stringify(metadata || {}),
      actualClientIp,
      actualUserAgent
    ];

    const result = await pool.query(query, values);
    
    res.json({ 
      success: true, 
      auditId: result.rows[0].id,
      message: 'Audit log entry created'
    });

  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create audit log',
      details: error.message 
    });
  }
});

// Get audit logs with filtering
router.get('/logs', async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const {
      sender_address,
      recipient_address,
      status,
      start_date,
      end_date,
      limit = 100,
      offset = 0,
      order = 'DESC'
    } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const values = [];
    let paramCount = 0;

    if (sender_address) {
      paramCount++;
      query += ` AND sender_address = $${paramCount}`;
      values.push(sender_address);
    }

    if (recipient_address) {
      paramCount++;
      query += ` AND recipient_address = $${paramCount}`;
      values.push(recipient_address);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(status);
    }

    if (start_date) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      values.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      values.push(end_date);
    }

    query += ` ORDER BY created_at ${order === 'ASC' ? 'ASC' : 'DESC'}`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    values.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    values.push(parseInt(offset));

    const result = await pool.query(query, values);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const countValues = [];
    paramCount = 0;

    if (sender_address) {
      paramCount++;
      countQuery += ` AND sender_address = $${paramCount}`;
      countValues.push(sender_address);
    }

    if (recipient_address) {
      paramCount++;
      countQuery += ` AND recipient_address = $${paramCount}`;
      countValues.push(recipient_address);
    }

    if (status) {
      paramCount++;
      countQuery += ` AND status = $${paramCount}`;
      countValues.push(status);
    }

    if (start_date) {
      paramCount++;
      countQuery += ` AND created_at >= $${paramCount}`;
      countValues.push(start_date);
    }

    if (end_date) {
      paramCount++;
      countQuery += ` AND created_at <= $${paramCount}`;
      countValues.push(end_date);
    }

    const countResult = await pool.query(countQuery, countValues);
    
    res.json({
      success: true,
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch audit logs',
      details: error.message 
    });
  }
});

// Get audit statistics
router.get('/stats', async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const values = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
      values.push(start_date, end_date);
    } else if (start_date) {
      dateFilter = 'WHERE created_at >= $1';
      values.push(start_date);
    } else if (end_date) {
      dateFilter = 'WHERE created_at <= $1';
      values.push(end_date);
    }

    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'validation_error' THEN 1 END) as validation_errors,
        COUNT(CASE WHEN status = 'energy_error' THEN 1 END) as energy_errors,
        COUNT(CASE WHEN status = 'ipfs_error' THEN 1 END) as ipfs_errors,
        COUNT(CASE WHEN status = 'blockchain_error' THEN 1 END) as blockchain_errors,
        COUNT(DISTINCT sender_address) as unique_senders,
        COUNT(DISTINCT recipient_address) as unique_recipients,
        SUM(fee_paid) as total_fees_paid,
        AVG(gas_used) as avg_gas_used
      FROM audit_logs
      ${dateFilter}
    `;

    const result = await pool.query(statsQuery, values);
    
    // Get top error messages
    const errorQuery = `
      SELECT 
        error_message,
        error_code,
        COUNT(*) as count
      FROM audit_logs
      WHERE status != 'success' 
        AND error_message IS NOT NULL
        ${dateFilter ? 'AND ' + dateFilter.replace('WHERE', '') : ''}
      GROUP BY error_message, error_code
      ORDER BY count DESC
      LIMIT 10
    `;

    const errorResult = await pool.query(errorQuery, values);

    res.json({
      success: true,
      stats: result.rows[0],
      topErrors: errorResult.rows
    });

  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch audit statistics',
      details: error.message 
    });
  }
});

// Export audit logs as CSV
router.get('/export', async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const { start_date, end_date, status } = req.query;
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const values = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(status);
    }

    if (start_date) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      values.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      values.push(end_date);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);
    
    // Convert to CSV
    const csv = [
      'ID,Timestamp,Status,Sender,Recipient,Notice Type,Case Number,Transaction Hash,Error Message,Error Code,Gas Used,Fee Paid,IPFS Hash',
      ...result.rows.map(row => 
        `${row.id},"${row.created_at}","${row.status}","${row.sender_address}","${row.recipient_address}","${row.notice_type || ''}","${row.case_number || ''}","${row.transaction_hash || ''}","${row.error_message || ''}","${row.error_code || ''}",${row.gas_used || 0},${row.fee_paid || 0},"${row.ipfs_hash || ''}"`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export audit logs',
      details: error.message 
    });
  }
});

module.exports = router;