/**
 * Case Management System Monitor
 * Real-time monitoring of case status and system health
 */

const fetch = require('node-fetch');
const readline = require('readline');

// Configuration
const API_URL = process.env.API_URL || 'https://nftserviceapp.onrender.com';
const REFRESH_INTERVAL = 5000; // 5 seconds

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Clear screen
function clearScreen() {
    console.clear();
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// Format timestamp
function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Get status color
function getStatusColor(status) {
    switch(status) {
        case 'draft': return colors.yellow;
        case 'ready': return colors.blue;
        case 'served': return colors.green;
        case 'error': return colors.red;
        default: return colors.reset;
    }
}

/**
 * Fetch system health
 */
async function fetchHealth() {
    try {
        const response = await fetch(`${API_URL}/api/health`);
        if (response.ok) {
            const data = await response.json();
            return { status: 'online', message: data.message };
        }
        return { status: 'error', message: `HTTP ${response.status}` };
    } catch (error) {
        return { status: 'offline', message: error.message };
    }
}

/**
 * Fetch storage stats
 */
async function fetchStorageStats() {
    try {
        const response = await fetch(`${API_URL}/api/storage/stats?serverAddress=MONITOR`, {
            headers: { 'X-Server-Address': 'MONITOR' }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Fetch recent cases
 */
async function fetchRecentCases(serverAddress = 'ALL') {
    try {
        const response = await fetch(`${API_URL}/api/cases?serverAddress=${serverAddress}`, {
            headers: { 'X-Server-Address': serverAddress }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.cases)) {
                return data.cases;
            }
        }
        return [];
    } catch (error) {
        return [];
    }
}

/**
 * Display dashboard
 */
async function displayDashboard() {
    clearScreen();
    
    // Header
    console.log(`${colors.cyan}${colors.bright}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}║         📊 Case Management System Monitor                    ║${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}╚═══════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log();
    
    // Fetch data
    const health = await fetchHealth();
    const storage = await fetchStorageStats();
    const cases = await fetchRecentCases();
    
    // System Health
    console.log(`${colors.bright}System Status:${colors.reset}`);
    const statusColor = health.status === 'online' ? colors.green : 
                       health.status === 'error' ? colors.yellow : colors.red;
    console.log(`  API: ${statusColor}● ${health.status.toUpperCase()}${colors.reset} ${colors.dim}${health.message || ''}${colors.reset}`);
    console.log(`  URL: ${colors.dim}${API_URL}${colors.reset}`);
    console.log(`  Time: ${colors.dim}${new Date().toLocaleTimeString()}${colors.reset}`);
    console.log();
    
    // Storage Statistics
    if (storage && storage.disk) {
        console.log(`${colors.bright}Storage:${colors.reset}`);
        const diskColor = parseInt(storage.disk.percentUsed) > 80 ? colors.red :
                         parseInt(storage.disk.percentUsed) > 60 ? colors.yellow : colors.green;
        console.log(`  Usage: ${diskColor}${storage.disk.percentUsed || 'N/A'}${colors.reset}`);
        console.log(`  Space: ${storage.disk.used || 'N/A'} / ${storage.disk.total || 'N/A'}`);
        
        if (storage.caseCount) {
            console.log(`  Cases: ${colors.cyan}${storage.caseCount.total || 0}${colors.reset} total`);
            console.log(`         ${colors.green}${storage.caseCount.active || 0}${colors.reset} active, ${colors.dim}${storage.caseCount.archived || 0}${colors.reset} archived`);
        }
        console.log();
    }
    
    // Recent Cases
    console.log(`${colors.bright}Recent Cases:${colors.reset}`);
    
    if (cases.length === 0) {
        console.log(`  ${colors.dim}No cases found${colors.reset}`);
    } else {
        // Table header
        console.log(`  ${colors.dim}${'─'.repeat(60)}${colors.reset}`);
        console.log(`  ${colors.bright}ID${' '.repeat(18)}Status${' '.repeat(10)}Pages  Size       Created${colors.reset}`);
        console.log(`  ${colors.dim}${'─'.repeat(60)}${colors.reset}`);
        
        // Show up to 10 recent cases
        cases.slice(0, 10).forEach(c => {
            const statusColor = getStatusColor(c.status);
            const caseId = (c.id || '').substring(0, 18).padEnd(20);
            const status = (c.status || 'unknown').padEnd(15);
            const pages = (c.page_count || '?').toString().padEnd(7);
            const size = formatBytes(c.file_size).padEnd(11);
            const created = new Date(c.created_at).toLocaleDateString();
            
            console.log(`  ${caseId}${statusColor}${status}${colors.reset}${pages}${size}${created}`);
        });
        
        if (cases.length > 10) {
            console.log(`  ${colors.dim}... and ${cases.length - 10} more${colors.reset}`);
        }
    }
    
    console.log();
    console.log(`${colors.dim}${'─'.repeat(65)}${colors.reset}`);
    console.log(`${colors.dim}Press Ctrl+C to exit | Refreshing every ${REFRESH_INTERVAL/1000} seconds${colors.reset}`);
}

/**
 * Interactive mode - get server address
 */
async function getServerAddress() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(`${colors.cyan}Enter server address (or press Enter for ALL): ${colors.reset}`, (answer) => {
            rl.close();
            resolve(answer || 'ALL');
        });
    });
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
    // Initial display
    await displayDashboard();
    
    // Set up refresh interval
    const interval = setInterval(async () => {
        await displayDashboard();
    }, REFRESH_INTERVAL);
    
    // Handle exit
    process.on('SIGINT', () => {
        clearInterval(interval);
        clearScreen();
        console.log(`${colors.cyan}Monitor stopped.${colors.reset}`);
        process.exit(0);
    });
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.cyan}Case Management System Monitor${colors.reset}

Usage: node monitor-cases.js [options]

Options:
  --help, -h     Show this help message
  --url <url>    Set API URL (default: https://nftserviceapp.onrender.com)
  --interval <ms> Set refresh interval in milliseconds (default: 5000)

Examples:
  node monitor-cases.js
  node monitor-cases.js --url http://localhost:3001
  node monitor-cases.js --interval 10000
    `);
    process.exit(0);
}

// Parse URL argument
const urlIndex = args.indexOf('--url');
if (urlIndex !== -1 && args[urlIndex + 1]) {
    process.env.API_URL = args[urlIndex + 1];
}

// Parse interval argument
const intervalIndex = args.indexOf('--interval');
if (intervalIndex !== -1 && args[intervalIndex + 1]) {
    const customInterval = parseInt(args[intervalIndex + 1]);
    if (!isNaN(customInterval) && customInterval > 0) {
        REFRESH_INTERVAL = customInterval;
    }
}

// Start monitoring
console.log(`${colors.cyan}Starting Case Management Monitor...${colors.reset}`);
startMonitoring();