/**
 * Query smart contract for roles and authorized servers
 * Run: node query-contract-roles.js
 */

const axios = require('axios');

const CONTRACT_ADDRESS = 'TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN';
const TRONGRID_API = 'https://api.trongrid.io';

// Role hashes (keccak256)
const ROLES = {
    ADMIN_ROLE: '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775',
    PROCESS_SERVER_ROLE: '0x9a92bf3818086a9bc9c8993fc551e796975ad86e56e648d4a3c3e8d756cc039c'
};

// Function selectors
const FUNCTIONS = {
    getRoleMemberCount: 'ca15c873',  // getRoleMemberCount(bytes32)
    getRoleMember: '9010d07c',        // getRoleMember(bytes32,uint256)
    hasRole: '91d14854',              // hasRole(bytes32,address)
    feeCollector: ''                   // Will find this
};

async function callContract(functionSelector, params) {
    try {
        // Convert contract address to hex
        const contractHex = '41' + Buffer.from(
            require('bs58').decode(CONTRACT_ADDRESS)
        ).slice(1, 21).toString('hex');

        const response = await axios.post(`${TRONGRID_API}/wallet/triggerconstantcontract`, {
            owner_address: contractHex,
            contract_address: contractHex,
            function_selector: functionSelector,
            parameter: params,
            visible: false
        });

        return response.data;
    } catch (e) {
        console.error('Contract call error:', e.message);
        return null;
    }
}

function padHex(hex, length = 64) {
    return hex.replace('0x', '').padStart(length, '0');
}

function hexToAddress(hex) {
    // Remove leading zeros and add 41 prefix for TRON
    const cleaned = hex.replace(/^0+/, '');
    if (cleaned.length < 40) return null;
    const addressHex = '41' + cleaned.slice(-40);

    try {
        const bs58 = require('bs58');
        const crypto = require('crypto');

        // Add checksum
        const hash1 = crypto.createHash('sha256').update(Buffer.from(addressHex, 'hex')).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.slice(0, 4);

        const addressBytes = Buffer.concat([Buffer.from(addressHex, 'hex'), checksum]);
        return bs58.encode(addressBytes);
    } catch (e) {
        return '0x' + cleaned.slice(-40);
    }
}

async function getRoleMembers(roleName, roleHash) {
    console.log(`\n--- ${roleName} ---`);

    // Get member count
    const countParams = padHex(roleHash);
    const countResult = await callContract('getRoleMemberCount(bytes32)', countParams);

    if (!countResult || !countResult.constant_result) {
        console.log('  Error getting member count');
        return [];
    }

    const count = parseInt(countResult.constant_result[0], 16);
    console.log(`  Member count: ${count}`);

    const members = [];

    // Get each member
    for (let i = 0; i < count; i++) {
        const memberParams = padHex(roleHash) + padHex(i.toString(16));
        const memberResult = await callContract('getRoleMember(bytes32,uint256)', memberParams);

        if (memberResult && memberResult.constant_result) {
            const address = hexToAddress(memberResult.constant_result[0]);
            members.push(address);
            console.log(`  [${i}] ${address}`);
        }
    }

    return members;
}

async function main() {
    console.log('='.repeat(60));
    console.log('SMART CONTRACT ROLES & PERMISSIONS');
    console.log('='.repeat(60));
    console.log(`Contract: ${CONTRACT_ADDRESS}`);

    // Get role members
    const admins = await getRoleMembers('ADMIN_ROLE', ROLES.ADMIN_ROLE);
    const servers = await getRoleMembers('PROCESS_SERVER_ROLE', ROLES.PROCESS_SERVER_ROLE);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nAdmins (${admins.length}):`);
    admins.forEach(a => console.log(`  - ${a}`));
    console.log(`\nAuthorized Process Servers (${servers.length}):`);
    servers.forEach(s => console.log(`  - ${s}`));

    // Known wallets
    console.log('\n' + '='.repeat(60));
    console.log('KNOWN WALLETS');
    console.log('='.repeat(60));
    console.log('  Admin/Owner: TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY');
    console.log('  Contract: TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN');
    console.log('  Test Recipient: TFfagVe1aZpSfYaruY6xJfVPYZBuMj57FH');
}

main().catch(console.error);
