# Backend Upload Debugging Guide

## Issue Summary
Backend returns 500 error when uploading document components to:
```
POST /api/documents/notice/{noticeId}/components
```

## Size Limits Found
- **Backend:** 50MB per file (multer configuration)
- **Frontend:** 10MB per file (can be increased)
- **Compression:** Documents compressed to ~500KB for blockchain

## Identified Issues & Solutions

### 1. Required Fields Missing
The backend SQL INSERT requires these fields as NOT NULL:
- `notice_id` 
- `case_number`
- `server_address`
- `recipient_address`
- `alert_id`
- `document_id`

**Current Problem:** When compiling documents, some fields are null:
```javascript
// In multi-document-handler.js line 611-615
formData.append('caseNumber', window.currentCaseNumber || 'PENDING');  // May be 'PENDING'
formData.append('alertId', uploadId);  // Temporary ID, not actual NFT ID
formData.append('documentId', uploadId + '_doc');  // Temporary ID
```

**Solution:** Ensure all required fields have valid values before upload.

### 2. Database Connection Issues
The backend expects PostgreSQL to be running on Render. Check if:
- Database is provisioned on Render
- DATABASE_URL environment variable is set
- Database migrations have been run

### 3. File Size Issues
While backend accepts 50MB, the actual issue might be:
- Base64 encoding increases size by ~33%
- FormData with base64 might exceed request size limits
- Render might have lower limits than configured

## Debugging Steps

### 1. Check Browser Console
When upload fails, look for:
```
FormData contents: {...}
Upload attempt 1 of 3...
Backend upload attempt 1 failed: [error details]
```

### 2. Check Network Tab
1. Open DevTools → Network tab
2. Find the failed request to `/api/documents/notice/*/components`
3. Check:
   - Request Headers (Content-Length)
   - Request Payload (FormData fields)
   - Response (actual error message)

### 3. Test with Smaller File
Try uploading a tiny image (< 100KB) to isolate size issues:
```javascript
// Create a 1x1 pixel image for testing
const testCanvas = document.createElement('canvas');
testCanvas.width = 1;
testCanvas.height = 1;
const testImage = testCanvas.toDataURL('image/png');
```

### 4. Check Render Logs
1. Go to Render dashboard
2. Check your backend service logs
3. Look for actual error messages like:
   - "TypeError: Cannot read property 'query' of undefined"
   - "column 'case_number' cannot be null"
   - "PayloadTooLargeError"

## Temporary Workarounds

### 1. Skip Backend Upload (Development Only)
```javascript
// In multi-document-handler.js, line 152
// Comment out the throw to continue without backend
// const backendSaved = await this.saveToBackend(combinedDocument, thumbnail);
// if (!backendSaved) {
//     console.warn('Backend save failed, continuing anyway');
//     // throw new Error('Failed to save document to backend');
// }
```

### 2. Use Mock Data for Required Fields
```javascript
// In multi-document-handler.js saveToBackend()
formData.append('caseNumber', 'TEST-' + Date.now());
formData.append('serverAddress', 'TTestServerAddress123...');
formData.append('recipientAddress', 'TTestRecipientAddress456...');
formData.append('alertId', '999999');
formData.append('documentId', '999998');
```

### 3. Reduce File Size Before Upload
```javascript
// Compress more aggressively
const compressedDoc = await documentConverter.compressImage(
    document.data, 
    100000  // 100KB instead of 500KB
);
```

## Permanent Fix Required

The backend needs to handle missing fields gracefully:

### Backend Changes Needed (documents.js):
```javascript
// Line 106-121: Add defaults for missing fields
const { 
    caseNumber = 'PENDING-' + Date.now(),
    serverAddress = 'UNKNOWN',
    recipientAddress = 'UNKNOWN',
    alertId = noticeId,  // Use noticeId as fallback
    documentId = noticeId + '_doc',
    // ... rest of fields
} = req.body;

// Line 132: Make SQL more flexible
const query = `
    INSERT INTO notice_components (
        notice_id, case_number, server_address, recipient_address,
        -- etc
    ) VALUES ($1, COALESCE($2, 'PENDING'), COALESCE($3, 'UNKNOWN'), ...
```

## Testing the Fix

1. Open browser console
2. Try uploading a document
3. Watch for the new detailed error messages
4. Check if retries are happening (you'll see "Upload attempt 2 of 3...")
5. Look for the specific field causing the issue

## Expected Error Messages

If it's a field issue:
```
column "case_number" of relation "notice_components" violates not-null constraint
```

If it's a size issue:
```
PayloadTooLargeError: request entity too large
```

If it's a database issue:
```
Cannot read property 'query' of undefined
```

## Next Steps

1. **Check Render Dashboard** for actual error logs
2. **Try with test data** using the mock fields above
3. **Report specific error** from backend logs
4. **Consider backend fixes** if database schema is too strict