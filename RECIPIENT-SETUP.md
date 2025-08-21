# Recipient Portal Setup - BlockServed.com

## Overview
The recipient portal is a dedicated interface for legal notice recipients to:
- View their served notices
- Sign for receipt via blockchain
- Download decrypted documents
- Generate service receipts with audit trail

## Features

### 1. Wallet Connection
- TronLink integration for recipient authentication
- Automatic wallet detection and connection

### 2. Notice Verification
- Checks blockchain for notices sent to recipient's address
- Displays all pending and signed notices
- Groups notices by case number

### 3. Signature Process
- Smart contract interaction to sign for document receipt
- Creates immutable blockchain record of service
- Triggers audit trail recording

### 4. Document Access
- Decryption of protected documents
- PDF viewing directly in browser
- Download options for documents and receipts

### 5. Audit Trail
The system collects comprehensive audit data for legal compliance:
- **IP Address & Geolocation**: City, state, country, postal code
- **Timestamp**: Exact time of viewing and signing
- **Device Info**: Browser, operating system, screen resolution
- **Transaction ID**: Blockchain proof of signature

## Deployment Instructions

### For Netlify (blockserved.com)

1. **Create a new Netlify site** for blockserved.com

2. **Set the build settings:**
   - Build command: (leave empty - no build needed)
   - Publish directory: `.`

3. **Deploy the recipient files:**
   ```bash
   # The repository already contains:
   - recipient.html (main recipient interface)
   - netlify-recipient.toml (Netlify configuration)
   ```

4. **Configure domain:**
   - Add custom domain: blockserved.com
   - Configure DNS settings as per Netlify instructions

5. **Environment variables** (if needed):
   - No environment variables required for frontend
   - Backend API URL is hardcoded to: https://nftserviceapp.onrender.com

### Database Setup

Run the migration to create audit trail table:
```bash
DATABASE_URL="your-database-url" node backend/migrations/create-audit-trail-table.js
```

This creates the `notice_audit_trail` table with columns for:
- Notice identification (notice_id, document_id, case_number)
- Recipient info (address, signature)
- Geolocation data (IP, city, country, coordinates)
- Device info (user agent, platform, screen resolution)
- Timestamps (viewed_at, signed_at)

## URL Structure

Recipients can access notices via:
- Direct link: `https://blockserved.com/?notice=NOTICE_ID`
- Case link: `https://blockserved.com/?case=CASE_NUMBER`
- General access: `https://blockserved.com/` (then connect wallet)

## API Endpoints

The recipient portal uses these backend endpoints:

### Get Notices
```
GET /api/notices/recipient/{address}
```
Returns all notices for a recipient

### Record Audit Trail
```
POST /api/notices/audit
```
Records viewing and signing events with full audit data

### Get Decryption Key
```
POST /api/notices/{noticeId}/decrypt
```
Returns decryption key after signature verification

### Get Document
```
GET /api/notices/{noticeId}/document
```
Returns decrypted PDF document

### Get Audit Trail (for servers)
```
GET /api/notices/audit/{caseNumber}
Headers: X-Server-Address
```
Returns complete audit trail for a case

## Security Features

1. **Wallet Authentication**: Only the recipient wallet can access their notices
2. **Signature Verification**: Smart contract validates signatures
3. **Encrypted Storage**: Documents stored encrypted, keys released after signing
4. **Audit Logging**: Complete trail for legal compliance
5. **CORS Protection**: Restricted to authorized domains

## Legal Compliance

The system provides legally compliant service by:
- **Proof of Delivery**: Blockchain record of notice creation
- **Proof of Receipt**: Signature transaction on blockchain
- **Jurisdiction Data**: IP-based location for legal venue
- **Time Stamping**: Immutable blockchain timestamps
- **Document Integrity**: Hash verification on blockchain

## Testing

1. **Local Testing:**
   ```bash
   # Open recipient.html directly in browser
   # Connect TronLink to testnet (Nile)
   ```

2. **Test Flow:**
   - Connect wallet
   - System checks for notices
   - Sign for receipt
   - View/download document
   - Check audit trail in database

## Troubleshooting

### Wallet Not Connecting
- Ensure TronLink is installed
- Check wallet is unlocked
- Verify on correct network (mainnet/testnet)

### Notices Not Found
- Verify recipient address is correct
- Check notices exist in database
- Ensure proper case number format

### Document Not Loading
- Check PDF exists on server
- Verify decryption key is valid
- Check CORS settings

## Support

For issues or questions:
- Check backend logs for API errors
- Verify database connectivity
- Ensure all migrations have run
- Check browser console for frontend errors