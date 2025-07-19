# Pinata IPFS Setup Guide

This app uses Pinata for IPFS document storage. There are three ways to configure it:

## Option 1: One-Time Admin Configuration (Recommended)

As the admin, configure Pinata keys once for all users:

1. Edit `index.html` and find this section at the top of the JavaScript:
```javascript
window.PINATA_CONFIG = {
    apiKey: 'your-pinata-api-key-here',
    secretKey: 'your-pinata-secret-key-here'
};
```

2. Replace with your actual Pinata API keys from https://app.pinata.cloud/keys

3. Deploy the updated file to your server

**Benefits:** 
- Users don't need to configure anything
- Keys are consistent across all users
- Simple deployment

**Drawbacks:**
- Keys are visible in the source code (use Option 3 for production)

## Option 2: Individual User Configuration

Each user can configure their own Pinata keys:

1. Open the app and go to the Settings tab
2. Enter your Pinata API Key and Secret Key
3. Click "Save Keys"
4. Test the connection with "Test Connection"

**Benefits:**
- Each user controls their own storage
- No hardcoded keys in source

**Drawbacks:**
- Every user needs their own Pinata account
- Users must configure before first use

## Option 3: Server-Side Proxy (Production Ready)

For production, implement a server-side proxy:

1. Create a backend API endpoint that handles IPFS uploads
2. Store Pinata keys securely on the server (environment variables)
3. Replace the Netlify function URL in the code with your API endpoint

**Benefits:**
- Most secure - keys never exposed to client
- Users don't need Pinata accounts
- Can implement rate limiting and access control

**Drawbacks:**
- Requires backend development
- Additional infrastructure needed

## Getting Pinata API Keys

1. Sign up at https://pinata.cloud
2. Go to API Keys: https://app.pinata.cloud/keys
3. Click "New Key"
4. Give it a name like "NFT Service App"
5. Copy both the API Key and Secret Key

## Testing Your Setup

After configuration, test by:
1. Uploading a document in the Create Notice flow
2. Check browser console for upload success messages
3. If using Option 2, use the "Test Connection" button in Settings

## Troubleshooting

- **400 Bad Request**: Check that your API keys are correct
- **401 Unauthorized**: API keys are invalid or not configured
- **Upload fails silently**: Check browser console for errors
- **"Using test mode"**: Pinata isn't configured, app is using mock hashes

## Fallback Behavior

If Pinata isn't configured or fails, the app will:
1. Show a warning notification
2. Use mock IPFS hashes for testing
3. Allow the transaction to complete (for development only)

For production use, always configure proper IPFS storage.