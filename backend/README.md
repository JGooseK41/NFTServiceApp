# NFT Legal Service Backend

This backend provides API endpoints for tracking legal notice views, acceptances, and audit trails.

## Setup

### Local Development

1. Install PostgreSQL
2. Create a database:
```bash
createdb nft_legal_service
```

3. Initialize the database:
```bash
psql -d nft_legal_service -f init.sql
```

4. Install dependencies:
```bash
npm install
```

5. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your database connection string
```

6. Start the server:
```bash
npm start
```

### Production (Render)

1. Create a PostgreSQL database on Render
2. Copy the Internal Database URL
3. Set environment variables:
   - `DATABASE_URL` = Your PostgreSQL Internal URL
   - `NODE_ENV` = production
   - `PORT` = 3001

4. Run the init.sql script in the Render PostgreSQL console:
   - Go to your PostgreSQL instance on Render
   - Click "Connect" → "PSQL Command"
   - Copy and paste the contents of init.sql

## API Endpoints

### View Tracking
- `POST /api/notices/:noticeId/views` - Log a notice view
- `GET /api/notices/:noticeId/audit` - Get audit trail for a notice

### Acceptance Tracking
- `POST /api/notices/:noticeId/acceptances` - Log notice acceptance

### Blockchain Cache
- `POST /api/cache/blockchain` - Cache blockchain data
- `GET /api/cache/blockchain?contract=ADDRESS` - Get cached data

### Process Server Registry
- `POST /api/process-servers` - Register a process server
- `GET /api/process-servers` - Get approved servers
- `GET /api/process-servers/:walletAddress` - Get server details

### Notice Metadata
- `POST /api/notices/served` - Track a newly served notice
- `GET /api/servers/:serverAddress/notices` - Get all notices for a server

## Testing

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

Test view logging:
```bash
curl -X POST http://localhost:3001/api/notices/1/views \
  -H "Content-Type: application/json" \
  -d '{
    "viewerAddress": "TTestAddress123",
    "ipAddress": "127.0.0.1",
    "userAgent": "Test Browser",
    "location": {"city": "Test City"},
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

## Database Schema

See `init.sql` for the complete database schema.

Key tables:
- `notice_views` - Tracks all views of notices
- `notice_acceptances` - Records acceptance transactions
- `served_notices` - Metadata about served notices
- `process_servers` - Registry of authorized servers
- `audit_logs` - General audit trail
- `blockchain_cache` - Cached blockchain data