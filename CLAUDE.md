## CRITICAL: Production File Structure

The root directory is deployed to Netlify (`publish = "."`). These are the ONLY files that matter for production:

### Frontend (LegalNotice App)
- **`/index.html`** - Main frontend HTML (this is the production file!)
- **`/js-v2/config.js`** - Configuration (network, backend URLs, contract addresses)
- **`/js-v2/app.js`** - Main application JavaScript
- **`/js-v2/modules/`** - All frontend modules (wallet.js, contract.js, cases.js, etc.)
- **`/js-v2/lite-contract-abi.json`** - Lite contract ABI (for Nile testnet)
- **`/js-v2/v5-contract-abi.json`** - V5 contract ABI (for mainnet)
- **`/js/`** - Additional JS files (case-management-client.js, energy integration)

### Recipient Portal (BlockServed.com)
- **`/index-blockserved.html`** - Recipient portal HTML (served for blockserved.com domain)

### Backend (Render)
- **`/backend/`** - Express server deployed to Render
- **`/backend/routes/`** - API route handlers

### DELETED (removed to prevent confusion)
- `/v2/` - DELETED
- `/v2-deploy/` - DELETED
- `/js-v2/js/` - DELETED (was orphaned duplicate of `/js-v2/modules/`)

### Ignore (not deployed)
- `/js-v2/index.html` - NOT used (root index.html is the production file)
- `/v1-backup/` - Backup only

**ALWAYS edit `/index.html` and `/js-v2/` files for frontend changes.**
**NEVER create new directories like v3/ or copies of existing files.**

---

## Planned Features / TODOs
- **Network badge in header**: Add a visual badge near the connected wallet showing current network (e.g., "Nile Testnet" or "Mainnet") to help users identify which network they're connected to

---

## Design Optimizations
- Remember the logic for design optimization of the tool

## Contract Type: Lite Contract
The application uses the **Lite Contract** which creates a single NFT per serve:
- One NFT per recipient containing proof of delivery
- Document access via blockserved.com portal
- Simplified fee structure (single serviceFee)
- Contract address: `TUM1cojG7vdtph81H2Dy2VyRqoa1v9FywW` (Nile testnet)

### NFT Specifications
- **Single Token Per Serve**: Each recipient receives one NFT
- **Proof of Delivery**: NFT serves as blockchain-verified proof of service
- **Document Access**: Recipients access full documents at blockserved.com
- **Status**: Always shows "Delivered" once minted
- **Metadata**: Contains case number, agency, service date, and portal link