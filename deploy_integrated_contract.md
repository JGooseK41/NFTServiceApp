# Deploy Fully Integrated Contract

## 1. Contract Features
- ✅ serveNotice() with all parameters (agency, case number, etc.)
- ✅ Working fee exemptions (serviceFeeExemptions, fullFeeExemptions)  
- ✅ Resource sponsorship for recipients
- ✅ Role management (ADMIN_ROLE, PROCESS_SERVER_ROLE)
- ✅ View-gated documents with encryption
- ✅ Alert tracking and acknowledgment
- ✅ Withdraw function for collected fees
- ✅ Full TRC-721 compliance

## 2. Deploy Using Nile

```bash
# Open Nile IDE
https://nile.dev

# 1. Upload the contract file:
contracts/LegalNoticeNFT_FullyIntegrated.sol

# 2. Also upload these interface files:
contracts/ITRC721.sol
contracts/ITRC721Metadata.sol
contracts/ITRC165.sol

# 3. Select compiler version: 0.8.0 or higher

# 4. Compile and deploy
```

## 3. Post-Deployment Tasks

After deployment, note your contract address and update the frontend:

1. Update CONTRACT_ADDRESS in index.html
2. Update CONTRACT_ABI with the new ABI from compilation
3. Test all features

## 4. Contract Functions

### For Users:
- `serveNotice()` - Serve a legal notice with view-gating
- `acceptNotice()` - Accept and unlock document access
- `viewDocument()` - View encrypted document details
- `calculateFee()` - Check fee amount

### For Admins:
- `setFeeExemption()` - Grant fee exemptions
- `grantRole()` - Assign roles to users
- `withdraw()` - Withdraw collected fees

### View Functions:
- `getAlertDetails()` - Get comprehensive alert information
- `getRecipientAlerts()` - Get all alerts for a recipient
- `hasRole()` - Check if address has a role
- `serviceFeeExemptions()` - Check service fee exemption
- `fullFeeExemptions()` - Check full fee exemption