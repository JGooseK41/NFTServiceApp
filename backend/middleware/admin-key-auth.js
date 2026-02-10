/**
 * Admin API Key Authentication Middleware
 * Requires ADMIN_API_KEY environment variable to be set.
 * Checks for the key in x-admin-key header or admin_key query parameter.
 * Fails closed: if ADMIN_API_KEY is not configured, all requests are denied.
 */

const crypto = require('crypto');

function requireAdminKey(req, res, next) {
    const configuredKey = process.env.ADMIN_API_KEY;

    // Fail closed: if no key is configured, deny all access
    if (!configuredKey) {
        return res.status(503).json({
            error: 'Admin endpoints are not configured. Set ADMIN_API_KEY environment variable.'
        });
    }

    const providedKey = req.headers['x-admin-key'] || req.query.admin_key;

    if (!providedKey) {
        return res.status(401).json({
            error: 'Authentication required. Provide x-admin-key header or admin_key query parameter.'
        });
    }

    // Constant-time comparison to prevent timing attacks
    try {
        const keyBuffer = Buffer.from(configuredKey, 'utf8');
        const providedBuffer = Buffer.from(String(providedKey), 'utf8');

        if (keyBuffer.length !== providedBuffer.length ||
            !crypto.timingSafeEqual(keyBuffer, providedBuffer)) {
            return res.status(403).json({ error: 'Invalid admin key' });
        }
    } catch (e) {
        return res.status(403).json({ error: 'Invalid admin key' });
    }

    next();
}

module.exports = requireAdminKey;
