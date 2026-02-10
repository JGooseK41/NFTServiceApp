/**
 * Enhanced CORS Configuration
 * Fixes preflight and cross-origin issues
 */

const allowedOrigins = [
  'https://nft-legal-service.netlify.app',
  'https://theblockservice.com',
  'https://www.theblockservice.com',
  'https://blockserved.com',
  'https://www.blockserved.com',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:8080'
];

function configureCORS(app) {
  // Handle preflight requests globally
  app.options('*', (req, res) => {
    const origin = req.headers.origin;
    
    console.log(`OPTIONS request from origin: ${origin}`);
    
    // Allow any origin for OPTIONS requests during development
    if (allowedOrigins.includes(origin) || !origin) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Server-Address, X-Admin-Address, X-Wallet-Address, X-Recipient-Address, X-Timezone, X-Wallet-Provider, X-Visitor-Id, X-Fingerprint, X-Fingerprint-Confidence, X-Screen-Resolution, admin-wallet, x-admin-key');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
    }
    
    res.sendStatus(204);
  });
  
  // Set CORS headers for all other requests
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin) || !origin) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Server-Address, X-Admin-Address, X-Wallet-Address, X-Recipient-Address, X-Timezone, X-Wallet-Provider, X-Visitor-Id, X-Fingerprint, X-Fingerprint-Confidence, X-Screen-Resolution, admin-wallet, x-admin-key');
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    next();
  });
  
  console.log('✅ Enhanced CORS configuration applied');
  console.log('   Allowed origins:', allowedOrigins);
}

module.exports = { configureCORS, allowedOrigins };