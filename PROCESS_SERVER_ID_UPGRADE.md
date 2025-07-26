# Process Server ID System Upgrade

## Overview
This upgrade adds persistent Process Server IDs to the contract and prepends them to all token names for on-chain identification.

## Key Features

### 1. Automatic Server ID Assignment
- When `PROCESS_SERVER_ROLE` is granted, the server automatically gets a unique ID
- IDs start at 1 and increment for each new server
- IDs persist permanently on-chain

### 2. Enhanced Token Naming
- Process server tokens: `PS#123-Notice Name`
- Regular user tokens: `USR-Notice Name`
- Example: `PS#5-Summons #2024-001` shows it was created by Process Server #5

### 3. Process Server Registry
```solidity
struct ProcessServer {
    uint256 serverId;        // Unique ID
    string name;            // Server name
    string agency;          // Agency name
    uint256 registeredDate; // When registered
    uint256 noticesServed;  // Counter of notices
    bool active;           // Status
}
```

### 4. New Functions
- `registerProcessServer(name, agency)` - Process servers can add their details
- `getProcessServerInfo(address)` - Get server info by address
- `getServerById(serverId)` - Get server info by ID
- `tokenToServerId[tokenId]` - Check which server created a token

## Migration Steps

### 1. Deploy New Contract
```bash
# Deploy to testnet first
cd contracts
# Update deployment script with new contract name
node deploy_contract.js
```

### 2. Migrate Existing Process Servers
For each existing process server:
1. Grant them `PROCESS_SERVER_ROLE` (auto-assigns ID)
2. Have them call `registerProcessServer()` to add their details

### 3. Update Frontend
The frontend will need updates to:
- Display server IDs: "Process Server #5"
- Show server details in notices
- Update token name display

## Benefits

1. **Accountability**: Every notice shows which server created it
2. **Tracking**: Easy to see all notices by a specific server
3. **Professional**: Numbered servers look more official
4. **Persistent**: IDs remain constant across sessions
5. **On-chain**: No backend needed, all data on blockchain

## Example Usage

When Process Server connects:
```
Welcome Process Server #5
Agency: County Court Services
Notices Served: 127
```

When creating notice:
```
Token Name: PS#5-Summons-2024-001
Created by: Process Server #5 (County Court Services)
```

## Testing on Nile

1. Deploy the new contract
2. Grant yourself process server role
3. Check your assigned ID
4. Create a test notice
5. Verify token name includes your server ID

## Gas Costs
- Minimal additional gas for storing server data
- One-time registration cost per server
- No ongoing overhead for normal operations