const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Migration endpoint - protected by secret key
router.post('/run', async (req, res) => {
    const { migrationKey } = req.body;
    
    // Check migration key for security
    const validKey = process.env.MIGRATION_KEY || 'your-secret-migration-key';
    if (migrationKey !== validKey) {
        return res.status(403).json({ 
            success: false, 
            error: 'Invalid migration key' 
        });
    }
    
    try {
        const { pool } = req.app.locals;
        
        // Create migrations tracking table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Read all migration files
        const migrationsDir = path.join(__dirname, '../migrations');
        const files = await fs.readdir(migrationsDir);
        const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
        
        const results = [];
        
        for (const file of sqlFiles) {
            // Check if migration has already been run
            const checkResult = await pool.query(
                'SELECT * FROM migrations WHERE filename = $1',
                [file]
            );
            
            if (checkResult.rows.length > 0) {
                results.push({
                    file,
                    status: 'already_executed',
                    executed_at: checkResult.rows[0].executed_at
                });
                continue;
            }
            
            // Read and execute migration
            const sqlPath = path.join(migrationsDir, file);
            const sql = await fs.readFile(sqlPath, 'utf8');
            
            try {
                await pool.query(sql);
                
                // Record migration as completed
                await pool.query(
                    'INSERT INTO migrations (filename) VALUES ($1)',
                    [file]
                );
                
                results.push({
                    file,
                    status: 'success',
                    executed_at: new Date()
                });
                
                console.log(`Migration executed successfully: ${file}`);
            } catch (error) {
                console.error(`Migration failed for ${file}:`, error);
                results.push({
                    file,
                    status: 'failed',
                    error: error.message
                });
                
                // Stop on first failure
                break;
            }
        }
        
        res.json({
            success: true,
            migrations: results
        });
        
    } catch (error) {
        console.error('Migration runner error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Check migration status
router.get('/status', async (req, res) => {
    try {
        const { pool } = req.app.locals;
        
        // Check if migrations table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'migrations'
            )
        `);
        
        if (!tableCheck.rows[0].exists) {
            return res.json({
                success: true,
                message: 'No migrations have been run yet',
                migrations: []
            });
        }
        
        // Get all executed migrations
        const migrations = await pool.query(
            'SELECT * FROM migrations ORDER BY executed_at DESC'
        );
        
        // Check if notice_components has the new columns
        const columnCheck = await pool.query(`
            SELECT 
                column_name,
                data_type,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'notice_components'
            AND column_name IN ('page_count', 'is_compiled', 'document_count')
        `);
        
        res.json({
            success: true,
            executed_migrations: migrations.rows,
            notice_components_columns: columnCheck.rows,
            needs_migration: columnCheck.rows.length < 3
        });
        
    } catch (error) {
        console.error('Migration status error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;