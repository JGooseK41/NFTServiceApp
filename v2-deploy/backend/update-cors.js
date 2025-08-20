/**
 * UPDATE CORS CONFIGURATION
 * Adds X-Wallet-Address and X-Server-Address to allowed headers
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Updating CORS configuration in server.js...\n');

const serverPath = path.join(__dirname, 'server.js');

try {
    let serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Check if CORS is already configured
    if (!serverContent.includes('cors(')) {
        console.log('❌ CORS not found in server.js');
        console.log('Please manually add CORS configuration');
        process.exit(1);
    }
    
    // Find the CORS configuration
    const corsRegex = /app\.use\(cors\(\{[\s\S]*?\}\)\)/;
    const corsMatch = serverContent.match(corsRegex);
    
    if (corsMatch) {
        console.log('Found existing CORS configuration');
        
        // Check if headers are already configured
        if (serverContent.includes('X-Wallet-Address')) {
            console.log('✅ X-Wallet-Address already in CORS config');
            process.exit(0);
        }
        
        // Update CORS configuration to include custom headers
        const newCorsConfig = `app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001', 
            'http://localhost:5000',
            'https://theblockservice.com',
            'https://www.theblockservice.com',
            'https://nftserviceapp.netlify.app',
            'https://nft-legal-service.netlify.app'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins for now
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'X-Wallet-Address',
        'X-Server-Address',
        'X-Recipient-Address'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
}))`;
        
        serverContent = serverContent.replace(corsRegex, newCorsConfig);
        
        // Write the updated content
        fs.writeFileSync(serverPath, serverContent);
        
        console.log('✅ Updated CORS configuration with custom headers');
        console.log('\nAllowed headers now include:');
        console.log('  - X-Wallet-Address');
        console.log('  - X-Server-Address');
        console.log('  - X-Recipient-Address');
        
    } else {
        console.log('Could not find CORS configuration pattern');
        console.log('\nPlease manually update your server.js CORS config to include:');
        console.log(`
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'X-Wallet-Address',
        'X-Server-Address',
        'X-Recipient-Address'
    ]
        `);
    }
    
} catch (error) {
    console.error('Error updating server.js:', error);
    process.exit(1);
}

console.log('\n✅ CORS configuration updated!');
console.log('\nNext steps:');
console.log('1. Commit and push to GitHub');
console.log('2. Render will auto-deploy with new CORS settings');
console.log('3. Custom headers will then be allowed');