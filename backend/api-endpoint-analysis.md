# Backend API Endpoint Analysis

## Summary
This document maps all frontend API calls to required database tables and fields.

## API Endpoints Used by Frontend

### 1. BlockServed App (Recipient Side) - blockserved-app.html

#### Image Endpoints
- **GET `/api/images/{noticeId}`**
  - Headers: `X-Wallet-Address`
  - Returns: Image data for a notice
  - Database: `images` or `simple_images` table
  - Expected fields: `alert_image`, `document_image`, `alert_thumbnail`, `document_thumbnail`

- **GET `/api/images?role=recipient`**
  - Headers: `X-Wallet-Address`
  - Returns: All images where user is recipient
  - Database: `images` table WHERE `recipient_address = wallet`

- **PATCH `/api/images/{noticeId}/status`**
  - Updates signature status
  - Database: `images` table
  - Updates: `signature_status` field

#### Audit/Logging
- **POST `/api/audit/log`**
  - Logs user actions
  - Database: `audit_logs` table
  - Fields: `action_type`, `actor_address`, `target_id`, `details`, `ip_address`

#### Access Control
- **POST `/api/notices/check-access`**
  - Checks if recipient can access document
  - Database: `notice_components` or `served_notices`
  - Checks: `recipient_address` matches wallet

- **POST `/api/notices/log-view`**
  - Logs document view
  - Database: `notice_views` table
  - Fields: `notice_id`, `viewer_address`, `ip_address`, `viewed_at`

### 2. TheBlockService (Process Server Side) - index.html

#### Notice Management
- **GET `/api/servers/{serverAddress}/notices?limit=1000`**
  - Returns notices served by a specific server
  - Database: `served_notices` WHERE `server_address = serverAddress`
  - Fields needed: All notice data

- **GET `/api/notices/recent?limit=10`**
  - Returns recent notices across all servers
  - Database: `served_notices` ORDER BY `created_at` DESC

- **GET `/api/notices/all?limit=1000`**
  - Returns all notices
  - Database: `served_notices`

- **GET `/api/notices/{noticeId}/metadata`**
  - Returns metadata for specific notice
  - Database: `notice_components` or `served_notices`

- **POST `/api/notices/served`**
  - Records a new served notice
  - Database: `served_notices` INSERT
  - Fields: All notice data including blockchain info

#### Document Management
- **GET `/api/documents/{documentId}/original`**
  - Returns original document data
  - Database: `document_storage` WHERE `notice_id = documentId`
  - Returns: Base64 encoded document

#### Wallet/Connection Tracking
- **POST `/api/wallet-connections`**
  - Records wallet connection event
  - Database: `wallet_connections` INSERT
  - Fields: `wallet_address`, `event_type`, `ip_address`, `connected_at`

- **POST `/api/wallet-connections/notices-found`**
  - Updates when notices are found for wallet
  - Database: `wallet_connections` UPDATE
  - Updates: `notice_count`

- **GET `/api/wallets/{walletAddress}/connections`**
  - Returns connection history for wallet
  - Database: `wallet_connections` WHERE `wallet_address = walletAddress`

#### Process Server Admin
- **GET `/api/admin/process-servers/list`**
  - Lists all process servers
  - Database: `process_servers`
  - Fields: All server registration data

- **POST `/api/admin/process-servers/update`**
  - Updates process server info
  - Database: `process_servers` UPDATE

- **POST `/api/admin/process-servers/delete`**
  - Deletes process server
  - Database: `process_servers` DELETE

#### Notice Views/Acceptances
- **POST `/api/notices/{noticeId}/views`**
  - Records notice view
  - Database: `notice_views` INSERT
  - Fields: `notice_id`, `viewer_address`, `ip_address`, `viewed_at`

- **POST `/api/notices/{noticeId}/acceptances`**
  - Records notice acceptance/signature
  - Database: `notice_acceptances` INSERT (currently empty)
  - Fields: `notice_id`, `acceptor_address`, `transaction_hash`, `accepted_at`

