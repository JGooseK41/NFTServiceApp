# Encrypted Registration Storage Setup

This app now supports saving approved process server registrations as encrypted files to your GitHub repository.

## Setup Instructions

### 1. Create a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "NFTServiceApp Registration Storage"
4. Select these permissions:
   - `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't be able to see it again)

### 2. Add Token to the App

Edit `index.html` and find this section around line 4931:

```javascript
const GITHUB_CONFIG = {
    owner: 'JGooseK41',
    repo: 'NFTServiceApp',
    path: 'registrations',
    branch: 'main',
    token: '', // Add your token here
    encryptionKey: 'NFTServiceApp-ProcessServer-SecureKey-2024' // Change this!
};
```

Add your token between the quotes in the `token` field.

### 3. Change the Encryption Key

**IMPORTANT**: Change the `encryptionKey` to your own secret key. This key is used to encrypt the registration data.

## How It Works

1. When you approve a process server registration, the data is:
   - Encrypted using AES encryption with your secret key
   - Saved to the `/registrations` folder in your GitHub repo
   - Named as `{wallet_address}_{timestamp}.enc`

2. If GitHub saving fails, it falls back to downloading the encrypted file locally

3. A `decrypt.js` helper file is automatically created in the registrations folder

## Decrypting Files

To decrypt a registration file:

1. Download the `.enc` file from GitHub
2. Use the `decrypt.js` script:
   ```bash
   node registrations/decrypt.js registration_file.enc
   ```
3. This creates a decrypted `.json` file with the registration data

## Security Notes

- **Never commit your GitHub token** to the repository
- Keep your encryption key secret and secure
- The encrypted files are safe to store publicly - they cannot be read without the key
- Consider using environment variables for production

## What Gets Stored

Each registration includes:
- Agency name and license number
- Contact information (email, phone)
- Wallet address
- Registration purpose
- Approval details (who approved, when, transaction hash)

All personal information is encrypted before storage.