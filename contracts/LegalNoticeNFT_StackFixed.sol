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
    
    struct NoticeParams {
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
    mapping(uint256 => address) private _tokenOwners;
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public recipientDocuments;
    mapping(uint256 => mapping(address => bool)) public documentViewers;
    
    uint256 private _alertCounter;
    uint256 private _documentCounter;
    
    address public admin;
    uint256 public serviceFee = 20 * 10**6; // 20 TRX
    
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
        NoticeParams memory params = NoticeParams({
            recipient: recipient,
            encryptedIPFS: encryptedIPFS,
            decryptionKey: decryptionKey,
            issuingAgency: issuingAgency,
            noticeType: noticeType,
            caseNumber: caseNumber,
            caseDetails: caseDetails,
            legalRights: legalRights,
            sponsorFees: sponsorFees
        });
        
        return _processNotice(params);
    }
    
    function _processNotice(NoticeParams memory params) internal returns (uint256 alertId, uint256 documentId) {
        // Calculate required payment
        uint256 requiredPayment = serviceFee;
        if (params.sponsorFees) {
            requiredPayment += 2 * 10**6; // Add 2 TRX for sponsored acceptance
        }
        
        require(msg.value >= requiredPayment, "Insufficient fee");
        require(params.recipient != address(0), "Invalid recipient");
        require(bytes(params.issuingAgency).length <= 100, "Agency name too long");
        require(bytes(params.noticeType).length <= 50, "Notice type too long");
        require(bytes(params.caseNumber).length <= 50, "Case number too long");
        require(bytes(params.caseDetails).length <= 100, "Case details too long");
        require(bytes(params.legalRights).length <= 100, "Rights text too long");
        
        // Create the document record (not visible yet)
        documentId = ++_documentCounter;
        documents[documentId] = LegalDocument({
            server: msg.sender,
            recipient: params.recipient,
            ipfsHash: params.encryptedIPFS,
            caseInfo: string(abi.encodePacked(params.issuingAgency, " - ", params.noticeType, " - Case ", params.caseNumber)),
            timestamp: block.timestamp,
            accepted: false,
            acceptedTime: 0,
            decryptionKey: params.decryptionKey
        });
        recipientDocuments[params.recipient].push(documentId);
        
        // Create the alert NFT (immediately visible in wallet)
        alertId = ++_alertCounter;
        alerts[alertId] = AlertNotice({
            documentId: documentId,
            recipient: params.recipient,
            issuingAgency: params.issuingAgency,
            noticeType: params.noticeType,
            caseNumber: params.caseNumber,
            caseDetails: params.caseDetails,
            legalRights: params.legalRights,
            feesSponsored: params.sponsorFees,
            timestamp: block.timestamp
        });
        recipientAlerts[params.recipient].push(alertId);
        
        // Mint alert NFT to recipient
        _tokenOwners[alertId] = params.recipient;
        emit Transfer(address(0), params.recipient, alertId);
        emit AlertCreated(alertId, params.recipient, documentId);
    }
    
    function acceptDocument(uint256 documentId) external {
        LegalDocument storage doc = documents[documentId];
        require(msg.sender == doc.recipient, "Not recipient");
        require(!doc.accepted, "Already accepted");
        
        doc.accepted = true;
        doc.acceptedTime = block.timestamp;
        
        // Mint document NFT to recipient
        uint256 docTokenId = 1000000 + documentId; // Offset to avoid collision
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
        LegalDocument memory doc = documents[documentId];
        
        // Allow server or accepted recipient to view
        require(
            msg.sender == doc.server || 
            (msg.sender == doc.recipient && doc.accepted),
            "Not authorized to view"
        );
        
        // Track viewers for audit trail
        if (!documentViewers[documentId][msg.sender]) {
            documentViewers[documentId][msg.sender] = true;
            emit DocumentViewed(documentId, msg.sender);
        }
        
        ipfsHash = doc.ipfsHash;
        caseInfo = doc.caseInfo;
        acceptedTime = doc.acceptedTime;
        
        // Only reveal decryption key if accepted or server
        if (doc.accepted || msg.sender == doc.server) {
            decryptionKey = doc.decryptionKey;
        } else {
            decryptionKey = ""; // Not revealed until accepted
        }
    }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (tokenId <= _alertCounter) {
            // Alert NFT with full information
            AlertNotice memory alert = alerts[tokenId];
            
            // Build comprehensive description
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
            LegalDocument memory doc = documents[docId];
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
        uint256[] memory allDocs = recipientDocuments[recipient];
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
        LegalDocument memory doc = documents[documentId];
        return (
            doc.server,
            doc.recipient,
            doc.timestamp,
            doc.acceptedTime,
            doc.accepted
        );
    }
    
    // Minimal ERC-721 compliance
    function balanceOf(address owner) external view returns (uint256) {
        return recipientAlerts[owner].length + recipientDocuments[owner].length;
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _tokenOwners[tokenId];
    }
    
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