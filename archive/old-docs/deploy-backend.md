# Backend Deployment Instructions

## Files to Deploy

The backend needs these updated files deployed to Render:

1. **backend/server.js** - Main server with all endpoints
2. **backend/routes/cases.js** - Case management with multi-recipient support
3. **backend/routes/blockchain-sync.js** - Blockchain sync functionality
4. **backend/migrations/unified-system.sql** - Database schema

## Required Environment Variables

Ensure these are set in Render:

```
DATABASE_URL=your_postgres_connection_string
NODE_ENV=production
PORT=3001
```

## Database Migration

After deployment, run the migration:

```sql
-- Run backend/migrations/unified-system.sql
```

## Test Endpoints

Once deployed, test these endpoints:

1. Health Check:
```bash
curl https://nft-legal-service-backend.onrender.com/health
```

2. Sync Blockchain:
```bash
curl -X POST https://nft-legal-service-backend.onrender.com/api/sync-blockchain \
  -H "Content-Type: application/json" \
  -d '{"serverAddress": "TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY"}'
```

3. Get Cases:
```bash
curl https://nft-legal-service-backend.onrender.com/api/servers/TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY/cases
```

## Frontend Configuration

Make sure the frontend points to the correct backend:

```javascript
// In js/unified-notice-system.js
this.backend = 'https://nft-legal-service-backend.onrender.com';
```

## Multi-Recipient Features

The system now supports:
- Multiple recipients per case number
- Individual tracking for each recipient
- Aggregate status display (All Signed, Partially Signed, Awaiting)
- Separate Alert/Document NFT pairs per recipient
- Individual receipt generation per recipient