#### Audit Trail
- **GET `/api/notices/{noticeId}/audit?serverAddress={serverAddress}`**
  - Returns audit trail for notice
  - Database: `audit_logs` WHERE `target_id = noticeId`

#### Caching
- **POST `/api/cache/blockchain`**
  - Stores blockchain data cache
  - Database: `blockchain_cache` INSERT/UPDATE
  - Fields: `cache_key`, `type`, `notice_id`, `data`, `network`

- **GET `/api/cache/blockchain?contract={contractAddress}`**
  - Retrieves cached blockchain data
  - Database: `blockchain_cache` WHERE `contract_address = contractAddress`

#### Case Management (2-Stage Workflow)
- **GET `/api/cases`**
  - Headers: `X-Wallet-Address`
  - Returns: Prepared cases for server
  - Database: `prepared_cases` WHERE `server_address = wallet`

- **POST `/api/cases`**
  - Creates new prepared case
  - Database: `prepared_cases` INSERT
  - Fields: `case_number`, `case_title`, `notice_type`, `issuing_agency`, `server_address`

- **POST `/api/cases/{caseId}/documents`**
  - Stores documents for case
  - Database: `case_documents` INSERT/UPDATE
  - Fields: `case_id`, `alert_image`, `document_image`, thumbnails

## Database Table Requirements

### Critical Tables (Must Keep)
1. **served_notices** (64 rows) - Main notice records
2. **notice_components** (51 rows) - Detailed notice data
3. **images** (11 rows) - Image storage
4. **document_storage** (13 rows) - Document storage
5. **audit_logs** (8222 rows) - Audit trail
6. **wallet_connections** (1075 rows) - Connection logs
7. **process_servers** (2 rows) - Server registrations
8. **blockchain_cache** (26 rows) - Blockchain data cache
9. **notice_views** (18 rows) - View tracking

### New Tables (Created)
1. **simple_images** - For simplified image retrieval
2. **prepared_cases** - For 2-stage workflow
3. **case_documents** - For case document storage

### Tables to Remove (0 rows, unused)
1. active_notices
2. document_access_log
3. document_access_tokens
4. draft_files
5. notice_acceptances (might need to keep for future)
6. notice_events
7. pending_notices
8. prepared_transactions
9. server_ratings
10. staged_files
11. staged_ipfs
12. transaction_hashes
13. access_attempts

## Field Mapping Issues to Address

### Issue 1: Image Storage
- Frontend expects: `/api/images/{noticeId}` 
- Current tables: `images` uses `notice_id`, `simple_images` uses `notice_id`
- Solution: Keep both tables, ensure consistent field naming

### Issue 2: Notice IDs
- Frontend uses: `noticeId`, `alertId`, `documentId`
- Database has: `notice_id`, `alert_id`, `document_id`
- Solution: Backend should handle both formats

### Issue 3: Wallet Address Fields
- Frontend sends: `X-Wallet-Address` header
- Database has: `server_address`, `recipient_address`, `wallet_address`
- Solution: Backend maps header to appropriate field based on context

### Issue 4: Status Fields
- Frontend expects: `signature_status` for documents
- Database has: Various status fields in different tables
- Solution: Ensure `images` table has `signature_status` field

## Recommended Actions

1. **Keep these tables** (have data):
   - served_notices
   - notice_components  
   - images
   - document_storage
   - simple_images (new)
   - prepared_cases (new)
   - case_documents (new)
   - audit_logs
   - wallet_connections
   - process_servers
   - blockchain_cache
   - notice_views
   - batch_uploads
   - notice_batch_items
   - staged_* tables (have data)

2. **Remove these tables** (empty, unused):
   - active_notices
   - document_access_log
   - document_access_tokens
   - draft_files
   - notice_acceptances (consider keeping for future)
   - notice_events
   - pending_notices
   - prepared_transactions
   - server_ratings
   - staged_files
   - staged_ipfs
   - transaction_hashes
   - access_attempts

3. **Backend API Implementation Required**:
   - `/api/images` endpoints (GET, POST, PATCH)
   - `/api/cases` endpoints (GET, POST)
   - Ensure all endpoints handle both camelCase and snake_case field names
   - Add proper error handling for missing data