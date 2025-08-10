# Batch Serving Guide - Send to Multiple Recipients

## Overview
You can serve the same legal notice to multiple wallet addresses in a single batch operation, saving time and potentially reducing costs through energy optimization.

## How to Access Batch Mode

1. Click "Create Legal Notice" button
2. In the modal header, click the **"Batch Mode"** button (next to Clear All)
3. The batch interface will open

## Batch Serving Process

### Step 1: Upload Recipients List
Create a CSV file with the following format:
```csv
wallet_address,name,reference
TAddress1...,John Doe,Case-001
TAddress2...,Jane Smith,Case-002
TAddress3...,Bob Johnson,Case-003
```

**CSV Format Requirements:**
- First column: TRON wallet address (required)
- Second column: Recipient name (optional)
- Third column: Reference number (optional)
- No header row needed

### Step 2: Upload Your Document
- Upload the legal document that will be sent to all recipients
- The same document will be encrypted individually for each recipient
- Each recipient can only decrypt their own copy

### Step 3: Enter Notice Details
- **Agency Name**: Your organization name
- **Case Number**: Reference number for this batch
- **Rights Statement**: Will be auto-generated

### Step 4: Start Batch Processing
- Click "Start Batch Processing"
- The system will process each recipient sequentially
- You can pause/resume the batch at any time

## Cost Considerations

### Energy Optimization
- The system automatically rents energy before starting the batch
- Energy rental can significantly reduce costs for multiple transactions
- Example savings:
  - Without energy: ~100 TRX per notice
  - With energy rental: ~10-20 TRX per notice + rental fee

### Total Cost Calculation
```
Total Cost = (Service Fee × Number of Recipients) + Energy Rental Fee
```

### Cost Breakdown Example (10 recipients):
- **Without Batch/Energy Optimization**: 10 × 100 TRX = 1000 TRX
- **With Batch Energy Rental**: 
  - Energy rental: ~200 TRX
  - Per notice: 10 × 15 TRX = 150 TRX
  - Total: 350 TRX (65% savings!)

## Features During Batch Processing

### Progress Tracking
- Real-time progress bar
- Current recipient being processed
- Success/failure count
- Individual status for each recipient

### Pause/Resume
- Click "Pause" to stop processing
- Click "Resume" to continue where you left off
- Useful if you need to handle issues mid-batch

### Error Handling
- Failed transactions are logged but don't stop the batch
- You can retry failed recipients later
- Each failure shows the error reason

### Export Results
- Download CSV with all results
- Includes:
  - Wallet addresses
  - Status (success/failed)
  - Notice IDs (Alert & Document)
  - Transaction hashes
  - Error messages (if any)

## Best Practices

1. **Test First**: Try with 1-2 addresses before large batches
2. **Verify Addresses**: Ensure all wallet addresses are valid TRON addresses
3. **Energy Rental**: Always rent energy for batches > 3 recipients
4. **Document Size**: Keep documents under 2MB for faster processing
5. **Network Stability**: Ensure stable internet connection
6. **Monitor Progress**: Keep the browser tab open during processing

## Limitations

- Maximum recommended batch size: 100 recipients
- Each recipient gets individual NFTs (Alert + Document)
- Processing is sequential (not parallel) for reliability
- Browser must stay open during processing

## Technical Details

### What Happens for Each Recipient:
1. Document is encrypted with recipient's address
2. Encrypted document uploaded to IPFS
3. Alert NFT minted to recipient's wallet
4. Document NFT minted to recipient's wallet
5. Transaction recorded on blockchain
6. Backend stores unencrypted copy for server access

### Transaction Structure:
- One blockchain transaction per recipient
- Each transaction creates 2 NFTs (Alert + Document)
- All transactions use the same energy rental

## Troubleshooting

### Common Issues:

**"Invalid wallet address"**
- Ensure addresses start with 'T' and are 34 characters
- Remove any spaces or special characters

**"Energy rental failed"**
- Check TRX balance (need enough for rental + fees)
- Try manual energy rental at energy.store

**"Document upload failed"**
- Check internet connection
- Ensure document is under 10MB
- Try re-uploading the document

**"Transaction failed for recipient"**
- Recipient address may be a smart contract
- Insufficient energy (rent more)
- Network congestion (retry later)

## Support

For issues or questions about batch serving:
1. Check the transaction history for error details
2. Export the batch results CSV for analysis
3. Contact support with the batch ID and error messages