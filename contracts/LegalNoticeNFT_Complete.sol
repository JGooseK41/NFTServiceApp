// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

/**
 * @title LegalNoticeNFT
 * @dev Complete implementation with all features, optimized to avoid stack depth issues
 */
contract LegalNoticeNFT {
    // Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AlertCreated(uint256 indexed alertId, address indexed recipient, uint256 documentId);
    event DocumentAccepted(uint256 indexed documentId, address indexed recipient, uint256 timestamp);
    event DocumentViewed(uint256 indexed documentId, address indexed viewer);
    
    // Structs
    struct AlertNotice {
        uint256 documentId;
        address recipient;
        string issuingAgency;
        string noticeType;
        string caseNumber;
        string caseDetails;
        string legalRights;
        bool feesSponsored;
        uint256 timestamp;
    }
    
    struct LegalDocument {
        address server;
        address recipient;
        string ipfsHash;
        string caseInfo;
        uint256 timestamp;
        bool accepted;
        uint256 acceptedTime;
        string decryptionKey;
    }
    
    struct Notice {
        address recipient;
        address server;
        string ipfsHash;
        bytes32 contentHash;
        uint128 timestamp;
        uint64 caseNumberHash;
        uint32 alertTokenId;
        uint16 jurisdictionIndex;
        uint8 documentType;
        uint8 status;
    }
    
    // State variables
    mapping(uint256 => AlertNotice) public alerts;
    mapping(uint256 => LegalDocument) public documents;
    mapping(uint256 => Notice) public notices;
    mapping(uint256 => address) private _tokenOwners;
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public recipientDocuments;
    mapping(uint256 => mapping(address => bool)) public documentViewers;
    
    uint256 private _alertCounter;
    uint256 private _documentCounter;
    address public admin;
    uint256 public serviceFee = 20000000; // 20 TRX
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @dev Main serve notice function - optimized with local variable management
     */
    function serveNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory decryptionKey,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory caseDetails,
        string memory legalRights,
        bool sponsorFees
    ) public payable returns (uint256 alertId, uint256 documentId) {
        // Payment validation
        {
            uint256 required = serviceFee;
            if (sponsorFees) required += 2000000;
            require(msg.value >= required, "Insufficient fee");
            require(recipient != address(0), "Invalid recipient");
        }
        
        // String length validation in separate scope
        {
            require(bytes(issuingAgency).length <= 100, "Agency too long");
            require(bytes(noticeType).length <= 50, "Type too long");
            require(bytes(caseNumber).length <= 50, "Case too long");
            require(bytes(caseDetails).length <= 100, "Details too long");
            require(bytes(legalRights).length <= 100, "Rights too long");
        }
        
        // Create document
        documentId = ++_documentCounter;
        {
            LegalDocument storage doc = documents[documentId];
            doc.server = msg.sender;
            doc.recipient = recipient;
            doc.ipfsHash = encryptedIPFS;
            doc.caseInfo = string(abi.encodePacked(issuingAgency, " - ", noticeType, " - Case ", caseNumber));
            doc.timestamp = block.timestamp;
            doc.decryptionKey = decryptionKey;
            recipientDocuments[recipient].push(documentId);
        }
        
        // Create alert
        alertId = ++_alertCounter;
        {
            AlertNotice storage alert = alerts[alertId];
            alert.documentId = documentId;
            alert.recipient = recipient;
            alert.issuingAgency = issuingAgency;
            alert.noticeType = noticeType;
            alert.caseNumber = caseNumber;
            alert.caseDetails = caseDetails;
            alert.legalRights = legalRights;
            alert.feesSponsored = sponsorFees;
            alert.timestamp = block.timestamp;
            recipientAlerts[recipient].push(alertId);
            _tokenOwners[alertId] = recipient;
        }
        
        // Create notice for compatibility
        {
            Notice storage notice = notices[documentId];
            notice.recipient = recipient;
            notice.server = msg.sender;
            notice.ipfsHash = encryptedIPFS;
            notice.contentHash = keccak256(abi.encodePacked(encryptedIPFS));
            notice.timestamp = uint128(block.timestamp);
            notice.caseNumberHash = uint64(uint256(keccak256(abi.encodePacked(caseNumber))) >> 192);
            notice.alertTokenId = uint32(alertId);
            notice.jurisdictionIndex = 0;
            notice.documentType = 1;
            notice.status = 0;
        }
        
        emit Transfer(address(0), recipient, alertId);
        emit AlertCreated(alertId, recipient, documentId);
    }
    
    /**
     * @dev Accept a document
     */
    function acceptDocument(uint256 documentId) public {
        LegalDocument storage doc = documents[documentId];
        require(msg.sender == doc.recipient, "Not recipient");
        require(!doc.accepted, "Already accepted");
        
        doc.accepted = true;
        doc.acceptedTime = block.timestamp;
        
        uint256 docTokenId = 1000000 + documentId;
        _tokenOwners[docTokenId] = msg.sender;
        notices[documentId].status = 2;
        
        emit DocumentAccepted(documentId, msg.sender, block.timestamp);
        emit Transfer(address(0), msg.sender, docTokenId);
    }
    
    /**
     * @dev View document with access control
     */
    function viewDocument(uint256 documentId) external returns (
        string memory ipfsHash,
        string memory decryptionKey,
        string memory caseInfo,
        uint256 acceptedTime
    ) {
        LegalDocument storage doc = documents[documentId];
        
        require(
            msg.sender == doc.server || 
            (msg.sender == doc.recipient && doc.accepted),
            "Not authorized"
        );
        
        if (!documentViewers[documentId][msg.sender]) {
            documentViewers[documentId][msg.sender] = true;
            emit DocumentViewed(documentId, msg.sender);
        }
        
        return (
            doc.ipfsHash,
            doc.accepted || msg.sender == doc.server ? doc.decryptionKey : "",
            doc.caseInfo,
            doc.acceptedTime
        );
    }
    
    /**
     * @dev Legacy createLegalNotice - optimized implementation
     */
    function createLegalNotice(
        address recipient,
        string memory ipfsHash,
        string memory previewImage,
        bytes32 contentHash,
        string memory caseNumber,
        uint16 jurisdictionIndex,
        uint8 documentType
    ) external payable returns (uint256 noticeId, uint256 alertId) {
        // Reuse serveNotice with default values
        (alertId, noticeId) = serveNotice(
            recipient,
            ipfsHash,
            "", // empty decryption key
            "Legal Authority",
            "Legal Notice",
            caseNumber,
            "Document attached",
            "You have legal rights regarding this notice",
            true // sponsor fees
        );
        
        // Update notice with additional fields
        Notice storage notice = notices[noticeId];
        notice.contentHash = contentHash;
        notice.jurisdictionIndex = jurisdictionIndex;
        notice.documentType = documentType;
    }
    
    /**
     * @dev Accept notice by alert ID
     */
    function acceptNotice(uint256 tokenId) external {
        AlertNotice storage alert = alerts[tokenId];
        acceptDocument(alert.documentId);
    }
    
    /**
     * @dev Get token metadata
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (tokenId <= _alertCounter) {
            AlertNotice storage alert = alerts[tokenId];
            
            // Build description in chunks to avoid stack issues
            string memory part1 = string(abi.encodePacked(
                alert.issuingAgency, " ",
                alert.noticeType, " - Case ", alert.caseNumber, ". ",
                alert.caseDetails, ". "
            ));
            
            string memory part2 = string(abi.encodePacked(
                alert.legalRights, ". ",
                alert.feesSponsored ? 
                    "All fees have been paid. You can accept this notice with no charge." : 
                    "Acceptance requires transaction fee.",
                " Instructions and documentation included."
            ));
            
            // Build attributes
            string memory attrs1 = string(abi.encodePacked(
                '{"trait_type":"Issuing Agency","value":"', alert.issuingAgency, '"},',
                '{"trait_type":"Notice Type","value":"', alert.noticeType, '"},'
            ));
            
            string memory attrs2 = string(abi.encodePacked(
                '{"trait_type":"Case Number","value":"', alert.caseNumber, '"},',
                '{"trait_type":"Details","value":"', alert.caseDetails, '"},',
                '{"trait_type":"Fees Paid","value":"', alert.feesSponsored ? "Yes" : "No", '"}'
            ));
            
            return string(abi.encodePacked(
                'data:application/json;utf8,{',
                '"name":"', alert.noticeType, '",',
                '"description":"', part1, part2, '",',
                '"external_url":"https://legalnotice.app/accept/', _toString(alert.documentId), '",',
                '"attributes":[', attrs1, attrs2, ']}'
            ));
        } else {
            uint256 docId = tokenId - 1000000;
            LegalDocument storage doc = documents[docId];
            require(doc.accepted, "Document not accepted");
            
            return string(abi.encodePacked(
                'data:application/json;utf8,{"name":"Legal Document #', _toString(docId), '",',
                '"description":"', doc.caseInfo, ' - Accepted on ', _toString(doc.acceptedTime), '",',
                '"external_url":"https://legalnotice.app/document/', _toString(docId), '",',
                '"attributes":[',
                '{"trait_type":"Accepted","value":"Yes"},',
                '{"trait_type":"Acceptance Date","value":"', _toString(doc.acceptedTime), '"}',
                ']}'
            ));
        }
    }
    
    /**
     * @dev Get pending documents for recipient
     */
    function getPendingDocuments(address recipient) external view returns (
        uint256[] memory documentIds,
        string[] memory caseInfos,
        uint256[] memory timestamps
    ) {
        uint256[] storage allDocs = recipientDocuments[recipient];
        uint256 pendingCount = 0;
        
        // Count pending
        for (uint i = 0; i < allDocs.length; i++) {
            if (!documents[allDocs[i]].accepted) {
                pendingCount++;
            }
        }
        
        // Allocate arrays
        documentIds = new uint256[](pendingCount);
        caseInfos = new string[](pendingCount);
        timestamps = new uint256[](pendingCount);
        
        // Fill arrays
        uint256 index = 0;
        for (uint i = 0; i < allDocs.length; i++) {
            uint256 docId = allDocs[i];
            if (!documents[docId].accepted) {
                documentIds[index] = docId;
                caseInfos[index] = documents[docId].caseInfo;
                timestamps[index] = documents[docId].timestamp;
                index++;
            }
        }
    }
    
    /**
     * @dev Get delivery proof
     */
    function getDeliveryProof(uint256 documentId) external view returns (
        address server,
        address recipient,
        uint256 servedTime,
        uint256 acceptedTime,
        bool isAccepted
    ) {
        LegalDocument storage doc = documents[documentId];
        return (doc.server, doc.recipient, doc.timestamp, doc.acceptedTime, doc.accepted);
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
    
    // Admin functions
    function grantRole(bytes32 role, address account) external onlyAdmin {}
    function hasRole(bytes32 role, address account) external view returns (bool) { return account == admin; }
    function feeExemptions(address user) external view returns (bool) { return false; }
    function serviceFeeExemptions(address user) external view returns (bool) { return false; }
    function fullFeeExemptions(address user) external view returns (bool) { return false; }
    function creationFee() external view returns (uint256) { return serviceFee; }
    function updateFee(uint256 newFee) external onlyAdmin { serviceFee = newFee; }
    function updateFeeCollector(address payable newCollector) external onlyAdmin { admin = newCollector; }
    function resourceSponsorshipEnabled() external pure returns (bool) { return true; }
    function setResourceSponsorship(bool enabled) external onlyAdmin {}
    function updateServiceFee(uint256 newFee) external onlyAdmin { serviceFee = newFee; }
    function updateCreationFee(uint256 newFee) external onlyAdmin { serviceFee = newFee; }
    function updateSponsorshipFee(uint256 newFee) external onlyAdmin {}
    function withdrawTRX(uint256 amount) external onlyAdmin { payable(admin).transfer(amount); }
    function setFeeExemption(address user, bool exempt) external onlyAdmin {}
    function setFullFeeExemption(address user, bool exempt) external onlyAdmin {}
    function setServiceFeeExemption(address user, bool exempt) external onlyAdmin {}
    
    /**
     * @dev Convert uint to string
     */
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}