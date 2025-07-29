# Avoiding Stack Too Deep Without Via IR

## Understanding Stack Too Deep
Solidity has a limit of 16 local variables (including function parameters and return values) in the stack at any time. "Stack too deep" occurs when you exceed this limit.

## Current Stack Issues in the Contract

### 1. **createDocumentNotice() - 8 parameters + locals**
```solidity
function createDocumentNotice(
    address recipient,        // 1
    string memory encryptedIPFS,  // 2
    string memory encryptionKey,  // 3
    string memory publicText,     // 4
    string memory noticeType,     // 5
    string memory caseNumber,     // 6
    string memory issuingAgency,  // 7
    string memory baseTokenName   // 8
) external {
    uint256 fee = ...;           // 9
    uint256 noticeId = ...;      // 10
    ProcessServer storage server = ...; // 11
    string memory tokenName = ...; // 12
    // Getting close to limit!
}
```

### 2. **Notice struct with 13 fields**
Large structs can cause stack issues when creating them inline.

## Solutions Without Via IR

### Solution 1: **Use Struct Parameters**
```solidity
// Instead of 8 parameters, use 1 struct
struct NoticeRequest {
    address recipient;
    string encryptedIPFS;
    string encryptionKey;
    string publicText;
    string noticeType;
    string caseNumber;
    string issuingAgency;
    string baseTokenName;
}

function createNotice(NoticeRequest calldata request) external {
    // Now only 1 stack item instead of 8!
}
```

### Solution 2: **Break Down Large Functions**
```solidity
// Current: Everything in one function
function createDocumentNotice(...) {
    // validate
    // calculate fee
    // create notice
    // mint NFT
    // handle payments
}

// Optimized: Separate concerns
function createDocumentNotice(...) external returns (uint256) {
    uint256 noticeId = _validateAndPrepare(recipient, publicText);
    _storeNotice(noticeId, request);
    _mintAndEmit(noticeId, recipient);
    return noticeId;
}

function _validateAndPrepare(address recipient, string memory text) private returns (uint256) {
    require(recipient != address(0), "Invalid recipient");
    require(bytes(text).length > 0, "Invalid text");
    return _noticeIdCounter++;
}
```

### Solution 3: **Reduce Notice Struct Fields**
```solidity
// Current: 13 fields in Notice struct
struct Notice {
    address recipient;
    address sender;
    string encryptedIPFS;    // Could combine these
    string encryptionKey;    // into one field
    string publicText;
    string noticeType;
    string caseNumber;
    string issuingAgency;
    uint256 timestamp;
    bool accepted;
    bool hasDocument;
    uint256 serverId;
    string tokenName;
}

// Optimized: Pack data more efficiently
struct Notice {
    address recipient;
    address sender;
    string documentData;     // Combined IPFS + key with delimiter
    string publicText;
    string metadata;         // Combined type + case + agency with delimiter
    uint256 packedData;      // timestamp (64) + serverId (64) + flags (128)
    string tokenName;
}
```

### Solution 4: **Use Assembly for Simple Operations**
```solidity
// Instead of multiple local variables for fee calculation
function calculateFee(address user) public view returns (uint256 fee) {
    assembly {
        // Check exemption mapping slot directly
        let exemptSlot := keccak256(add(user, 0x20), 0x40)
        let isExempt := sload(exemptSlot)
        
        switch isExempt
        case 0 { fee := sload(serviceFee.slot) }
        default { fee := sload(creationFee.slot) }
    }
}
```

### Solution 5: **Inline Simple Operations**
```solidity
// Current: Create temporary variables
string memory tokenName = string(abi.encodePacked(baseTokenName, " #", noticeId.toString()));
notices[noticeId].tokenName = tokenName;

// Optimized: Direct assignment
notices[noticeId].tokenName = string(abi.encodePacked(baseTokenName, " #", noticeId.toString()));
```

## Complete Optimization Strategy

### 1. **Refactor createNotice Functions**
```solidity
struct CreateNoticeParams {
    address recipient;
    string publicText;
    string noticeType;
    string caseNumber;
    string issuingAgency;
    string baseTokenName;
    bool hasDocument;
    string encryptedIPFS;
    string encryptionKey;
}

function createNotice(CreateNoticeParams calldata params) 
    external payable nonReentrant whenNotPaused onlyAuthorized 
    returns (uint256 noticeId) 
{
    // Validate inputs in separate function
    _validateNoticeParams(params);
    
    // Get next ID and increment
    noticeId = _noticeIdCounter++;
    
    // Store notice data
    _storeNoticeData(noticeId, params);
    
    // Mint and process payment
    _completeMinting(noticeId, params.recipient);
}
```

### 2. **Optimize Batch Function**
```solidity
// Use packed data instead of struct
function createBatchNotices(
    address[] calldata recipients,
    bytes calldata packedParams  // Encode all params in bytes
) external payable {
    // Decode only what's needed at each step
}
```

### 3. **Simplify Token URI Generation**
```solidity
function generateEnhancedTokenURI(uint256 noticeId) private view returns (string memory) {
    Notice storage notice = notices[noticeId];
    
    // Build URI in one pass
    return string(abi.encodePacked(
        'data:application/json,{"name":"',
        notice.tokenName,
        '","description":"',
        _buildDescription(noticeId),
        '"}'
    ));
}

function _buildDescription(uint256 noticeId) private view returns (string memory) {
    // Separate function to avoid stack depth
}
```

## Benefits of This Approach

1. **No Via IR needed** - Compiles with standard optimizer
2. **Smaller bytecode** - More efficient code generation
3. **Easier verification** - Works with all block explorers
4. **Better gas efficiency** - Fewer storage reads/writes
5. **Maintainable** - Cleaner separation of concerns

## Estimated Results

- Contract size: ~20,000-21,000 bytes (down from 24,499)
- Room for ERC721Enumerable: ~3,500-4,500 bytes
- No stack too deep errors
- No Via IR required

Would you like me to implement this optimized version?