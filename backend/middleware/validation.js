/**
 * Validation Middleware for Backend Security
 * Provides comprehensive input validation and sanitization
 */

const validator = require('validator');
const xss = require('xss');

// Custom XSS options for strict sanitization
const xssOptions = {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
};

// Validation middleware factory
const validation = {
    
    // Sanitize all string inputs in request
    sanitizeInputs: (req, res, next) => {
        // Sanitize body
        if (req.body) {
            req.body = sanitizeObject(req.body);
        }
        
        // Sanitize query params
        if (req.query) {
            req.query = sanitizeObject(req.query);
        }
        
        // Sanitize params
        if (req.params) {
            req.params = sanitizeObject(req.params);
        }
        
        next();
    },
    
    // Validate TRON address
    validateTronAddress: (field = 'address') => {
        return (req, res, next) => {
            const address = req.body[field] || req.params[field] || req.query[field];
            
            if (!address) {
                return res.status(400).json({ 
                    error: `${field} is required` 
                });
            }
            
            if (!isValidTronAddress(address)) {
                return res.status(400).json({ 
                    error: `Invalid TRON address format for ${field}` 
                });
            }
            
            next();
        };
    },
    
    // Validate PDF file upload
    validatePDFUpload: (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({ 
                error: 'No file uploaded' 
            });
        }
        
        // Check MIME type
        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ 
                error: 'Only PDF files are allowed' 
            });
        }
        
        // Check file size (50MB limit)
        const maxSize = 50 * 1024 * 1024;
        if (req.file.size > maxSize) {
            return res.status(400).json({ 
                error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` 
            });
        }
        
        // Check if file buffer starts with PDF header
        if (req.file.buffer) {
            const header = req.file.buffer.slice(0, 5).toString();
            if (!header.startsWith('%PDF-')) {
                return res.status(400).json({ 
                    error: 'Invalid PDF file structure' 
                });
            }
        }
        
        next();
    },
    
    // Validate required fields
    validateRequired: (fields) => {
        return (req, res, next) => {
            const missing = [];
            
            for (const field of fields) {
                const value = req.body[field];
                if (!value || (typeof value === 'string' && !value.trim())) {
                    missing.push(field);
                }
            }
            
            if (missing.length > 0) {
                return res.status(400).json({ 
                    error: `Missing required fields: ${missing.join(', ')}` 
                });
            }
            
            next();
        };
    },
    
    // Validate notice metadata
    validateNoticeMetadata: (req, res, next) => {
        const { 
            caseNumber, 
            noticeType, 
            issuingAgency,
            responseDeadline 
        } = req.body;
        
        // Validate case number format
        if (caseNumber && !validator.matches(caseNumber, /^[A-Z0-9\-]{3,50}$/i)) {
            return res.status(400).json({ 
                error: 'Invalid case number format' 
            });
        }
        
        // Validate notice type
        const validTypes = [
            'Summons', 'Subpoena', 'Complaint', 'Motion', 
            'Order', 'Settlement', 'Default', 'Other'
        ];
        if (noticeType && !validTypes.includes(noticeType)) {
            return res.status(400).json({ 
                error: 'Invalid notice type' 
            });
        }
        
        // Validate issuing agency
        if (issuingAgency && issuingAgency.length > 200) {
            return res.status(400).json({ 
                error: 'Issuing agency name too long (max 200 characters)' 
            });
        }
        
        // Validate response deadline
        if (responseDeadline) {
            const deadline = parseInt(responseDeadline);
            if (isNaN(deadline) || deadline < 1 || deadline > 365) {
                return res.status(400).json({ 
                    error: 'Response deadline must be between 1 and 365 days' 
                });
            }
        }
        
        next();
    },
    
    // Rate limiting per IP
    rateLimit: (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
        const requests = new Map();
        
        return (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            const now = Date.now();
            
            // Clean old entries
            for (const [key, data] of requests.entries()) {
                if (now - data.firstRequest > windowMs) {
                    requests.delete(key);
                }
            }
            
            // Check rate limit
            const userData = requests.get(ip) || { count: 0, firstRequest: now };
            
            if (userData.count >= maxRequests) {
                return res.status(429).json({ 
                    error: 'Too many requests. Please try again later.' 
                });
            }
            
            userData.count++;
            requests.set(ip, userData);
            
            next();
        };
    },
    
    // CSRF token validation
    validateCSRF: (req, res, next) => {
        // Skip for GET requests
        if (req.method === 'GET') {
            return next();
        }
        
        const token = req.headers['x-csrf-token'] || req.body._csrf;
        const sessionToken = req.session?.csrfToken;
        
        if (!token || !sessionToken || token !== sessionToken) {
            return res.status(403).json({ 
                error: 'Invalid CSRF token' 
            });
        }
        
        next();
    },
    
    // Content-Type validation
    validateContentType: (allowedTypes = ['application/json']) => {
        return (req, res, next) => {
            // Skip for GET requests
            if (req.method === 'GET') {
                return next();
            }
            
            const contentType = req.headers['content-type'];
            if (!contentType) {
                return res.status(400).json({ 
                    error: 'Content-Type header is required' 
                });
            }
            
            const isAllowed = allowedTypes.some(type => 
                contentType.toLowerCase().includes(type.toLowerCase())
            );
            
            if (!isAllowed) {
                return res.status(400).json({ 
                    error: `Invalid Content-Type. Allowed: ${allowedTypes.join(', ')}` 
                });
            }
            
            next();
        };
    }
};

// Helper functions

function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return xss(obj, xssOptions);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Sanitize key as well
            const sanitizedKey = xss(key, xssOptions);
            sanitized[sanitizedKey] = sanitizeObject(value);
        }
        return sanitized;
    }
    
    return obj;
}

function isValidTronAddress(address) {
    if (!address || typeof address !== 'string') {
        return false;
    }
    
    // TRON addresses start with T and are 34 characters long
    if (!address.startsWith('T') || address.length !== 34) {
        return false;
    }
    
    // Check for valid base58 characters (no 0, O, I, l)
    const base58Regex = /^T[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$/;
    return base58Regex.test(address);
}

module.exports = validation;