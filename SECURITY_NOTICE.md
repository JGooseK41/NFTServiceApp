# SECURITY NOTICE - IMPORTANT

## Compromised Nile Testnet Contract

**Date: August 2025**

### ⚠️ WARNING: DO NOT USE NILE TESTNET CONTRACT

The Nile testnet contract at address `THUoYefQtWgkSmmFqqJpYERCuqLw1As2hL` has been compromised. The controlling wallet was accessed by an unauthorized party.

### Actions Taken:

1. **Removed all references** to the compromised contract from the application
2. **Disabled Nile testnet support** - The UI now shows warnings when connected to Nile
3. **Updated default network** to mainnet to prevent accidental use
4. **Marked contract info** as compromised in all documentation

### Current Status:

- ✅ **Mainnet Contract is SAFE**: `TLhYHQatauDtZ4iNCePU26WbVjsXtMPdoN`
- ❌ **Nile Testnet**: No contract available - do not deploy
- ❌ **Shasta Testnet**: No contract deployed

### Recommendations:

1. **Use only the mainnet contract** for all operations
2. **Do not interact** with the old Nile testnet contract
3. **Do not send any funds** to the compromised address
4. **Switch your wallet to mainnet** before using the application

### For Testing:

If you need to test, you should:
1. Deploy a new contract on testnet with a fresh wallet
2. Update the contract address in your local configuration
3. Never reuse the compromised wallet address

### Security Best Practices:

- Always use hardware wallets for mainnet deployments
- Enable multi-signature for admin operations
- Regularly audit wallet permissions
- Monitor contract activity for suspicious transactions

---

If you have any questions or concerns, please open an issue on GitHub.