# Admin Role Check

The REVERT error when granting roles is happening because only the contract admin (the deployer) can grant roles.

## To fix this:

1. **Check who deployed the contract**
   - The address that deployed `TXtSpuVBTnsvCwuqDYXtiZXTpgSXZSb2Bd` is the only admin
   - This is the address associated with private key: `36466bd27e7c316abef7474c9a6c55081dd099734e376ca36dfba63d0bf521c0`

2. **Make sure you're connected with the admin wallet**
   - In TronLink, switch to the wallet that deployed the contract
   - This should be the same wallet used in the deployment

3. **If you need to add another admin**
   - First connect with the original admin wallet
   - Grant ADMIN_ROLE to your other address
   - Then that address can also grant roles

## Quick Test

To verify if you're the admin, open the browser console and run:
```javascript
const adminRole = await legalContract.hasRole(tronWeb.sha3('ADMIN_ROLE'), tronWeb.defaultAddress.base58).call();
console.log('Is admin:', adminRole);
```

If it returns `false`, you're not connected with the admin wallet.

## Contract Admin Address

Based on the deployment, the admin should be the address derived from the private key used during deployment. Make sure TronLink is using the same wallet.