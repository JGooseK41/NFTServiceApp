/**
 * Setup script to install PDF processing tools
 * Run this on backend deployment or startup
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function setupPDFTools() {
    console.log('🔧 Setting up PDF processing tools...\n');
    
    // Check if we're on a Linux system
    try {
        const { stdout: osInfo } = await execPromise('uname -a');
        console.log('System:', osInfo.trim());
    } catch (e) {
        console.log('Warning: Could not detect system type');
    }
    
    // Check what's already installed
    console.log('\n📋 Checking existing tools:');
    
    const tools = [
        { name: 'Ghostscript', command: 'gs --version', package: 'ghostscript' },
        { name: 'QPDF', command: 'qpdf --version', package: 'qpdf' },
        { name: 'PDFtk', command: 'pdftk --version', package: 'pdftk' },
        { name: 'Poppler (pdfinfo)', command: 'pdfinfo -v', package: 'poppler-utils' },
        { name: 'Chromium', command: 'chromium --version || chromium-browser --version', package: 'chromium' },
        { name: 'wkhtmltopdf', command: 'wkhtmltopdf --version', package: 'wkhtmltopdf' }
    ];
    
    const toInstall = [];
    
    for (const tool of tools) {
        try {
            const { stdout } = await execPromise(tool.command + ' 2>&1');
            console.log(`✅ ${tool.name}: ${stdout.trim().split('\n')[0]}`);
        } catch (e) {
            console.log(`❌ ${tool.name}: Not installed`);
            toInstall.push(tool.package);
        }
    }
    
    // Try to install missing tools
    if (toInstall.length > 0) {
        console.log(`\n📦 Attempting to install: ${toInstall.join(', ')}`);
        
        // Try different package managers
        const installCommands = [
            `apt-get update && apt-get install -y ${toInstall.join(' ')}`,
            `apk add --no-cache ${toInstall.join(' ')}`,
            `yum install -y ${toInstall.join(' ')}`
        ];
        
        for (const cmd of installCommands) {
            try {
                console.log(`\nTrying: ${cmd.substring(0, 30)}...`);
                await execPromise(cmd);
                console.log('✅ Installation successful!');
                break;
            } catch (e) {
                console.log('❌ Failed:', e.message.substring(0, 100));
            }
        }
    }
    
    // Check Puppeteer as alternative (for print-to-PDF)
    console.log('\n📋 Checking Node.js PDF libraries:');
    try {
        require('puppeteer');
        console.log('✅ Puppeteer: Available');
    } catch (e) {
        console.log('❌ Puppeteer: Not installed (npm install puppeteer to enable)');
    }
    
    try {
        require('playwright');
        console.log('✅ Playwright: Available');
    } catch (e) {
        console.log('❌ Playwright: Not installed (npm install playwright to enable)');
    }
    
    console.log('\n✨ Setup complete!');
}

// Run if called directly
if (require.main === module) {
    setupPDFTools().catch(console.error);
}

module.exports = setupPDFTools;