# Batch Serving - Audit Log & Tracking Architecture

## Overview
When serving notices to multiple recipients in a batch, each recipient's interaction is individually tracked for legal compliance and audit purposes.

## Tracking Hierarchy

```
Batch Operation
├── Batch ID (batch_timestamp_randomId)
├── Server Address (sender)
├── Total Recipients Count
├── Document Hash (same for all)
└── Individual Notices
    ├── Notice 1
    │   ├── Alert NFT ID
    │   ├── Document NFT ID
    │   ├── Recipient Address
    │   ├── Transaction Hash
    │   ├── IPFS Hash (unique encrypted)
    │   └── Tracking Events
    ├── Notice 2
    └── ... (continues for each recipient)
```

## Individual Recipient Tracking

### 1. Service Event (Blockchain)
```javascript
{
    eventType: "NoticeServed",
    batchId: "batch_1234567890_abc",
    noticeId: "alert_123",
    documentId: "doc_123",
    recipientAddress: "TAddress1...",
    serverAddress: "TServerAddress...",
    timestamp: "2024-01-10T10:30:00Z",
    transactionHash: "0xabc123...",
    blockNumber: 12345678,
    caseNumber: "CASE-2024-001",
    noticeType: "Summons"
}
```

### 2. Wallet Connection Tracking (Backend)
When ANY recipient visits blockserved.com and connects their wallet:

```javascript
{
    eventType: "wallet_connected",
    walletAddress: "TAddress1...",
    timestamp: "2024-01-10T14:30:00Z",
    ipAddress: "192.168.1.1",
    location: {
        city: "New York",
        region: "NY",
        country: "US",
        latitude: 40.7128,
        longitude: -74.0060
    },
    deviceInfo: {
        deviceId: "device_abc123",
        browser: "Chrome 120",
        os: "Windows 11",
        deviceType: "desktop",
        screen: "1920x1080"
    },
    sessionId: "session_1234567890"
}
```

### 3. Notice View Event
When recipient views their notices list:

```javascript
{
    eventType: "notices_viewed",
    walletAddress: "TAddress1...",
    timestamp: "2024-01-10T14:31:00Z",
    noticesFound: [
        {
            alertId: "123",
            documentId: "456",
            caseNumber: "CASE-2024-001",
            serverAddress: "TServerAddress...",
            batchId: "batch_1234567890_abc"  // Links to batch
        }
    ],
    viewDuration: 15000,  // milliseconds
    ipAddress: "192.168.1.1",
    sessionId: "session_1234567890"
}
```

### 4. Document Access Event
When recipient clicks to view the actual document:

```javascript
{
    eventType: "document_accessed",
    noticeId: "123",
    documentId: "456",
    batchId: "batch_1234567890_abc",
    recipientAddress: "TAddress1...",
    serverAddress: "TServerAddress...",
    timestamp: "2024-01-10T14:32:00Z",
    accessMethod: "decryption",  // or "directLink"
    ipAddress: "192.168.1.1",
    deviceInfo: {...},
    decryptionStatus: "success",
    viewingTime: 45000,  // milliseconds
    pagesViewed: [1, 2, 3],
    downloadAttempted: false
}
```

### 5. Document Acceptance/Signature Event
When recipient signs/accepts the document:

```javascript
{
    eventType: "document_accepted",
    noticeId: "123",
    documentId: "456", 
    batchId: "batch_1234567890_abc",
    recipientAddress: "TAddress1...",
    acceptanceMethod: "electronic_signature",
    timestamp: "2024-01-10T14:35:00Z",
    acceptanceTxHash: "0xdef456...",
    blockNumber: 12345679,
    ipAddress: "192.168.1.1",
    location: {...},
    deviceInfo: {...},
    signatureData: {
        signedMessage: "I acknowledge receipt...",
        signature: "0xsignature...",
        signerAddress: "TAddress1..."
    }
}
```

## Batch Analytics Dashboard

### Aggregate Metrics
```javascript
{
    batchId: "batch_1234567890_abc",
    totalRecipients: 50,
    deliveryStatus: {
        successful: 48,
        failed: 2,
        pending: 0
    },
    viewingStatus: {
        viewed: 35,        // Connected wallet and viewed
        notViewed: 13,     // Not yet accessed
        percentageViewed: 70
    },
    acceptanceStatus: {
        accepted: 28,
        pending: 7,
        notResponded: 13,
        acceptanceRate: 56
    },
    timeMetrics: {
        avgTimeToView: "4 hours 23 minutes",
        avgTimeToAccept: "18 hours 45 minutes",
        fastestResponse: "12 minutes",
        slowestResponse: "3 days 2 hours"
    }
}
```

## SQL Schema for Batch Tracking

