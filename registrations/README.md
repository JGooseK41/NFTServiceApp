# Process Server Registrations

This folder contains encrypted process server registration files.

## File Format

- Files are named: `{wallet_address}_{timestamp}.enc`
- Files are encrypted using AES encryption
- Use the `decrypt.js` script to decrypt files locally

## Security

All files in this folder are encrypted. Personal information cannot be accessed without the encryption key.

⚠️ **Never commit unencrypted registration data to this folder**