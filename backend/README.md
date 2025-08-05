# NFT Service Backend

Backend API service for tracking legal notice delivery via blockchain NFTs.

## Features

- **View Tracking**: Log when notices are viewed, including IP and location data
- **Acceptance Tracking**: Record when notices are accepted on-chain
- **Audit Trail**: Complete audit history for process servers
- **Process Server Registry**: Maintain approved process server directory
- **Notice Metadata**: Store additional notice information

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Initialize database**:
   ```bash
   npm run init-db
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

## Deployment on Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `FRONTEND_URL`: Your frontend URL
   - `NODE_ENV`: `production`

4. Deploy!

## API Endpoints

### View Tracking
- `POST /api/notices/:noticeId/views` - Log notice view
- `POST /api/notices/:noticeId/acceptances` - Log notice acceptance
- `GET /api/notices/:noticeId/audit` - Get audit trail

### Process Server Registry
- `POST /api/process-servers` - Register new server
- `GET /api/process-servers` - List approved servers
- `GET /api/process-servers/:walletAddress` - Get server details

### Notice Metadata
- `POST /api/notices/:noticeId/metadata` - Store notice metadata

## Database Schema

See `schema.sql` for the complete database structure.