# Admin Functions Summary - LegalNoticeNFT_Simplified

## Overview
As the admin (ADMIN_ROLE holder), you have complete control over the contract. Here's a comprehensive list of all admin functions available:

## Fee Management

### 1. **Update Individual Fees**
```solidity
updateServiceFee(uint256 newFee) // Updates document notice fee
updateDocumentFee(uint256 newFee) // Same as above
updateTextFee(uint256 newFee) // Updates text-only notice fee  
updateCreationFee(uint256 newFee) // Updates process server creation fee
updateSponsorshipFee(uint256 newFee) // Updates sponsorship fee
updateProcessServerDiscount(uint256 newDiscount) // Update discount percentage (0-100)
```

### 2. **Update All Fees at Once**
```solidity
updateFees(
    uint256 _serviceFee,
    uint256 _textOnlyFee,
    uint256 _creationFee,
    uint256 _sponsorshipFee
)
```

### 3. **Fee Exemptions**
```solidity
setFeeExemption(address user, bool serviceFeeExempt, bool fullFeeExempt)
// serviceFeeExempt = 50% discount
// fullFeeExempt = 100% discount (free)
```

### 4. **Fee Collector Management**
```solidity
updateFeeCollector(address newCollector) // Change where fees go
```

## Fund Management

### 1. **Withdraw Contract Balance**
```solidity
withdraw() // Withdraws entire balance to fee collector
withdrawTRX(uint256 amount) // Withdraw specific amount to fee collector
```

## Process Server Management

### 1. **Role Management**
```solidity
grantRole(PROCESS_SERVER_ROLE, address) // Add process server (auto-assigns ID)
revokeRole(PROCESS_SERVER_ROLE, address) // Remove role
addProcessServer(address server) // Helper function for grantRole
removeProcessServer(address server) // Helper to revoke role + deactivate
```

### 2. **Server Status Management**
```solidity
deactivateProcessServer(address server) // Temporarily disable
reactivateProcessServer(address server) // Re-enable
```

### 3. **Server Information**
- Process servers automatically get assigned sequential IDs (1, 2, 3...)
- IDs persist and are used in token names (PS#1-Notice, PS#2-Notice)
- Servers can update their own info via `registerProcessServer(name, agency)`

## Emergency Controls

### 1. **Pause/Unpause Contract**
```solidity
pause() // Stop all notice creation
unpause() // Resume operations
```

## Role Hierarchy

1. **DEFAULT_ADMIN_ROLE** - Can manage all roles
2. **ADMIN_ROLE** - Can manage fees, withdrawals, servers
3. **PROCESS_SERVER_ROLE** - Gets discounted fees, auto-assigned IDs

## What's NOT Included (vs Original Contract)

The simplified contract removed some complex features:
- Resource sponsorship (energy/bandwidth delegation) 
- Token minting/burning/transfers
- Complex URI management
- NFT marketplace features

These were removed to focus on the core legal notice functionality.

## Energy/Resource Management

For TRON energy and bandwidth management, this needs to be handled at the wallet level:
- Use TronLink or other wallets to freeze TRX for energy
- Contract doesn't directly manage energy delegation
- Consider using energy rental services like JustLend

## Example Admin Usage

```javascript
// Update all fees
await contract.updateFees(
    150000000, // 150 TRX document fee
    15000000,  // 15 TRX text fee
    75000000,  // 75 TRX process server fee
    2000000    // 2 TRX sponsorship
);

// Add process server
await contract.addProcessServer("TProcessServerAddress");

// Set fee exemption
await contract.setFeeExemption("TRecipientAddress", false, true); // Free notices

// Withdraw funds
await contract.withdraw(); // All funds to collector

// Emergency pause
await contract.pause(); // Stop all operations
```

## Security Notes

1. Only addresses with ADMIN_ROLE can call these functions
2. Contract owner gets DEFAULT_ADMIN_ROLE + ADMIN_ROLE on deployment
3. Be careful with role management - don't revoke your own admin access!
4. Always test fee changes on testnet first
5. Keep fee collector address secure

## Deployment Checklist

Before mainnet deployment:
- [ ] Set appropriate fees for your jurisdiction
- [ ] Assign process server roles to verified servers
- [ ] Set fee collector to secure multi-sig wallet
- [ ] Test all admin functions on testnet
- [ ] Document admin procedures for your team