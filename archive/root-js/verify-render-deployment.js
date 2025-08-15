#!/usr/bin/env node

/**
 * Quick verification script for Render deployment
 * Run this after deployment completes to verify everything works
 */

const { default: fetch } = require('node-fetch');

// Replace this with your actual Render URL
const RENDER_URL = 'https://YOUR_APP_NAME.onrender.com';

async function verifyDeployment() {
    console.log('🚀 Verifying Render Deployment');
    console.log('==============================\n');
    
    const tests = [
        {
            name: 'Backend Health Check',
            url: `${RENDER_URL}/api/health`,
            method: 'GET'
        },
        {
            name: 'Batch Endpoint Availability',
            url: `${RENDER_URL}/api/batch/health`,
            method: 'GET'
        },
        {
            name: 'Main Frontend Load',
            url: `${RENDER_URL}/`,
            method: 'GET'
        }
    ];
    
    for (const test of tests) {
        console.log(`Testing: ${test.name}`);
        try {
            const response = await fetch(test.url, { method: test.method });
            
            if (response.ok) {
                console.log(`   ✅ ${test.name} - Status: ${response.status}`);
            } else {
                console.log(`   ⚠️  ${test.name} - Status: ${response.status}`);
            }
        } catch (error) {
            console.log(`   ❌ ${test.name} - Error: ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. If backend health check passes, your deployment is working');
    console.log('2. Run the database migration in Render shell');
    console.log('3. Test batch upload functionality in your app');
    console.log('\n🔧 If any tests fail:');
    console.log('- Check Render logs in the dashboard');
    console.log('- Verify environment variables are set');
    console.log('- Ensure DATABASE_URL is configured');
}

console.log('Replace RENDER_URL with your actual app URL, then run this script');
console.log(`Current URL: ${RENDER_URL}`);
console.log('');

if (RENDER_URL.includes('YOUR_APP_NAME')) {
    console.log('⚠️  Please update the RENDER_URL variable in this script with your actual Render URL');
    process.exit(1);
}

verifyDeployment().then(() => {
    console.log('\n✅ Deployment verification complete!');
}).catch(error => {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
});