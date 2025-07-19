// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LegalNoticeNFT {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AlertCreated(uint256 indexed alertId, address indexed recipient, uint256 documentId);
    event DocumentAccepted(uint256 indexed documentId, address indexed recipient, uint256 timestamp);
    
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
        uint256 requiredPayment = serviceFee;
        if (sponsorFees) {
            requiredPayment += 2000000; // Add 2 TRX for sponsored acceptance
        }
        
        require(msg.value >= requiredPayment, "Insufficient fee");
        require(recipient != address(0), "Invalid recipient");
        
        // Create document record
        documentId = ++_documentCounter;
        documents[documentId] = LegalDocument({
            server: msg.sender,
            recipient: recipient,
            ipfsHash: encryptedIPFS,
            caseInfo: string(abi.encodePacked(issuingAgency, " - ", noticeType, " - Case ", caseNumber)),
            timestamp: block.timestamp,
            accepted: false,
            acceptedTime: 0,
            decryptionKey: decryptionKey
        });
        recipientDocuments[recipient].push(documentId);
        
        // Create alert NFT
        alertId = ++_alertCounter;
        alerts[alertId] = AlertNotice({
            documentId: documentId,
            recipient: recipient,
            issuingAgency: issuingAgency,
            noticeType: noticeType,
            caseNumber: caseNumber,
            caseDetails: caseDetails,
            legalRights: legalRights,
            feesSponsored: sponsorFees,
            timestamp: block.timestamp
        });
        recipientAlerts[recipient].push(alertId);
        
        _tokenOwners[alertId] = recipient;
        emit Transfer(address(0), recipient, alertId);
        emit AlertCreated(alertId, recipient, documentId);
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
    
    function viewDocument(uint256 documentId) external view returns (
        string memory ipfsHash,
        string memory decryptionKey,
        string memory caseInfo,
        uint256 acceptedTime
    ) {
        LegalDocument memory doc = documents[documentId];
        
        require(
            msg.sender == doc.server || 
            (msg.sender == doc.recipient && doc.accepted),
            "Not authorized"
        );
        
        ipfsHash = doc.ipfsHash;
        caseInfo = doc.caseInfo;
        acceptedTime = doc.acceptedTime;
        
        if (doc.accepted || msg.sender == doc.server) {
            decryptionKey = doc.decryptionKey;
        } else {
            decryptionKey = "";
        }
    }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (tokenId <= _alertCounter) {
            AlertNotice memory alert = alerts[tokenId];
            
            string memory description = string(abi.encodePacked(
                alert.issuingAgency, " ",
                alert.noticeType, " - Case ", alert.caseNumber, ". ",
                alert.caseDetails, ". ",
                alert.legalRights, ". ",
                alert.feesSponsored ? 
                    "All fees paid. Accept with no charge." : 
                    "Acceptance requires fee.",
                " Documentation included."
            ));
            
            return string(abi.encodePacked(
                'data:application/json;utf8,{',
                '"name":"', alert.noticeType, '",',
                '"description":"', description, '",',
                '"attributes":[',
                '{"trait_type":"Agency","value":"', alert.issuingAgency, '"},',
                '{"trait_type":"Type","value":"', alert.noticeType, '"},',
                '{"trait_type":"Case","value":"', alert.caseNumber, '"}',
                ']}'
            ));
        }
        return "";
    }
    
    function balanceOf(address owner) external view returns (uint256) {
        return recipientAlerts[owner].length;
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _tokenOwners[tokenId];
    }
}