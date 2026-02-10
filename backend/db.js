/**
 * Shared Database Pool
 * Single connection pool used across all route files.
 * Import this instead of creating new Pool() instances.
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err.message);
});

module.exports = pool;
