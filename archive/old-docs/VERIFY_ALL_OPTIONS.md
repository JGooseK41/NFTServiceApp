# Contract Verification - All Options to Try

## Contract: TFz1epSo4yaSFLFnSA8nUANft4D4xZQz1G

Try these combinations in order:

## Option 1: Most Likely
- **Contract Name**: `LegalNoticeNFT_Complete`
- **Compiler**: `v0.8.6+commit.11564f7e`
- **Optimization**: `Yes`
- **Runs**: `200`
- **EVM Version**: `istanbul`

## Option 2: Without Optimization
- **Contract Name**: `LegalNoticeNFT_Complete`
- **Compiler**: `v0.8.6+commit.11564f7e`
- **Optimization**: `No`
- **EVM Version**: `istanbul`

## Option 3: Different Compiler Version
- **Contract Name**: `LegalNoticeNFT_Complete`
- **Compiler**: `v0.8.0+commit.c7dfd78e`
- **Optimization**: `Yes`
- **Runs**: `200`
- **EVM Version**: `istanbul`

## Option 4: Default EVM Version
- **Contract Name**: `LegalNoticeNFT_Complete`
- **Compiler**: `v0.8.6+commit.11564f7e`
- **Optimization**: `Yes`
- **Runs**: `200`
- **EVM Version**: `default` (or leave blank)

## Option 5: Different Optimization Runs
- **Contract Name**: `LegalNoticeNFT_Complete`
- **Compiler**: `v0.8.6+commit.11564f7e`
- **Optimization**: `Yes`
- **Runs**: `999`
- **EVM Version**: `istanbul`

## Option 6: TronBox Default Settings
- **Contract Name**: `LegalNoticeNFT_Complete`
- **Compiler**: `v0.8.6+commit.11564f7e`
- **Optimization**: `Yes`
- **Runs**: `1`
- **EVM Version**: `istanbul`

## If Still Failing:

### Check for Via IR
Some contracts are compiled with --via-ir flag. Try:
- Enable "Via IR" option if available

### Constructor Arguments
The contract has no constructor arguments, but if asked:
- Leave blank or enter: `0x`

### Multi-Part Files
If single file keeps failing:
1. Choose "Multi-part files"
2. Upload only: `LegalNoticeNFT_Complete.sol`
3. No dependencies needed (it's self-contained)

## Debug Information
The issue might be:
1. The deployed bytecode was compiled with different settings than tronbox.js
2. The contract might have been compiled manually with different settings
3. There might be metadata hash differences

## Last Resort
If none work, the contract might have been deployed with:
- A different source file that was later modified
- Custom compilation settings not in tronbox.js
- A different Solidity version than expected