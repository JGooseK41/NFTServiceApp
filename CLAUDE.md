## CRITICAL: Production File Structure

The root directory is deployed to Netlify (`publish = "."`). These are the ONLY files that matter for production:

### Frontend (LegalNotice App)
- **`/index.html`** - Main frontend HTML (this is the production file!)
- **`/js-v2/config.js`** - Configuration (network, backend URLs, contract addresses)
- **`/js-v2/app.js`** - Main application JavaScript
- **`/js-v2/modules/`** - All frontend modules (wallet.js, contract.js, cases.js, etc.)
- **`/js/`** - Additional JS files (case-management-client.js, energy integration)

### Recipient Portal (BlockServed.com)
- **`/index-blockserved.html`** - Recipient portal HTML (served for blockserved.com domain)

### Backend (Render)
- **`/backend/`** - Express server deployed to Render
- **`/backend/routes/`** - API route handlers

### DO NOT EDIT (deprecated/backup directories)
- `/v2/` - Old version, NOT deployed
- `/v2-deploy/` - Old version, NOT deployed
- `/js-v2/index.html` - NOT used (root index.html is the production file)
- `/v1-backup/` - Backup only

**ALWAYS edit `/index.html` and `/js-v2/` files for frontend changes.**

---

## Design Optimizations
- Remember the logic for design optimization of the tool

## NFT Type Specifications
### Alert NFT
- Proof of delivery
- Always shows "Delivered" once sent
- Displays delivery timestamp
- No tracking of acknowledgment needed
- Purpose: Legal notice delivery confirmation

### Document NFT
- Legal document for signature
- Shows "Document Signed For" only when recipient actually signs the document
- Shows "Awaiting Signature" until signed
- This is the critical status for legal acceptance
- Purpose: Legal document requiring signature