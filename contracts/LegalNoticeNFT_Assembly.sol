// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract LegalNoticeNFT {
    // Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AlertCreated(uint256 indexed alertId, address indexed recipient, uint256 documentId);
    event DocumentAccepted(uint256 indexed documentId, address indexed recipient, uint256 timestamp);
    event DocumentViewed(uint256 indexed documentId, address indexed viewer);
    
    // Storage slots for data
    uint256 private constant ALERTS_SLOT = 0;
    uint256 private constant DOCUMENTS_SLOT = 100;
    uint256 private constant NOTICES_SLOT = 200;
    
    // Counters
    uint256 private _alertCounter;
    uint256 private _documentCounter;
    address public admin;
    uint256 public serviceFee = 20000000;
    
    // Mappings for basic lookups
    mapping(uint256 => address) private _tokenOwners;
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public recipientDocuments;
    mapping(uint256 => mapping(address => bool)) public documentViewers;
    
    constructor() {
        admin = msg.sender;
    }
    
    // Store alert data efficiently
    function _storeAlert(
        uint256 alertId,
        uint256 documentId,
        address recipient,
        bytes32 metadata1, // agency + type
        bytes32 metadata2, // case number
        bytes32 metadata3, // details + rights
        bool feesSponsored
    ) private {
        assembly {
            let slot := add(ALERTS_SLOT, mul(alertId, 10))
            sstore(slot, documentId)
            sstore(add(slot, 1), recipient)
            sstore(add(slot, 2), metadata1)
            sstore(add(slot, 3), metadata2)
            sstore(add(slot, 4), metadata3)
            sstore(add(slot, 5), feesSponsored)
            sstore(add(slot, 6), timestamp())
        }
    }
    
    // Store document data efficiently
    function _storeDocument(
        uint256 documentId,
        address server,
        address recipient,
        bytes32 ipfsHash1,
        bytes32 ipfsHash2,
        bytes32 decryptionKey
    ) private {
        assembly {
            let slot := add(DOCUMENTS_SLOT, mul(documentId, 10))
            sstore(slot, server)
            sstore(add(slot, 1), recipient)
            sstore(add(slot, 2), ipfsHash1)
            sstore(add(slot, 3), ipfsHash2)
            sstore(add(slot, 4), timestamp())
            sstore(add(slot, 5), 0) // accepted = false
            sstore(add(slot, 6), 0) // acceptedTime = 0
            sstore(add(slot, 7), decryptionKey)
        }
    }
    
    // Optimized serve notice
    function serveNotice(
        address recipient,
        bytes32[6] calldata data // Packed data to avoid stack issues
    ) external payable returns (uint256 alertId, uint256 documentId) {
        uint256 required = serviceFee;
        if (data[5] != 0) required += 2000000; // sponsorFees
        require(msg.value >= required, "Insufficient fee");
        require(recipient != address(0), "Invalid recipient");
        
        documentId = ++_documentCounter;
        alertId = ++_alertCounter;
        
        // Store document
        _storeDocument(documentId, msg.sender, recipient, data[0], data[1], data[2]);
        
        // Store alert
        _storeAlert(alertId, documentId, recipient, data[3], data[4], data[5], data[5] != 0);
        
        // Update mappings
        recipientDocuments[recipient].push(documentId);
        recipientAlerts[recipient].push(alertId);
        _tokenOwners[alertId] = recipient;
        
        emit Transfer(address(0), recipient, alertId);
        emit AlertCreated(alertId, recipient, documentId);
    }
    
    function acceptDocument(uint256 documentId) external {
        address recipient;
        bool accepted;
        
        // Read document data
        assembly {
            let slot := add(DOCUMENTS_SLOT, mul(documentId, 10))
            recipient := sload(add(slot, 1))
            accepted := sload(add(slot, 5))
        }
        
        require(msg.sender == recipient, "Not recipient");
        require(!accepted, "Already accepted");
        
        // Update accepted status
        assembly {
            let slot := add(DOCUMENTS_SLOT, mul(documentId, 10))
            sstore(add(slot, 5), 1) // accepted = true
            sstore(add(slot, 6), timestamp()) // acceptedTime
        }
        
        uint256 docTokenId = 1000000 + documentId;
        _tokenOwners[docTokenId] = msg.sender;
        
        emit DocumentAccepted(documentId, msg.sender, block.timestamp);
        emit Transfer(address(0), msg.sender, docTokenId);
    }
    
    function viewDocument(uint256 documentId) external returns (bytes32[4] memory data) {
        address server;
        address recipient;
        bool accepted;
        
        assembly {
            let slot := add(DOCUMENTS_SLOT, mul(documentId, 10))
            server := sload(slot)
            recipient := sload(add(slot, 1))
            accepted := sload(add(slot, 5))
        }
        
        require(
            msg.sender == server || 
            (msg.sender == recipient && accepted),
            "Not authorized"
        );
        
        if (!documentViewers[documentId][msg.sender]) {
            documentViewers[documentId][msg.sender] = true;
            emit DocumentViewed(documentId, msg.sender);
        }
        
        assembly {
            let slot := add(DOCUMENTS_SLOT, mul(documentId, 10))
            mstore(add(data, 0x20), sload(add(slot, 2))) // ipfsHash1
            mstore(add(data, 0x40), sload(add(slot, 3))) // ipfsHash2
            mstore(add(data, 0x60), sload(add(slot, 6))) // acceptedTime
            if or(eq(caller(), server), accepted) {
                mstore(add(data, 0x80), sload(add(slot, 7))) // decryptionKey
            }
        }
    }
    
    // Simplified compatibility wrapper
    function createLegalNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewImage,
        bytes32 contentHash,
        string calldata caseNumber,
        uint16 jurisdictionIndex,
        uint8 documentType
    ) external payable returns (uint256 noticeId, uint256 alertId) {
        bytes32[6] memory data;
        // Pack IPFS hash
        assembly {
            data := mload(add(ipfsHash, 0x20))
        }
        data[5] = bytes32(uint256(1)); // sponsorFees = true
        
        (alertId, noticeId) = serveNotice(recipient, data);
    }
    
    function acceptNotice(uint256 alertId) external {
        uint256 documentId;
        assembly {
            let slot := add(ALERTS_SLOT, mul(alertId, 10))
            documentId := sload(slot)
        }
        acceptDocument(documentId);
    }
    
    // Helper functions
    function getUserNotices(address user) external view returns (uint256[] memory) {
        return recipientDocuments[user];
    }
    
    function getUserAlerts(address user) external view returns (uint256[] memory) {
        return recipientAlerts[user];
    }
    
    function balanceOf(address owner) external view returns (uint256) {
        return recipientAlerts[owner].length;
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _tokenOwners[tokenId];
    }
    
    // Basic token URI
    function tokenURI(uint256 tokenId) external pure returns (string memory) {
        return "https://legalnotice.app/metadata/";
    }
    
    // Admin functions (simplified)
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    function updateFee(uint256 newFee) external onlyAdmin { serviceFee = newFee; }
    function withdrawTRX(uint256 amount) external onlyAdmin { payable(admin).transfer(amount); }
    
    // Compatibility stubs
    function grantRole(bytes32, address) external onlyAdmin {}
    function hasRole(bytes32, address) external view returns (bool) { return msg.sender == admin; }
    function feeExemptions(address) external pure returns (bool) { return false; }
    function creationFee() external view returns (uint256) { return serviceFee; }
    function updateFeeCollector(address payable newAdmin) external onlyAdmin { admin = newAdmin; }
    function resourceSponsorshipEnabled() external pure returns (bool) { return true; }
    function setResourceSponsorship(bool) external onlyAdmin {}
    function updateServiceFee(uint256 newFee) external onlyAdmin { serviceFee = newFee; }
    function updateCreationFee(uint256 newFee) external onlyAdmin { serviceFee = newFee; }
    function updateSponsorshipFee(uint256) external onlyAdmin {}
    function setFeeExemption(address, bool) external onlyAdmin {}
    function setFullFeeExemption(address, bool) external onlyAdmin {}
    function setServiceFeeExemption(address, bool) external onlyAdmin {}
}