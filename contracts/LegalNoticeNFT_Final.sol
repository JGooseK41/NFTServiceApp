// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LegalNoticeNFT_Final {
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
    
    // Core functions - placed first to avoid forward references
    
    function _createDocument(
        address recipient,
        string memory ipfsHash,
        string memory decryptionKey,
        string memory caseInfo
    ) private returns (uint256 documentId) {
        documentId = ++_documentCounter;
        documents[documentId].server = msg.sender;
        documents[documentId].recipient = recipient;
        documents[documentId].ipfsHash = ipfsHash;
        documents[documentId].caseInfo = caseInfo;
        documents[documentId].timestamp = block.timestamp;
        documents[documentId].decryptionKey = decryptionKey;
        recipientDocuments[recipient].push(documentId);
    }
    
    function _createAlert(
        uint256 documentId,
        address recipient,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber
    ) private returns (uint256 alertId) {
        alertId = ++_alertCounter;
        alerts[alertId].documentId = documentId;
        alerts[alertId].recipient = recipient;
        alerts[alertId].issuingAgency = issuingAgency;
        alerts[alertId].noticeType = noticeType;
        alerts[alertId].caseNumber = caseNumber;
        alerts[alertId].timestamp = block.timestamp;
        recipientAlerts[recipient].push(alertId);
        _tokenOwners[alertId] = recipient;
    }
    
    function _completeAlert(
        uint256 alertId,
        string memory caseDetails,
        string memory legalRights,
        bool sponsorFees
    ) private {
        alerts[alertId].caseDetails = caseDetails;
        alerts[alertId].legalRights = legalRights;
        alerts[alertId].feesSponsored = sponsorFees;
    }
    
    function _createNotice(
        uint256 documentId,
        uint256 alertId,
        address recipient,
        string memory ipfsHash,
        string memory caseNumber
    ) private {
        notices[documentId].recipient = recipient;
        notices[documentId].server = msg.sender;
        notices[documentId].ipfsHash = ipfsHash;
        notices[documentId].contentHash = keccak256(abi.encodePacked(ipfsHash));
        notices[documentId].timestamp = uint128(block.timestamp);
        notices[documentId].caseNumberHash = uint64(uint256(keccak256(abi.encodePacked(caseNumber))) >> 192);
        notices[documentId].alertTokenId = uint32(alertId);
        notices[documentId].jurisdictionIndex = 0;
        notices[documentId].documentType = 1;
        notices[documentId].status = 0;
    }
    
    // Main functions
    
    function serveNotice(
        address recipient,
        string calldata encryptedIPFS,
        string calldata decryptionKey,
        string calldata issuingAgency,
        string calldata noticeType,
        string calldata caseNumber,
        string calldata caseDetails,
        string calldata legalRights,
        bool sponsorFees
    ) public payable returns (uint256 alertId, uint256 documentId) {
        uint256 required = serviceFee;
        if (sponsorFees) required += 2000000;
        require(msg.value >= required, "Insufficient fee");
        require(recipient != address(0), "Invalid recipient");
        
        // Create document
        string memory caseInfo = string(abi.encodePacked(issuingAgency, " - ", noticeType, " - Case ", caseNumber));
        documentId = _createDocument(recipient, encryptedIPFS, decryptionKey, caseInfo);
        
        // Create alert
        alertId = _createAlert(documentId, recipient, issuingAgency, noticeType, caseNumber);
        _completeAlert(alertId, caseDetails, legalRights, sponsorFees);
        
        // Create notice
        _createNotice(documentId, alertId, recipient, encryptedIPFS, caseNumber);
        
        emit Transfer(address(0), recipient, alertId);
        emit AlertCreated(alertId, recipient, documentId);
    }
    
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
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (tokenId <= _alertCounter) {
            AlertNotice storage alert = alerts[tokenId];
            
            string memory description = string(abi.encodePacked(
                alert.issuingAgency, " ",
                alert.noticeType, " - Case ", alert.caseNumber, ". ",
                alert.caseDetails, ". ",
                alert.legalRights, ". ",
                alert.feesSponsored ? 
                    "All fees have been paid. You can accept this notice with no charge." : 
                    "Acceptance requires transaction fee.",
                " Instructions and documentation included."
            ));
            
            return string(abi.encodePacked(
                'data:application/json;utf8,{',
                '"name":"', alert.noticeType, '",',
                '"description":"', description, '",',
                '"external_url":"https://legalnotice.app/accept/', _toString(alert.documentId), '",',
                '"attributes":[',
                '{"trait_type":"Issuing Agency","value":"', alert.issuingAgency, '"},',
                '{"trait_type":"Notice Type","value":"', alert.noticeType, '"},',
                '{"trait_type":"Case Number","value":"', alert.caseNumber, '"},',
                '{"trait_type":"Details","value":"', alert.caseDetails, '"},',
                '{"trait_type":"Fees Paid","value":"', alert.feesSponsored ? "Yes" : "No", '"}',
                ']}'
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
    
    function getPendingDocuments(address recipient) external view returns (
        uint256[] memory documentIds,
        string[] memory caseInfos,
        uint256[] memory timestamps
    ) {
        uint256[] storage allDocs = recipientDocuments[recipient];
        uint256 pendingCount = 0;
        
        for (uint i = 0; i < allDocs.length; i++) {
            if (!documents[allDocs[i]].accepted) {
                pendingCount++;
            }
        }
        
        documentIds = new uint256[](pendingCount);
        caseInfos = new string[](pendingCount);
        timestamps = new uint256[](pendingCount);
        
        uint256 index = 0;
        for (uint i = 0; i < allDocs.length; i++) {
            if (!documents[allDocs[i]].accepted) {
                documentIds[index] = allDocs[i];
                caseInfos[index] = documents[allDocs[i]].caseInfo;
                timestamps[index] = documents[allDocs[i]].timestamp;
                index++;
            }
        }
    }
    
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
    
    // App compatibility functions
    
    function createLegalNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewImage,
        bytes32 contentHash,
        string calldata caseNumber,
        uint16 jurisdictionIndex,
        uint8 documentType
    ) external payable returns (uint256 noticeId, uint256 alertId) {
        // Direct implementation to avoid calldata conversion issues
        uint256 required = serviceFee + 2000000;
        require(msg.value >= required, "Insufficient fee");
        require(recipient != address(0), "Invalid recipient");
        
        // Create document
        string memory caseInfo = string(abi.encodePacked("Legal Authority - Legal Notice - Case ", caseNumber));
        uint256 documentId = _createDocument(recipient, ipfsHash, "", caseInfo);
        
        // Create alert
        alertId = _createAlert(documentId, recipient, "Legal Authority", "Legal Notice", caseNumber);
        _completeAlert(alertId, "Document attached", "You have legal rights regarding this notice", true);
        
        // Create notice
        _createNotice(documentId, alertId, recipient, ipfsHash, caseNumber);
        
        // Also create legacy notice structure
        notices[documentId].contentHash = contentHash;
        notices[documentId].jurisdictionIndex = jurisdictionIndex;
        notices[documentId].documentType = documentType;
        
        emit Transfer(address(0), recipient, alertId);
        emit AlertCreated(alertId, recipient, documentId);
        
        noticeId = documentId;
    }
    
    function acceptNotice(uint256 tokenId) external {
        AlertNotice storage alert = alerts[tokenId];
        acceptDocument(alert.documentId);
    }
    
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