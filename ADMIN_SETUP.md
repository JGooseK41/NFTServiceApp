# Admin Configuration Guide for NFTServiceApp

This guide explains how to configure the NFTServiceApp for production use. There are two main services that need configuration:

## 1. Pinata IPFS Storage (Required)

Used for storing legal notice documents on IPFS.

### Option A: Centralized Configuration (Recommended)

Edit `index.html` and add your Pinata keys:
```javascript
window.PINATA_CONFIG = {
    apiKey: 'your-pinata-api-key',
    secretKey: 'your-pinata-secret-key'
};
```

### Option B: User Configuration

Each user configures their own keys via Settings tab.

### Getting Pinata Keys:
1. Sign up at https://pinata.cloud
2. Go to https://app.pinata.cloud/keys
3. Create new key with "pinFileToIPFS" permission

## 2. GitHub Encrypted Storage (Optional)

Used for storing encrypted process server registrations.

### Option A: Centralized Configuration (Recommended)

Edit `index.html` and add your GitHub token:
```javascript
window.GITHUB_STORAGE_CONFIG = {
    token: 'ghp_your_github_token_here',
    encryptionKey: 'your-secret-encryption-key-here'  // CHANGE THIS!
};
```

### Option B: User Configuration

Admins configure via Admin > GitHub Settings tab.

### Getting GitHub Token:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token (classic) with `repo` scope
3. Copy the token (you won't see it again)

## Important Security Notes

1. **Never commit API keys to public repositories**
2. **Always change the default encryption key**
3. **For production, use environment variables or server-side proxy**

## Configuration Priority

The app checks for configuration in this order:
1. User's localStorage (from Settings tabs)
2. Centralized config (window.PINATA_CONFIG / window.GITHUB_STORAGE_CONFIG)
3. Defaults or test mode

## Testing Your Configuration

### Test Pinata:
1. Go to Settings tab
2. Click "Test Connection"
3. Try uploading a document

### Test GitHub:
1. Go to Admin > GitHub Settings
2. Click "Test Connection"
3. Approve a process server registration

## Production Best Practices

1. **Use Environment Variables**: Instead of hardcoding keys, use a build process to inject them
2. **Implement Server Proxy**: Create backend endpoints that handle API calls
3. **Rotate Keys Regularly**: Change API keys periodically
4. **Monitor Usage**: Check Pinata and GitHub API usage

## Fallback Behavior

If services aren't configured:
- **Pinata**: Uses mock IPFS hashes (development only)
- **GitHub**: Saves to localStorage only (no cloud backup)

Both show one-time notifications prompting configuration.

## Troubleshooting

### Pinata Issues:
- 400 Bad Request: Check API key format
- 401 Unauthorized: Invalid or expired keys
- Timeout: Check network or try again

### GitHub Issues:
- 401 Unauthorized: Invalid token or wrong permissions
- 404 Not Found: Repository doesn't exist
- 422 Unprocessable: Token lacks required permissions

### Common Solutions:
1. Clear browser cache and localStorage
2. Regenerate API keys/tokens
3. Check browser console for detailed errors
4. Ensure correct repository permissions