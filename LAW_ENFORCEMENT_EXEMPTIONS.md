# Law Enforcement Fee Exemption System

## Overview
Fee exemptions are now exclusively for verified law enforcement agencies. They pay only the actual costs with no profit margins.

## How It Works

### Fee Structure for Law Enforcement
```
Law Enforcement Total Fee = Sponsorship Fee Only (2 TRX)

Breakdown:
- Service/Creation Fee: WAIVED (no profit)
- Sponsorship Fee: 2 TRX (required - covers recipient's acceptance)
- Energy/Gas: Paid by the law enforcement wallet
```

### Regular Fee Structure (for comparison)
```
Regular Users: 152 TRX (Document) or 17 TRX (Text)
Process Servers: 77 TRX (Document) or 17 TRX (Text)
Law Enforcement: 2 TRX (Any notice type)
```

## Contract Implementation

### New Functions
1. `setLawEnforcementExemption(address user, string agencyName)`
   - Sets law enforcement status
   - Requires agency name for accountability
   - Only callable by admin

2. `removeLawEnforcementExemption(address user)`
   - Removes law enforcement status
   - Clears agency name

3. `lawEnforcementExemptions(address) → bool`
   - Check if address has law enforcement status

4. `lawEnforcementAgencies(address) → string`
   - Get agency name for law enforcement address

### Fee Calculation Logic
```solidity
if (lawEnforcementExemptions[msg.sender]) {
    // Law enforcement pays only sponsorship (no profit)
    requiredFee = sponsorshipFee;  // 2 TRX only
} else if (hasRole(PROCESS_SERVER_ROLE, msg.sender)) {
    requiredFee = creationFee + sponsorshipFee;  // 77 TRX
} else {
    requiredFee = serviceFee + sponsorshipFee;   // 152 TRX
}
```

## Frontend Updates

### Admin Panel Changes
- Removed generic "fee exemption" checkboxes
- Added dedicated "Law Enforcement Agency" section
- Agency name field is required for law enforcement exemptions
- Clear labeling: "Law enforcement agencies pay only actual gas costs"

### Fee Display Updates
- Shows "Law Enforcement (Agency Name) - Sponsorship only (2 TRX)"
- Clearly indicates cost-only pricing
- Updates automatically when user has law enforcement status

## Usage Instructions

### To Grant Law Enforcement Status:
1. Go to Admin Panel → Role Management
2. Enter law enforcement wallet address
3. Check "Grant law enforcement exemption"
4. Enter agency name (e.g., "FBI", "DEA", "Local PD")
5. Click "Grant Role"

### What Law Enforcement Pays:
- **Document Notices**: 2 TRX (vs 152 TRX regular)
- **Text Notices**: 2 TRX (vs 17 TRX regular)
- **Energy**: From their own wallet
- **No profit margins included**

## Security & Accountability

1. **Agency Tracking**: Every law enforcement address is linked to an agency name
2. **Admin Only**: Only contract admin can grant law enforcement status
3. **Transparent**: Agency name visible in transactions
4. **Revocable**: Admin can remove law enforcement status anytime

## Example Scenarios

### FBI Serving Notice
- Agent wallet: `TWallet123...`
- Agency: "FBI - Cyber Division"
- Cost: 2 TRX + gas
- Savings: 150 TRX per document notice

### Local Police Department
- Department wallet: `TWallet456...`
- Agency: "Springfield Police Department"
- Cost: 2 TRX + gas
- Can serve unlimited notices at cost

## Benefits

1. **For Law Enforcement**:
   - No profit margins on official business
   - Predictable costs (always 2 TRX)
   - Fast processing

2. **For Platform**:
   - Clear audit trail
   - Agency accountability
   - Supports law enforcement operations

3. **For Recipients**:
   - Acceptance still sponsored
   - No difference in experience
   - Verified law enforcement notices

## Important Notes

- Energy costs are NOT included in the 2 TRX fee
- Law enforcement must maintain sufficient TRX for energy
- Consider using energy rental services for high volume
- The 2 TRX sponsorship ensures recipients can always accept