/**
 * Admin Authentication Routes
 * Manages admin access and blockchain sync
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
});

// Initialize TronWeb only if available
let tronWeb = null;
try {
    const TronWeb = require('tronweb');
    tronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io'
    });
} catch (error) {
    console.log('TronWeb not available for admin-auth, blockchain sync will be limited');
}

// Contract address for admin verification
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh';

/**
 * Check if wallet is admin
 * GET /api/admin-auth/check/:walletAddress
 */
router.get('/check/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;

        // Log the check attempt (non-blocking, ignore errors if table doesn't exist)
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        try {
            await pool.query(`
                INSERT INTO admin_access_logs (admin_wallet, action, ip_address, user_agent)
                VALUES ($1, $2, $3, $4)
            `, [walletAddress, 'admin_check', ipAddress, req.headers['user-agent']]);
        } catch (logError) {
            // Silently ignore if logging table doesn't exist
            console.log('Admin access logging skipped:', logError.message);
        }

        // Check if wallet is in admin table
        const result = await pool.query(`
            SELECT 
                wallet_address,
                name,
                role,
                is_active,
                is_blockchain_synced,
                permissions,
                last_login_at
            FROM admin_users
            WHERE wallet_address = $1 AND is_active = true
        `, [walletAddress]);
        
        if (result.rows.length === 0) {
            return res.json({
                success: false,
                isAdmin: false,
                message: 'Not authorized as admin'
            });
        }
        
        const admin = result.rows[0];
        
        // Update last login
        await pool.query(`
            UPDATE admin_users 
            SET last_login_at = CURRENT_TIMESTAMP 
            WHERE wallet_address = $1
        `, [walletAddress]);
        
        // Log successful admin access (non-blocking)
        try {
            await pool.query(`
                INSERT INTO admin_access_logs (admin_wallet, action, details, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                walletAddress,
                'admin_login',
                JSON.stringify({ role: admin.role }),
                ipAddress,
                req.headers['user-agent']
            ]);
        } catch (logError) {
            console.log('Admin login logging skipped:', logError.message);
        }

        res.json({
            success: true,
            isAdmin: true,
            admin: {
                address: admin.wallet_address,
                name: admin.name,
                role: admin.role,
                permissions: admin.permissions,
                isBlockchainSynced: admin.is_blockchain_synced,
                lastLogin: admin.last_login_at
            }
        });
        
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check admin status'
        });
    }
});

/**
 * List all admins (super admin only)
 * GET /api/admin-auth/list
 */
router.get('/list', async (req, res) => {
    try {
        const { adminWallet } = req.headers;
        
        // Verify requesting user is super admin
        const adminCheck = await pool.query(`
            SELECT role FROM admin_users 
            WHERE wallet_address = $1 AND is_active = true
        `, [adminWallet]);
        
        if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized - Super admin access required'
            });
        }
        
        // Get all admins
        const result = await pool.query(`
            SELECT 
                wallet_address,
                name,
                role,
                is_active,
                is_blockchain_synced,
                permissions,
                added_by,
                last_sync_at,
                last_login_at,
                created_at
            FROM admin_users
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            admins: result.rows
        });
        
    } catch (error) {
        console.error('Error listing admins:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list admins'
        });
    }
});

/**
 * Add new admin (super admin only)
 * POST /api/admin-auth/add
 */
router.post('/add', async (req, res) => {
    try {
        const { adminWallet } = req.headers;
        const { walletAddress, name, role = 'admin' } = req.body;
        
        // Verify requesting user is super admin
        const adminCheck = await pool.query(`
            SELECT role FROM admin_users 
            WHERE wallet_address = $1 AND is_active = true
        `, [adminWallet]);
        
        if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized - Super admin access required'
            });
        }
        
        // Set default permissions based on role
        const permissions = role === 'super_admin' ? {
            manage_admins: true,
            view_all_data: true,
            modify_settings: true,
            sync_blockchain: true
        } : {
            view_all_data: true,
            modify_settings: false,
            sync_blockchain: false
        };
        
        // Add new admin
        await pool.query(`
            INSERT INTO admin_users (wallet_address, name, role, permissions, added_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (wallet_address) 
            DO UPDATE SET 
                name = $2,
                role = $3,
                permissions = $4,
                is_active = true,
                updated_at = CURRENT_TIMESTAMP
        `, [walletAddress, name, role, JSON.stringify(permissions), adminWallet]);
        
        // Log the action (non-blocking)
        try {
            await pool.query(`
                INSERT INTO admin_access_logs (admin_wallet, action, details)
                VALUES ($1, $2, $3)
            `, [
                adminWallet,
                'add_admin',
                JSON.stringify({ newAdmin: walletAddress, role })
            ]);
        } catch (logError) {
            console.log('Admin action logging skipped:', logError.message);
        }

        res.json({
            success: true,
            message: 'Admin added successfully'
        });
        
    } catch (error) {
        console.error('Error adding admin:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add admin'
        });
    }
});

