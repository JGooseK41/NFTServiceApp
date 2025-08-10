# Complete Workflow Audit - Current State vs Requirements

## 1. PROCESS SERVER REGISTRATION

### Requirements:
- [ ] Store server ID (from blockchain)
- [ ] Store Name
- [ ] Store Agency
- [ ] Store Address
- [ ] Store Phone Number
- [x] Store Wallet Address

### Current Implementation:
- **Blockchain**: Servers get ID from smart contract (serverById mapping)
- **Backend Database**: `process_servers` table has:
  - ✅ wallet_address
  - ✅ agency_name
  - ✅ phone_number
  - ✅ contact_email
  - ❌ **MISSING**: server_id (blockchain ID)
  - ❌ **MISSING**: server_name
  - ❌ **MISSING**: physical_address

### Gap #1: No Backend Registration Sync
**Issue**: When a process server registers on blockchain, the backend is NOT notified
**Solution Needed**: 
1. After blockchain registration, call backend API to store server details
2. Add server_id, server_name, physical_address columns to process_servers table

---

## 2. NOTICE CREATION & STORAGE

### Requirements:
- [x] Store Alert Notice ID
- [x] Store Document Notice ID
- [x] Store Creation Date
- [x] Store Server Address
- [x] Store Recipient Address
- [ ] Store Document Image
- [ ] Store Alert Thumbnail
- [x] Store Transaction Data

### Current Implementation:

#### Tables Involved:
1. **served_notices** - Basic notice metadata
   - ✅ alert_id
   - ✅ document_id
   - ✅ server_address
   - ✅ recipient_address
   - ✅ created_at
   - ✅ transaction_hash (after ipfs migration)
   - ❌ No image URLs

2. **notice_components** - Document storage (EMPTY!)
   - ✅ Structure exists for images
   - ❌ Not being populated

### Gap #2: Document Upload Not Connected
**Issue**: Documents processed on frontend but not sent to backend
**Status**: FIXED in latest commit (upload-notice-documents.js)
**Note**: Only works for NEW notices after deployment

---

## 3. RECIPIENT ACCESS TRACKING

### Requirements:
- [x] Track all access attempts
- [x] Track IP addresses
- [x] Track device info
- [x] Track location data
- [x] Associate with specific notice ID
- [x] Make available in audit trail

### Current Implementation:

#### Tables:
1. **notice_views** - Tracks viewing
   - ✅ notice_id
   - ✅ viewer_address
   - ✅ ip_address
   - ✅ user_agent
   - ✅ location_data
   - ✅ viewed_at

2. **wallet_connections** - Tracks connections
   - ✅ wallet_address
   - ✅ ip_address
   - ✅ location_data
   - ✅ device_info

3. **audit_logs** - General audit trail
   - ✅ action_type
   - ✅ actor_address
   - ✅ target_id
   - ✅ details (JSONB)

### Gap #3: Tracking Not Fully Integrated
**Issue**: Tracking happens but may not be linked to specific notices
**Frontend**: device-tracker.js collects data
**Backend**: Has endpoints but may not be called consistently

---

## 4. AUDIT TRAIL RETRIEVAL

### Requirements:
- [x] Process server can view all tracking data
- [x] Data exportable for court
- [ ] Linked to specific notices

### Current Implementation:
- ✅ court-report-generator.js creates reports
- ✅ unified-notice-system.js has audit functions
- ⚠️ Backend endpoints exist but may return empty data

### Gap #4: Audit Data Retrieval
**Issue**: `/api/notices/:noticeId/audit` endpoint exists but may not aggregate all data correctly

---

## CRITICAL MISSING PIECES:

### 1. **Server Registration Sync**
```javascript
// MISSING: After blockchain registration
async function syncServerToBackend(serverId, serverData) {
    await fetch('/api/servers/register', {
        method: 'POST',
        body: JSON.stringify({
            server_id: serverId,
            wallet_address: serverData.address,
            server_name: serverData.name,
            agency_name: serverData.agency,
            physical_address: serverData.address,
            phone_number: serverData.phone
        })
    });
}
```

### 2. **Database Schema Updates Needed**
```sql
ALTER TABLE process_servers ADD COLUMN server_id INTEGER UNIQUE;
ALTER TABLE process_servers ADD COLUMN server_name VARCHAR(255);
ALTER TABLE process_servers ADD COLUMN physical_address TEXT;
```

### 3. **Document Storage** (FIXED)
- Latest commit adds upload-notice-documents.js
- Will work for NEW notices after deployment

### 4. **Consistent Tracking Calls**
- Need to ensure all recipient actions call tracking endpoints
- device-tracker.js exists but needs to be called on BlockServed access

---

## TESTING CHECKLIST:

### Process Server Registration:
- [ ] Register on blockchain
- [ ] Check if server_id stored in backend
- [ ] Verify all fields captured

### Notice Creation:
- [ ] Create notice with document
- [ ] Check notice_components table for images
- [ ] Verify served_notices has record

### Recipient Access:
- [ ] Access notice on BlockServed
- [ ] Check notice_views table
- [ ] Check wallet_connections table
- [ ] Verify IP/device data captured

### Audit Trail:
- [ ] Request audit for specific notice
- [ ] Verify all events included
- [ ] Test court report generation

---

## PRIORITY FIXES:

1. **HIGH**: Add server registration backend sync
2. **HIGH**: Update process_servers table schema
3. **MEDIUM**: Verify tracking calls on BlockServed
4. **LOW**: Enhance audit aggregation

---

## CONCLUSION:

The system architecture is mostly complete but has critical gaps in:
1. Server registration data flow to backend
2. Document storage (fixed but needs deployment)
3. Ensuring all tracking happens consistently

With these fixes, the complete workflow will function as intended.