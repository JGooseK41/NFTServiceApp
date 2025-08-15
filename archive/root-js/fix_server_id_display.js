const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing process server ID display...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Replace getProcessServerInfo calls with direct processServers mapping access
content = content.replace(
    /await legalContract\.getProcessServerInfo\((.*?)\)\.call\(\)/g,
    'await legalContract.processServers($1).call()'
);

// Fix the server info structure access - the optimized contract returns a different structure
// Find and fix the server info access pattern
const serverInfoPattern = /const serverInfo = await legalContract\.processServers\((.*?)\)\.call\(\);[\s\S]*?if \(serverInfo\.serverId/g;
content = content.replace(serverInfoPattern, (match, address) => {
    return `const serverInfo = await legalContract.processServers(${address}).call();
                    // The optimized contract returns: [serverId, noticesServed, registeredDate, name, agency, active]
                    const serverId = serverInfo[0] || serverInfo.serverId;
                    const noticesServed = serverInfo[1] || serverInfo.noticesServed;
                    const registeredDate = serverInfo[2] || serverInfo.registeredDate;
                    const name = serverInfo[3] || serverInfo.name;
                    const agency = serverInfo[4] || serverInfo.agency;
                    const active = serverInfo[5] || serverInfo.active;
                    
                    if (serverId`;
});

// Also fix the prefix display
content = content.replace(
    /const serverId = serverInfo\.serverId \|\| '\?';/g,
    `const serverId = serverInfo[0] || serverInfo.serverId || '?';`
);

// Fix the server ID display in wallet status
const walletStatusPattern = /if \(serverInfo\.serverId && serverInfo\.serverId\.toString\(\) !== '0'\)/g;
content = content.replace(walletStatusPattern, 
    `if ((serverInfo[0] || serverInfo.serverId) && (serverInfo[0] || serverInfo.serverId).toString() !== '0')`
);

// Fix server ID display update
content = content.replace(
    /userServerIdSpan\.textContent = serverInfo\.serverId\.toString\(\)\.padStart\(2, '0'\);/g,
    `userServerIdSpan.textContent = (serverInfo[0] || serverInfo.serverId || '0').toString().padStart(2, '0');`
);

// Fix details display
content = content.replace(
    /detailsHtml \+= `<div style="margin-left: 1rem;">Server ID: <strong>\$\{serverInfo\.serverId\}<\/strong><\/div>`;/g,
    `detailsHtml += \`<div style="margin-left: 1rem;">Server ID: <strong>\${serverInfo[0] || serverInfo.serverId || '0'}</strong></div>\`;`
);

// Save the updated file
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed process server ID display!');
console.log('\nChanges made:');
console.log('- Replaced getProcessServerInfo() with processServers() mapping');
console.log('- Fixed server info structure access for array return');
console.log('- Updated all server ID references to handle array format');
console.log('\nThe process server ID should now display correctly!');