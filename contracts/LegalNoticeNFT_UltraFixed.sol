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
    
    mapping(uint256 => AlertNotice) public alerts;
    mapping(uint256 => LegalDocument) public documents;
    mapping(uint256 => address) private _tokenOwners;
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public recipientDocuments;
    mapping(uint256 => mapping(address => bool)) public documentViewers;
    
    uint256 private _alertCounter;
    uint256 private _documentCounter;
    
    address public admin;
    uint256 public serviceFee = 20000000; // 20 TRX
    
    constructor() {
        admin = msg.sender;
    }
    
    // Split into two functions to avoid stack depth
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
        _validateAndCharge(recipient, sponsorFees);
        _validateStrings(issuingAgency, noticeType, caseNumber, caseDetails, legalRights);
        
        documentId = _storeDocument(recipient, encryptedIPFS, decryptionKey, issuingAgency, noticeType, caseNumber);
        alertId = _mintAlert(recipient, documentId, issuingAgency, noticeType, caseNumber, caseDetails, legalRights, sponsorFees);
    }
    
    function _validateAndCharge(address recipient, bool sponsorFees) internal {
        uint256 required = serviceFee;
        if (sponsorFees) required += 2000000;
        require(msg.value >= required, "Insufficient fee");
        require(recipient != address(0), "Invalid recipient");
    }
    
    function _validateStrings(
        string calldata agency,
        string calldata noticeType,
        string calldata caseNumber,
        string calldata details,
        string calldata rights
    ) internal pure {
        require(bytes(agency).length <= 100, "Agency too long");
        require(bytes(noticeType).length <= 50, "Type too long");
        require(bytes(caseNumber).length <= 50, "Case too long");
        require(bytes(details).length <= 100, "Details too long");
        require(bytes(rights).length <= 100, "Rights too long");
    }
    
    function _storeDocument(
        address recipient,
        string calldata ipfs,
        string calldata key,
        string calldata agency,
        string calldata noticeType,
        string calldata caseNumber
    ) internal returns (uint256 docId) {
        docId = ++_documentCounter;
        
        LegalDocument storage doc = documents[docId];
        doc.server = msg.sender;
        doc.recipient = recipient;
        doc.ipfsHash = ipfs;
        doc.caseInfo = string(abi.encodePacked(agency, " - ", noticeType, " - Case ", caseNumber));
        doc.timestamp = block.timestamp;
        doc.accepted = false;
        doc.acceptedTime = 0;
        doc.decryptionKey = key;
        
        recipientDocuments[recipient].push(docId);
    }
    
    function _mintAlert(
        address recipient,
        uint256 docId,
        string calldata agency,
        string calldata noticeType,
        string calldata caseNumber,
        string calldata details,
        string calldata rights,
        bool sponsored
    ) internal returns (uint256 alertId) {
        alertId = ++_alertCounter;
        
        AlertNotice storage alert = alerts[alertId];
        alert.documentId = docId;
        alert.recipient = recipient;
        alert.issuingAgency = agency;
        alert.noticeType = noticeType;
        alert.caseNumber = caseNumber;
        alert.caseDetails = details;
        alert.legalRights = rights;
        alert.feesSponsored = sponsored;
        alert.timestamp = block.timestamp;
        
        recipientAlerts[recipient].push(alertId);
        _tokenOwners[alertId] = recipient;
        
        emit Transfer(address(0), recipient, alertId);
        emit AlertCreated(alertId, recipient, docId);
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
        require(tokenId <= _alertCounter, "Invalid token");
        
        AlertNotice storage alert = alerts[tokenId];
        
        return string(abi.encodePacked(
            'data:application/json;utf8,{',
            '"name":"', alert.noticeType, '",',
            '"description":"', alert.issuingAgency, ' ', alert.noticeType, ' - Case ', alert.caseNumber, '. ', alert.caseDetails, '. ', alert.legalRights, '. ',
            alert.feesSponsored ? 'All fees paid. Accept with no charge.' : 'Acceptance requires fee.',
            ' Documentation included.",',
            '"attributes":[',
            '{"trait_type":"Agency","value":"', alert.issuingAgency, '"},',
            '{"trait_type":"Type","value":"', alert.noticeType, '"},',
            '{"trait_type":"Case","value":"', alert.caseNumber, '"}',
            ']}'
        ));
    }
    
    function getPendingDocuments(address recipient) external view returns (uint256[] memory) {
        uint256[] storage allDocs = recipientDocuments[recipient];
        uint256 count = 0;
        
        for (uint i = 0; i < allDocs.length; i++) {
            if (!documents[allDocs[i]].accepted) count++;
        }
        
        uint256[] memory pending = new uint256[](count);
        uint256 index = 0;
        
        for (uint i = 0; i < allDocs.length; i++) {
            if (!documents[allDocs[i]].accepted) {
                pending[index++] = allDocs[i];
            }
        }
        
        return pending;
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
}