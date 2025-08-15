# Contract Optimization Analysis

## 1. **Duplicate Code in Create Functions** (Est. 500-800 bytes savings)
The `createDocumentNotice` and `createTextNotice` functions have nearly identical code. They can be combined:

```solidity
// Current: Two separate functions with duplicate logic
// Optimized: Single function with a boolean parameter
function createNotice(
    address recipient,
    string memory publicText,
    string memory noticeType,
    string memory caseNumber,
    string memory issuingAgency,
    string memory baseTokenName,
    bool hasDocument,
    string memory encryptedIPFS,
    string memory encryptionKey
) external payable nonReentrant whenNotPaused onlyAuthorized returns (uint256) {
    // Combined logic
}
```

## 2. **Repetitive String Concatenation** (Est. 200-300 bytes)
The token URI generation repeats `string(abi.encodePacked(...))` multiple times:

```solidity
// Current: Multiple concatenations
desc = string(abi.encodePacked(
    'LEGAL NOTICE - ', notice.noticeType,
    ' | Case: ', notice.caseNumber,
    ' | ACTION REQUIRED: ', notice.publicText,
    ' | TO VIEW: Call acceptNotice(', noticeId.toString(), ')'
));

// Optimized: Build once
bytes memory descBytes = abi.encodePacked(
    'LEGAL NOTICE - ', notice.noticeType,
    ' | Case: ', notice.caseNumber
);
// Add conditional parts...
desc = string(descBytes);
```

## 3. **Redundant Storage Reads** (Est. 100-200 bytes)
ProcessServer is read multiple times:

```solidity
// Current:
ProcessServer storage server = processServers[msg.sender];
if (server.serverId > 0) server.noticesServed++;

// Optimized: Direct access
if (processServers[msg.sender].serverId > 0) {
    processServers[msg.sender].noticesServed++;
}
```

## 4. **Fee Calculation Duplication** (Est. 150 bytes)
Fee logic is repeated in multiple places:

```solidity
// Current: Inline fee calculations
uint256 fee = lawEnforcementExemptions[msg.sender] ? 5000000 : textOnlyFee;

// Already have calculateFee() - use it everywhere
uint256 fee = calculateFee(msg.sender);
```

## 5. **Unnecessary Temporary Variables** (Est. 100 bytes)
```solidity
// Current:
string memory tokenName = string(abi.encodePacked(baseTokenName, " #", noticeId.toString()));

// Optimized: Direct assignment in struct
tokenName: string(abi.encodePacked(baseTokenName, " #", noticeId.toString()))
```

## 6. **Event Parameter Optimization** (Est. 200 bytes)
The NoticeCreated event has many parameters that duplicate stored data:

```solidity
// Current: 7 parameters
event NoticeCreated(
    uint256 indexed noticeId,
    address indexed recipient,
    address indexed sender,
    bool hasDocument,
    uint256 timestamp,
    uint256 serverId,
    string tokenName
);

// Optimized: Just the essentials (others can be read from storage)
event NoticeCreated(
    uint256 indexed noticeId,
    address indexed recipient,
    address indexed sender
);
```

## 7. **Getter Function Optimization** (Est. 300 bytes)
The `getNoticeInfo` function returns 11 values individually:

```solidity
// Current: Returns each field separately
// Optimized: Return the struct directly
function getNotice(uint256 noticeId) external view returns (Notice memory) {
    return notices[noticeId];
}
```

## 8. **Counter Library Usage** (Est. 200 bytes)
Using OpenZeppelin's Counter adds overhead:

```solidity
// Current:
using Counters for Counters.Counter;
Counters.Counter private _noticeIdCounter;
_noticeIdCounter.increment();

// Optimized:
uint256 private _noticeIdCounter = 1;
_noticeIdCounter++;
```

## Total Estimated Savings: 1,850 - 2,550 bytes

This would bring the contract from 24,499 bytes down to approximately 22,000-22,500 bytes, leaving plenty of room for adding ERC721Enumerable (which needs ~800 bytes).

## Recommended Priority:
1. Combine create functions (biggest savings)
2. Optimize events
3. Remove Counter library
4. Simplify getter functions
5. Other optimizations

Would you like me to implement these optimizations?