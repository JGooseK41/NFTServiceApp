# Deploy LegalNoticeNFT_Complete Contract

## Prerequisites
1. TRON wallet with TRX on Nile testnet
2. Private key for your wallet

## Steps to Deploy

1. First, get test TRX from the Nile faucet:
   - Visit: https://nileex.io/join/getJoinPage
   - Enter your wallet address to receive test TRX

2. Edit the deployment script to add your private key:
   ```bash
   nano deploy_complete_contract.js
   ```
   
   Replace `YOUR_PRIVATE_KEY_HERE` with your actual private key.

3. Run the deployment:
   ```bash
   node deploy_complete_contract.js
   ```

4. The script will output:
   - Contract address (hex format)
   - Base58 address (for use in the UI)
   - Save these addresses!

5. Update the UI with the new contract address:
   - Open `index.html`
   - Find the line with `const CONTRACT_ADDRESS`
   - Replace the old address with the new Base58 address

## Contract Features

The LegalNoticeNFT_Complete contract includes:

1. **Dynamic Fee Management**
   - Updatable service fee (default 20 TRX)
   - Creation fee support
   - Sponsorship fee (2 TRX)
   - Fee collector address management

2. **Unified Notice Tracking**
   - Track notices by server address
   - Unified notice structure for easier access
   - Support for notice acknowledgment

3. **Enhanced Events**
   - LegalNoticeCreated event
   - FeeUpdated events
   - FeeCollectorUpdated event

4. **UI Compatibility Functions**
   - `alerts()` function for direct alert access
   - `SERVICE_FEE()` getter
   - `withdrawTRX()` for partial withdrawals
   - Legacy function support

5. **Fee Exemption System**
   - Service fee exemptions (50% discount)
   - Full fee exemptions (only pay creation fee)
   - Admin-controlled exemptions

## After Deployment

1. Update the contract ABI in the UI:
   - Copy the contents of `contracts/LegalNoticeNFT_Complete_sol_LegalNoticeNFT.abi`
   - Replace the `CONTRACT_ABI` variable in `index.html`

2. Test the contract:
   - Try creating a notice
   - Test fee exemptions
   - Verify role management works

3. Configure the contract:
   - Set fee exemptions for specific addresses if needed
   - Update fees if necessary
   - Grant process server roles

## Security Notes

- **NEVER** commit your private key to git
- Keep your private key secure
- Use environment variables in production
- Consider using a hardware wallet for mainnet deployment