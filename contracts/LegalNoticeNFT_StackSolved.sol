// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract LegalNoticeNFT {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AlertCreated(uint256 indexed alertId, address indexed recipient, uint256 documentId);
    event DocumentAccepted(uint256 indexed documentId, address indexed recipient, uint256 timestamp);
    event DocumentViewed(uint256 indexed documentId, address indexed viewer);
    
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
    
    // Create a notices mapping for compatibility
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
    
    // Temporary storage for avoiding stack depth
    struct TempNotice {
        address recipient;
        string encryptedIPFS;
        string decryptionKey;
        string issuingAgency;
        string noticeType;
        string caseNumber;
        string caseDetails;
        string legalRights;
        bool sponsorFees;
    }
    
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
    
    // Temporary storage to avoid stack depth
    TempNotice private temp;
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
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
    ) external payable returns (uint256 alertId, uint256 documentId) {
        // Store in temp to avoid stack depth
        temp.recipient = recipient;
        temp.encryptedIPFS = encryptedIPFS;
        temp.decryptionKey = decryptionKey;
        temp.issuingAgency = issuingAgency;
        temp.noticeType = noticeType;
        temp.caseNumber = caseNumber;
        temp.caseDetails = caseDetails;
        temp.legalRights = legalRights;
        temp.sponsorFees = sponsorFees;
        
        return _processNotice();
    }
    
    function _processNotice() internal returns (uint256 alertId, uint256 documentId) {
        // Validate payment
        uint256 required = serviceFee;
        if (temp.sponsorFees) required += 2000000;
        require(msg.value >= required, "Insufficient fee");
        require(temp.recipient != address(0), "Invalid recipient");
        
        // Validate strings
        require(bytes(temp.issuingAgency).length <= 100, "Agency too long");
        require(bytes(temp.noticeType).length <= 50, "Type too long");
        require(bytes(temp.caseNumber).length <= 50, "Case too long");
        require(bytes(temp.caseDetails).length <= 100, "Details too long");
        require(bytes(temp.legalRights).length <= 100, "Rights too long");
        
        // Create document
        documentId = ++_documentCounter;
        LegalDocument storage doc = documents[documentId];
        doc.server = msg.sender;
        doc.recipient = temp.recipient;
        doc.ipfsHash = temp.encryptedIPFS;
        doc.caseInfo = string(abi.encodePacked(temp.issuingAgency, " - ", temp.noticeType, " - Case ", temp.caseNumber));
        doc.timestamp = block.timestamp;
        doc.accepted = false;
        doc.acceptedTime = 0;
        doc.decryptionKey = temp.decryptionKey;
        recipientDocuments[temp.recipient].push(documentId);
        
        // Create alert
        alertId = ++_alertCounter;
        AlertNotice storage alert = alerts[alertId];
        alert.documentId = documentId;
        alert.recipient = temp.recipient;
        alert.issuingAgency = temp.issuingAgency;
        alert.noticeType = temp.noticeType;
        alert.caseNumber = temp.caseNumber;
        alert.caseDetails = temp.caseDetails;
        alert.legalRights = temp.legalRights;
        alert.feesSponsored = temp.sponsorFees;
        alert.timestamp = block.timestamp;
        
        recipientAlerts[temp.recipient].push(alertId);
        _tokenOwners[alertId] = temp.recipient;
        
        emit Transfer(address(0), temp.recipient, alertId);
        emit AlertCreated(alertId, temp.recipient, documentId);
        
        // Populate notices mapping for app compatibility
        notices[documentId] = Notice({
            recipient: temp.recipient,
            server: msg.sender,
            ipfsHash: temp.encryptedIPFS,
            contentHash: keccak256(abi.encodePacked(temp.encryptedIPFS)),
            timestamp: uint128(block.timestamp),
            caseNumberHash: uint64(uint256(keccak256(abi.encodePacked(temp.caseNumber))) >> 192),
            alertTokenId: uint32(alertId),
            jurisdictionIndex: 0,
            documentType: 1,
            status: 0 // 0 = pending, 2 = accepted
        });
    }
    
    function acceptDocument(uint256 documentId) external {
        LegalDocument storage doc = documents[documentId];
        require(msg.sender == doc.recipient, "Not recipient");
        require(!doc.accepted, "Already accepted");
        
        doc.accepted = true;
        doc.acceptedTime = block.timestamp;
        
        uint256 docTokenId = 1000000 + documentId;
        _tokenOwners[docTokenId] = msg.sender;
        
        emit DocumentAccepted(documentId, msg.sender, block.timestamp);
        emit Transfer(address(0), msg.sender, docTokenId);
        
        // Update notice status for app compatibility
        notices[documentId].status = 2; // 2 = accepted
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
            // Alert NFT with full information
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
            // Document NFT (only visible after acceptance)
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
        
        // Count pending
        for (uint i = 0; i < allDocs.length; i++) {
            if (!documents[allDocs[i]].accepted) {
                pendingCount++;
            }
        }
        
        // Populate arrays
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
    
    function balanceOf(address owner) external view returns (uint256) {
        return recipientAlerts[owner].length;
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _tokenOwners[tokenId];
    }
    
    // ===== APP COMPATIBILITY FUNCTIONS =====
    // These come after ALL main functions to avoid forward declaration issues
    
    function createLegalNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewImage,
        bytes32 contentHash,
        string calldata caseNumber,
        uint16 jurisdictionIndex,
        uint8 documentType
    ) external payable returns (uint256 noticeId, uint256 alertId) {
        // Map old function to new serveNotice function
        // Use default values for new parameters
        return serveNotice(
            recipient,
            ipfsHash,
            "", // decryptionKey - empty for non-encrypted
            "Legal Authority", // issuingAgency - default
            "Legal Notice", // noticeType - default
            caseNumber,
            "Document attached", // caseDetails - default
            "You have legal rights regarding this notice", // legalRights - default
            true // sponsorFees - default to sponsored
        );
    }
    
    function acceptNotice(uint256 tokenId) external {
        // Map to acceptDocument - need to find document ID from alert
        AlertNotice storage alert = alerts[tokenId];
        acceptDocument(alert.documentId);
    }
    
    function getUserNotices(address user) external view returns (uint256[] memory) {
        return recipientDocuments[user];
    }
    
    function getUserAlerts(address user) external view returns (uint256[] memory) {
        return recipientAlerts[user];
    }
    
    // Mock admin functions for app compatibility
    function grantRole(bytes32 role, address account) external onlyAdmin {
        // Basic role management - could be expanded
    }
    
    function hasRole(bytes32 role, address account) external view returns (bool) {
        // Basic role check - admin is only role for now
        return account == admin;
    }
    
    function feeExemptions(address user) external view returns (bool) {
        // For now, return false - could be expanded
        return false;
    }
    
    function creationFee() external view returns (uint256) {
        return serviceFee;
    }
    
    function updateFee(uint256 newFee) external onlyAdmin {
        serviceFee = newFee;
    }
    
    function updateFeeCollector(address payable newCollector) external onlyAdmin {
        admin = newCollector;
    }
    
    function resourceSponsorshipEnabled() external pure returns (bool) {
        return true; // Always enabled in this contract
    }
    
    function setResourceSponsorship(bool enabled) external onlyAdmin {
        // No-op since always enabled
    }
    
    function updateServiceFee(uint256 newFee) external onlyAdmin {
        serviceFee = newFee;
    }
    
    function updateCreationFee(uint256 newFee) external onlyAdmin {
        serviceFee = newFee;
    }
    
    function updateSponsorshipFee(uint256 newFee) external onlyAdmin {
        // No-op for now
    }
    
    function withdrawTRX(uint256 amount) external onlyAdmin {
        payable(admin).transfer(amount);
    }
    
    function setFeeExemption(address user, bool exempt) external onlyAdmin {
        // No-op for now - could be expanded
    }
    
    function setFullFeeExemption(address user, bool exempt) external onlyAdmin {
        // No-op for now - could be expanded  
    }
    
    function setServiceFeeExemption(address user, bool exempt) external onlyAdmin {
        // No-op for now - could be expanded
    }
    
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 tempValue = value;
        uint256 digits;
        while (tempValue != 0) {
            digits++;
            tempValue /= 10;
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