```sql
-- Batch operations table
CREATE TABLE batch_operations (
    batch_id VARCHAR(50) PRIMARY KEY,
    server_address VARCHAR(42) NOT NULL,
    document_hash VARCHAR(66),
    total_recipients INTEGER,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    energy_rental_tx VARCHAR(66),
    total_cost_trx DECIMAL(10,2)
);

-- Individual batch recipients
CREATE TABLE batch_recipients (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(50) REFERENCES batch_operations(batch_id),
    recipient_address VARCHAR(42) NOT NULL,
    recipient_name VARCHAR(255),
    reference_number VARCHAR(100),
    alert_id VARCHAR(50),
    document_id VARCHAR(50),
    transaction_hash VARCHAR(66),
    status VARCHAR(20), -- 'pending', 'success', 'failed'
    error_message TEXT,
    processed_at TIMESTAMP,
    INDEX idx_batch_recipient (batch_id, recipient_address)
);

-- Recipient access logs (enhanced for batch tracking)
CREATE TABLE recipient_access_logs (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(50),  -- NULL for non-batch notices
    notice_id VARCHAR(50),
    recipient_address VARCHAR(42),
    event_type VARCHAR(50),
    ip_address VARCHAR(45),
    location_data JSON,
    device_data JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(100),
    INDEX idx_batch_access (batch_id, recipient_address),
    INDEX idx_notice_access (notice_id, recipient_address)
);

-- Batch performance metrics (aggregated hourly)
CREATE TABLE batch_metrics (
    batch_id VARCHAR(50),
    metric_hour TIMESTAMP,
    total_views INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_acceptances INTEGER DEFAULT 0,
    avg_time_to_view_seconds INTEGER,
    avg_time_to_accept_seconds INTEGER,
    PRIMARY KEY (batch_id, metric_hour)
);
```

## API Endpoints for Batch Tracking

### 1. Get Batch Status
```
GET /api/batch/{batchId}/status
```
Returns overall batch metrics and delivery status

### 2. Get Individual Recipient Status
```
GET /api/batch/{batchId}/recipient/{address}
```
Returns detailed tracking for specific recipient

### 3. Get Batch Access Logs
```
GET /api/batch/{batchId}/access-logs
```
Returns all access events for the batch

### 4. Export Batch Audit Report
```
GET /api/batch/{batchId}/audit-report
```
Returns comprehensive CSV/PDF audit trail

## Privacy & Compliance Considerations

### Data Segregation
- Each recipient can only see their own notice
- Server can see aggregate statistics
- Individual tracking data is encrypted at rest

### GDPR/Privacy Compliance
```javascript
// Anonymized analytics
{
    batchId: "batch_xyz",
    recipientId: "SHA256(address)", // Hashed
    viewed: true,
    accepted: false,
    timeToView: 3600,
    location: "US-NY",  // Generalized
    // No PII stored
}
```

### Audit Trail Integrity
- All events are timestamped
- Blockchain transactions provide immutable proof
- Backend logs are append-only
- Regular backups to IPFS for permanence

## Real-Time Monitoring

### WebSocket Events for Live Tracking
```javascript
// Server subscribes to batch events
ws.on('batch:recipient:viewed', (data) => {
    console.log(`Recipient ${data.recipientAddress} viewed notice from batch ${data.batchId}`);
    updateBatchMetrics(data.batchId);
});

ws.on('batch:recipient:accepted', (data) => {
    console.log(`Recipient ${data.recipientAddress} accepted notice from batch ${data.batchId}`);
    notifyServer(data);
});
```

## Reporting Features

### 1. Batch Delivery Report
Shows delivery status for all recipients:
- ✅ Delivered (NFT minted)
- 👁️ Viewed (wallet connected & viewed)
- ✍️ Signed (document accepted)
- ⏰ Pending (no action yet)
- ❌ Failed (delivery failed)

### 2. Timeline View
```
10:00 AM - Batch initiated (50 recipients)
10:05 AM - Energy rented (200 TRX)
10:06 AM - Recipient 1/50 processed ✅
10:07 AM - Recipient 2/50 processed ✅
...
10:55 AM - Batch completed (48 success, 2 failed)
11:30 AM - Recipient TAddr1... viewed notice
11:35 AM - Recipient TAddr1... accepted document
2:15 PM - Recipient TAddr2... viewed notice
...
```

### 3. Geographic Distribution
- Map showing where recipients accessed from
- Time zone analysis for optimal sending times
- Device type breakdown (mobile vs desktop)

## Integration with Existing Systems

### Law Enforcement Dashboard
```javascript
// Special view for law enforcement batches
{
    batchType: "law_enforcement",
    warrantNumber: "W-2024-001",
    recipientStats: {
        totalServed: 50,
        acknowledged: 45,
        pendingAcknowledgment: 5,
        averageResponseTime: "2.3 hours"
    },
    complianceStatus: "90% compliance rate"
}
```

### Process Server Reports
```javascript
// Generate affidavit of service for batch
{
    serverName: "John Doe",
    serverId: "PS-12345",
    batchId: "batch_1234567890_abc",
    servedCount: 48,
    failedAddresses: ["TAddr49...", "TAddr50..."],
    affidavitText: "I hereby certify that on [date], I served legal notice to 48 recipients via blockchain...",
    digitalSignature: "0xServerSignature..."
}
```

## Security Measures

### Rate Limiting
- Max 100 recipients per batch
- Max 5 batches per hour per server
- Automatic throttling for large batches

### Fraud Detection
```javascript
// Detect suspicious patterns
if (batch.recipientAddresses.hasDuplicates()) {
    flag("Duplicate addresses in batch");
}
if (batch.allAddressesFromSameIP()) {
    flag("All recipients from same IP - possible test batch");
}
```

### Access Control
- Only batch sender can view full batch analytics
- Recipients can only access their own notice
- Admin can view all for compliance

## Cost Tracking

### Per-Recipient Cost Analysis
```javascript
{
    batchId: "batch_xyz",
    costBreakdown: {
        energyRental: 200,  // TRX (shared across all)
        perRecipientCosts: {
            serviceFee: 10,  // TRX
            energyUsed: 4,   // TRX equivalent
            ipfsStorage: 0.5 // TRX equivalent
        },
        totalCost: 925,  // TRX for 50 recipients
        costPerRecipient: 18.5,  // TRX average
        savingsVsIndividual: 3575  // TRX saved
    }
}
```