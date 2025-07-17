#!/usr/bin/env node

// Load environment variables from .env file
try {
    require('dotenv').config();
    console.log('✅ Loaded .env file');
} catch (e) {
    // dotenv not installed, try manual load
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env');
    
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value && !line.startsWith('#')) {
                process.env[key.trim()] = value.trim();
            }
        });
        console.log('✅ Loaded .env file (manual)');
    }
}

// Now run the deployment
require('./deploy_legal_service_v2.js');