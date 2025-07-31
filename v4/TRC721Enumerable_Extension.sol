// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * TRC721 Enumerable Extension for LegalNoticeNFT
 * Add these functions to your contract to improve wallet compatibility
 */

contract TRC721EnumerableExtension {
    // Add to state variables
    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;
    uint256[] private _allTokens;
    mapping(uint256 => uint256) private _allTokensIndex;
    
    /**
     * @dev Returns a token ID owned by `owner` at a given `index`
     */
    function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256) {
        require(index < balanceOf(owner), "Index out of bounds");
        return _ownedTokens[owner][index];
    }
    
    /**
     * @dev Returns a token ID at a given `index` of all tokens
     */
    function tokenByIndex(uint256 index) public view returns (uint256) {
        require(index < totalSupply(), "Index out of bounds");
        return _allTokens[index];
    }
    
    /**
     * @dev Hook to update enumeration on mint
     * Call this in your _mint function after the standard mint logic
     */
    function _addTokenToEnumeration(address to, uint256 tokenId) internal {
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
        
        _allTokensIndex[tokenId] = _allTokens.length;
        _allTokens.push(tokenId);
    }
    
    /**
     * @dev Hook to update enumeration on transfer
     * Call this in your _transfer function
     */
    function _removeTokenFromOwnerEnumeration(address from, uint256 tokenId) internal {
        uint256 lastTokenIndex = _ownedTokens[from].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];
        
        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];
            _ownedTokens[from][tokenIndex] = lastTokenId;
            _ownedTokensIndex[lastTokenId] = tokenIndex;
        }
        
        _ownedTokens[from].pop();
        delete _ownedTokensIndex[tokenId];
    }
    
    /**
     * @dev Returns all token IDs owned by an address
     * Useful for wallets to display all NFTs
     */
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }
}