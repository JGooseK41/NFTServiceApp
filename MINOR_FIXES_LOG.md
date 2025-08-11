# Minor Fixes Log
*Items to address in next iteration - no immediate action needed*

## Critical Bugs
- [ ] **DRAFTS NOT WORKING**: Save and load draft feature is not functioning - needs debugging
- [ ] **INVALID CALLVALUE ERROR**: Transaction failing with "Invalid callValue provided" - likely mismatch between calculated fees and actual contract requirements

## UI/UX Issues
- [ ] **DUPLICATE BUTTON**: Image loading page has 2 buttons that do the same thing - "Encrypt" and "Move to Transaction Details" - keep only "Move to Transaction Details"
- [ ] **AUTO-FILL AGENCY**: Issuing agency field should auto-populate from the process server's registration info
- [ ] **TOKEN NAME FIELD**: Unclear use case for "Token Name" input - consider removing or auto-generating from case number/type
- [ ] **STATUS MODAL TIMING**: Messages and tips in acquiring energy modal scroll too fast - should display 2x longer (change from 3 to 6 seconds)
- [ ] Staging dialog close button (X) might need better positioning
- [ ] Draft save notification could persist too briefly (3 seconds)
- [ ] Energy rental explanation text might be too technical for some users
- [ ] Progress bar animation could restart more smoothly between phases
- [ ] Modal overlays could use escape key to close

## Code Cleanup
- [ ] Remove console.log statements from production code
- [ ] Consolidate duplicate CORS origin arrays into single config
- [ ] Remove commented-out batch mode code remnants
- [ ] Standardize error message formats across all modules

## Performance
- [ ] Draft list could paginate if user has many drafts
- [ ] Image compression could show progress for large files
- [ ] Consider caching JustLend contract instance

## Validation
- [ ] Add recipient address validation before staging
- [ ] Warn if case number contains special characters
- [ ] Check file size before upload attempt

## Backend
- [ ] Add index on transaction_id for faster lookups
- [ ] Consider archiving old staged transactions
- [ ] Add retry logic for IPFS uploads

## Documentation
- [ ] Add JSDoc comments to main functions
- [ ] Update README with new staging flow
- [ ] Document environment variables needed

## Testing Needed
- [ ] Test with very large recipient lists (50+)
- [ ] Test with slow network connections
- [ ] Test draft system with expired sessions
- [ ] Verify energy rental with different amounts

## Future Enhancements
- [ ] Add transaction history view
- [ ] Email notifications option
- [ ] Bulk draft operations (delete multiple)
- [ ] Export transaction receipts as PDF
- [ ] Add dark/light theme toggle

---
*Last Updated: 2025-08-11*
*Add new items as discovered - no need to fix immediately*