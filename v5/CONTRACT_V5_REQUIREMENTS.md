# V5 Contract Requirements for Production

## Critical Updates Needed for Wallet Compatibility

### 1. **Add TRC721 Enumerable Interface**
Without enumerable functions, wallets cannot:
- List all NFTs owned by a user
- Display NFTs in the collection view
- Properly track token ownership

Required functions to add:
```solidity
// Get token ID by owner and index
function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);

// Get token ID by global index
function tokenByIndex(uint256 index) external view returns (uint256);

// Get all tokens owned by address (helpful but not required)
function tokensOfOwner(address owner) external view returns (uint256[] memory);
```

### 2. **Add TRC721 Metadata Interface**
Ensure full compliance with metadata standard:
```solidity
function name() external view returns (string memory);
function symbol() external view returns (string memory);
function tokenURI(uint256 tokenId) external view returns (string memory); // Already have this
```

### 3. **Fix Token Minting Pattern**
Current issue: Document NFT is minted to contract address
- This confuses wallets and explorers
- Makes it harder to track "real" holders

Consider:
- Mint both tokens to recipient initially
- Use a "locked" flag instead of contract ownership
- Or clearly document this pattern for wallet developers

### 4. **Add Interface Support Declaration**
```solidity
function supportsInterface(bytes4 interfaceId) public view returns (bool) {
    return interfaceId == 0x80ac58cd || // TRC721
           interfaceId == 0x5b5e139f || // TRC721Metadata
           interfaceId == 0x780e9d63 || // TRC721Enumerable
           interfaceId == 0x01ffc9a7;   // TRC165
}
```

### 5. **Optimize for Gas Efficiency**
With enumerable support, consider:
- Limiting tokensOfOwner to prevent gas exhaustion
- Using pagination for large collections
- Caching frequently accessed data

### 6. **Production Deployment Checklist**

#### Before Deployment:
- [ ] Add enumerable functions and mappings
- [ ] Update _mint to call _addTokenToEnumeration
- [ ] Update _transfer to update enumeration
- [ ] Test with multiple wallets (TronLink, TokenPocket, etc.)
- [ ] Verify gas costs are acceptable
- [ ] Audit enumerable implementation

#### Deployment Strategy:
1. Deploy v5 on testnet first
2. Test with various wallets
3. Verify NFTs appear without manual import
4. Check gas costs for batch operations
5. Deploy to mainnet

#### Post-Deployment:
- [ ] Register with major wallet providers
- [ ] Submit to TronScan for verification
- [ ] Create integration guide for wallets
- [ ] Monitor for indexing issues

### 7. **Alternative Approach**
If contract size becomes an issue (24KB limit), consider:
- Deploying enumerable functions as a separate view contract
- Using events for off-chain indexing
- Creating a custom API for wallet integration

### 8. **Wallet Integration Guide**
Create documentation for wallet developers:
- Contract addresses and ABIs
- Metadata format and IPFS gateway URLs
- Special considerations (document NFT pattern)
- Example integration code

## Migration Path

Since contracts are immutable, for existing notices:
1. Keep v4 contract active for existing notices
2. Deploy v5 for new notices
3. Update UI to use v5 for new mints
4. Provide migration tool if needed

## Recommended Timeline

1. **Week 1**: Implement and test enumerable functions
2. **Week 2**: Testnet deployment and wallet testing
3. **Week 3**: Security audit and gas optimization
4. **Week 4**: Mainnet deployment

This ensures NFTs will be automatically visible in all major wallets without manual import.