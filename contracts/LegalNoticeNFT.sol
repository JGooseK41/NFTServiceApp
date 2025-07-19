// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract LegalNoticeNFT {
    // Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AlertCreated(uint256 indexed alertId, address indexed recipient, uint256 documentId);
    event DocumentAccepted(uint256 indexed documentId, address indexed recipient, uint256 timestamp);
    event DocumentViewed(uint256 indexed documentId, address indexed viewer);
    
    // Minimal structs
    struct Document {
        address server;
        address recipient;
        string data; // Combined IPFS hash and metadata
        uint256 timestamp;
        bool accepted;
        uint256 acceptedTime;
    }
    
    struct Alert {
        uint256 documentId;
        address recipient;
        string metadata; // Combined agency, type, case number
        bool feesSponsored;
        uint256 timestamp;
    }
    
    // State variables
    mapping(uint256 => Alert) public alerts;
    mapping(uint256 => Document) public documents;
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
    
    // Simplified serve notice with fewer parameters
    function serveNotice(
        address recipient,
        string memory documentData,
        string memory alertMetadata,
        bool sponsorFees
    ) public payable returns (uint256 alertId, uint256 documentId) {
        uint256 required = serviceFee;
        if (sponsorFees) required += 2000000;
        require(msg.value >= required, "Insufficient fee");
        require(recipient != address(0), "Invalid recipient");
        
        // Create document
        documentId = ++_documentCounter;
        documents[documentId] = Document({
            server: msg.sender,
            recipient: recipient,
            data: documentData,
            timestamp: block.timestamp,
            accepted: false,
            acceptedTime: 0
        });
        recipientDocuments[recipient].push(documentId);
        
        // Create alert
        alertId = ++_alertCounter;
        alerts[alertId] = Alert({
            documentId: documentId,
            recipient: recipient,
            metadata: alertMetadata,
            feesSponsored: sponsorFees,
            timestamp: block.timestamp
        });
        recipientAlerts[recipient].push(alertId);
        _tokenOwners[alertId] = recipient;
        
        emit Transfer(address(0), recipient, alertId);
        emit AlertCreated(alertId, recipient, documentId);
    }
    
    function acceptDocument(uint256 documentId) public {
        Document storage doc = documents[documentId];
        require(msg.sender == doc.recipient, "Not recipient");
        require(!doc.accepted, "Already accepted");
        
        doc.accepted = true;
        doc.acceptedTime = block.timestamp;
        
        uint256 docTokenId = 1000000 + documentId;
        _tokenOwners[docTokenId] = msg.sender;
        
        emit DocumentAccepted(documentId, msg.sender, block.timestamp);
        emit Transfer(address(0), msg.sender, docTokenId);
    }
    
    function viewDocument(uint256 documentId) external returns (string memory data, uint256 acceptedTime) {
        Document storage doc = documents[documentId];
        
        require(
            msg.sender == doc.server || 
            (msg.sender == doc.recipient && doc.accepted),
            "Not authorized"
        );
        
        if (!documentViewers[documentId][msg.sender]) {
            documentViewers[documentId][msg.sender] = true;
            emit DocumentViewed(documentId, msg.sender);
        }
        
        return (doc.data, doc.acceptedTime);
    }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (tokenId <= _alertCounter) {
            Alert storage alert = alerts[tokenId];
            return string(abi.encodePacked(
                'data:application/json;utf8,{"name":"Legal Notice",',
                '"description":"', alert.metadata, '",',
                '"external_url":"https://legalnotice.app/accept/', _toString(alert.documentId), '",',
                '"attributes":[{"trait_type":"Fees Paid","value":"', alert.feesSponsored ? "Yes" : "No", '"}]}'
            ));
        } else {
            uint256 docId = tokenId - 1000000;
            Document storage doc = documents[docId];
            require(doc.accepted, "Document not accepted");
            
            return string(abi.encodePacked(
                'data:application/json;utf8,{"name":"Legal Document #', _toString(docId), '",',
                '"description":"Accepted on ', _toString(doc.acceptedTime), '",',
                '"external_url":"https://legalnotice.app/document/', _toString(docId), '"}'
            ));
        }
    }
    
    // Legacy compatibility wrapper
    function createLegalNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewImage,
        bytes32 contentHash,
        string calldata caseNumber,
        uint16 jurisdictionIndex,
        uint8 documentType
    ) external payable returns (uint256 noticeId, uint256 alertId) {
        string memory documentData = string(abi.encodePacked(ipfsHash, "|", previewImage));
        string memory alertMetadata = string(abi.encodePacked("Legal Authority|Legal Notice|", caseNumber));
        
        (alertId, noticeId) = serveNotice(recipient, documentData, alertMetadata, true);
    }
    
    function acceptNotice(uint256 tokenId) external {
        Alert storage alert = alerts[tokenId];
        acceptDocument(alert.documentId);
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