# NFT Token Cataloging System Design

## Current Issues
- Notice IDs are confusing (e.g., 943220202 vs Token ID 12)
- Difficult to track which alert pairs with which document
- No clear reference system for legal proceedings

## Implemented Cataloging System

### 1. Unified Notice Reference (UNR)
Format: `CASE#-ALERTID-DOCID`
- Example: `34-2501-8285700-12-13` (Alert Token 12, Document Token 13)

### 2. Display Format
```
┌─────────────────────────────────────┐
│ Token ID: 12 (Alert NFT)            │
│ Case: 34-2501-8285700               │
│ Paired with: Document Token 13      │
│ Status: Delivered                   │
└─────────────────────────────────────┘
```

### 3. Database Structure
```sql
-- Enhanced notice_components table
ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS alert_token_id INTEGER;
ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS document_token_id INTEGER;
ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS unified_reference VARCHAR(100);
ALTER TABLE notice_components ADD COLUMN IF NOT EXISTS notice_pair_id VARCHAR(50);

-- Create index for faster lookups
CREATE INDEX idx_token_ids ON notice_components(alert_token_id, document_token_id);
CREATE INDEX idx_unified_reference ON notice_components(unified_reference);
```

### 4. Frontend Display Changes

#### Recent Notices Card
```
┌──────────────────────────────────────────┐
│ 📋 Case #34-2501-8285700                 │
│                                          │
│ 🔔 Alert Token: 12  📄 Document Token: 13 │
│ Recipient: T9yD14...                    │
│ Status: ✅ Delivered | ⏳ Awaiting Sig  │
│                                          │
│ [View Alert] [View Document] [Receipt]  │
└──────────────────────────────────────────┘
```

#### Search & Filter
- Search by token ID: "12" finds Alert Token 12
- Search by case: "34-2501-8285700" 
- Search by pair: "12-13" finds paired notices
- Filter by status, date range, recipient

### 5. API Endpoints

#### GET /api/notices/token/:id
Returns notice by NFT token ID

#### GET /api/notices/pair/:alertId/:documentId
Returns paired notice information

#### GET /api/notices/unified/:reference
Returns notice by unified reference

### 6. Benefits
1. **Legal Clarity**: Clear reference system for court documents
2. **Easy Tracking**: Find notices by blockchain ID instantly
3. **Pair Visibility**: Always see which alert/document are paired
4. **Intuitive Search**: Multiple ways to find notices
5. **Professional Display**: Clean, organized presentation

### 7. Implementation Priority
1. Update frontend to display blockchain IDs prominently ✅
2. Add blockchain ID columns to database
3. Create unified reference generator
4. Update search functionality
5. Enhance receipt generation with clear references