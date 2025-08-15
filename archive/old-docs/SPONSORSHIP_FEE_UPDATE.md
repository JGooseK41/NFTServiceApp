# Sponsorship Fee Update Summary

## Changes Made

### Contract Updates (LegalNoticeNFT_Simplified.sol)

1. **Mandatory Sponsorship Fee**
   - Sponsorship fee (2 TRX) is now always included in all transactions
   - Cannot be waived or made optional
   - Ensures recipients can always accept notices without needing TRX

2. **Fee Structure**
   ```
   Total Fee = Base Fee + Sponsorship Fee (2 TRX)
   
   Where Base Fee is:
   - Document Notice: 150 TRX (or 75 TRX with process server role)
   - Text Notice: 15 TRX
   - With exemptions:
     - Full exemption: 0 TRX (only pay sponsorship)
     - 50% exemption: Half of base fee
   ```

3. **Exemption Rules**
   - Full fee exemption: Only affects service/creation fee, NOT sponsorship
   - 50% fee exemption: Only affects service fee, NOT sponsorship
   - Process servers: Pay creation fee (75 TRX) instead of service fee
   - **Sponsorship fee is NEVER waived**

### Frontend Updates

1. **Removed Sponsorship Checkbox**
   - Replaced with informational box explaining sponsorship is included
   - Shows green gift icon with "Recipient Sponsorship Included"
   - Explains recipients can accept without needing TRX

2. **Updated Fee Display**
   - Shows breakdown: "Document fee (150) + Sponsorship (2)"
   - For text notices: "Text fee (15) + Sponsorship (2)"
   - With exemptions: Shows adjusted base fee + sponsorship

3. **Updated Fee Calculations**
   - Always adds 2 TRX to the base fee
   - No conditional logic for sponsorship
   - Clear breakdown in fee descriptions

## Example Fee Calculations

### Regular User
- Document Notice: 150 + 2 = **152 TRX**
- Text Notice: 15 + 2 = **17 TRX**

### Process Server
- Document Notice: 75 + 2 = **77 TRX**
- Text Notice: 15 + 2 = **17 TRX**

### User with 50% Exemption
- Document Notice: 75 + 2 = **77 TRX**
- Text Notice: 7.5 + 2 = **9.5 TRX**

### User with Full Exemption
- Document Notice: 0 + 2 = **2 TRX**
- Text Notice: 0 + 2 = **2 TRX**

## Benefits

1. **Simplicity**: No checkbox to confuse users
2. **Reliability**: Recipients always have acceptance covered
3. **Fairness**: Everyone contributes to recipient support
4. **Transparency**: Clear fee breakdown shown

## Testing Checklist

- [ ] Create document notice as regular user (152 TRX)
- [ ] Create text notice as regular user (17 TRX)
- [ ] Create notice as process server (77 TRX for document)
- [ ] Create notice with 50% exemption (77 TRX for document)
- [ ] Create notice with full exemption (2 TRX only)
- [ ] Verify recipient can accept without TRX
- [ ] Verify fee breakdown displays correctly