/**
 * Remove admin (super admin only)
 * POST /api/admin-auth/remove
 */
router.post('/remove', async (req, res) => {
    try {
        const { adminWallet } = req.headers;
        const { walletAddress } = req.body;
        
        // Verify requesting user is super admin
        const adminCheck = await pool.query(`
            SELECT role FROM admin_users 
            WHERE wallet_address = $1 AND is_active = true
        `, [adminWallet]);
        
        if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized - Super admin access required'
            });
        }
        
        // Cannot remove yourself
        if (walletAddress === adminWallet) {
            return res.status(400).json({
                success: false,
                error: 'Cannot remove your own admin access'
            });
        }
        
        // Deactivate admin
        await pool.query(`
            UPDATE admin_users 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE wallet_address = $1
        `, [walletAddress]);
        
        // Log the action (non-blocking)
        try {
            await pool.query(`
                INSERT INTO admin_access_logs (admin_wallet, action, details)
                VALUES ($1, $2, $3)
            `, [
                adminWallet,
                'remove_admin',
                JSON.stringify({ removedAdmin: walletAddress })
            ]);
        } catch (logError) {
            console.log('Admin action logging skipped:', logError.message);
        }

        res.json({
            success: true,
            message: 'Admin removed successfully'
        });
        
    } catch (error) {
        console.error('Error removing admin:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove admin'
        });
    }
});

/**
 * Sync admins with blockchain contract
 * POST /api/admin-auth/sync-blockchain
 */
router.post('/sync-blockchain', async (req, res) => {
    try {
        const { adminWallet } = req.headers;
        
        // Verify requesting user has sync permission
        const adminCheck = await pool.query(`
            SELECT permissions FROM admin_users 
            WHERE wallet_address = $1 AND is_active = true
        `, [adminWallet]);
        
        if (adminCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        const permissions = adminCheck.rows[0].permissions;
        if (!permissions.sync_blockchain) {
            return res.status(403).json({
                success: false,
                error: 'No permission to sync blockchain'
            });
        }
        
        if (!tronWeb) {
            return res.status(503).json({
                success: false,
                error: 'Blockchain sync not available - TronWeb not configured'
            });
        }
        
        // Get contract instance
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        
        // Try to get owner from contract (this depends on your contract structure)
        let contractOwner;
        try {
            contractOwner = await contract.owner().call();
            contractOwner = tronWeb.address.fromHex(contractOwner);
        } catch (e) {
            console.log('Could not fetch contract owner:', e.message);
        }
        
        // Update blockchain sync status
        if (contractOwner) {
            await pool.query(`
                UPDATE admin_users 
                SET 
                    is_blockchain_synced = true,
                    last_sync_at = CURRENT_TIMESTAMP
                WHERE wallet_address = $1
            `, [contractOwner]);
            
            // Ensure contract owner is admin
            await pool.query(`
                INSERT INTO admin_users (wallet_address, name, role, is_blockchain_synced, permissions)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (wallet_address) 
                DO UPDATE SET 
                    is_blockchain_synced = true,
                    last_sync_at = CURRENT_TIMESTAMP
            `, [
                contractOwner,
                'Contract Owner',
                'super_admin',
                true,
                JSON.stringify({
                    manage_admins: true,
                    view_all_data: true,
                    modify_settings: true,
                    sync_blockchain: true
                })
            ]);
        }
        
        // Log the sync (non-blocking)
        try {
            await pool.query(`
                INSERT INTO admin_access_logs (admin_wallet, action, details)
                VALUES ($1, $2, $3)
            `, [
                adminWallet,
                'blockchain_sync',
                JSON.stringify({ contractOwner })
            ]);
        } catch (logError) {
            console.log('Blockchain sync logging skipped:', logError.message);
        }

        res.json({
            success: true,
            message: 'Blockchain sync completed',
            contractOwner
        });
        
    } catch (error) {
        console.error('Error syncing with blockchain:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync with blockchain'
        });
    }
});

/**
 * Get admin activity logs
 * GET /api/admin-auth/activity
 */
router.get('/activity', async (req, res) => {
    try {
        const { adminWallet } = req.headers;
        const { limit = 100 } = req.query;
        
        // Verify admin
        const adminCheck = await pool.query(`
            SELECT role FROM admin_users 
            WHERE wallet_address = $1 AND is_active = true
        `, [adminWallet]);
        
        if (adminCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        // Get activity logs
        try {
            const result = await pool.query(`
                SELECT
                    admin_wallet,
                    action,
                    details,
                    ip_address,
                    created_at
                FROM admin_access_logs
                ORDER BY created_at DESC
                LIMIT $1
            `, [limit]);

            res.json({
                success: true,
                activities: result.rows
            });
        } catch (tableError) {
            // Table doesn't exist yet
            res.json({
                success: true,
                activities: [],
                message: 'Activity logging not yet configured'
            });
        }
        
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity'
        });
    }
});

module.exports = router;