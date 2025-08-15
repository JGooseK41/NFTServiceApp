// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LegalNoticeNFT_WithEncryption is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    
    Counters.Counter private _tokenIdCounter;
    Counters.Counter private _alertIdCounter;
    
    // Public Key Registry
    mapping(address => bytes) public publicKeyRegistry;
    mapping(address => bool) public hasRegisteredKey;
    
    // Enhanced document structure with encryption
    struct DocumentNotice {
        string encryptedIPFS;
        string encryptedKey;      // Key encrypted with recipient's public key
        address authorizedViewer;
        uint256 alertId;
        bool isRestricted;
        bool isEncrypted;         // Flag to indicate if document is encrypted
    }
    
    // Alert/Notice structure
    struct AlertNotice {
        address recipient;
        address sender;
        uint256 documentId;
        uint256 timestamp;
        bool acknowledged;
        string issuingAgency;
        string noticeType;
        string caseNumber;
        string caseDetails;       // Public text notice
        string legalRights;
        uint256 responseDeadline;
        string previewImage;
    }
    
    // Mappings
    mapping(uint256 => DocumentNotice) public documentNotices;
    mapping(uint256 => AlertNotice) public alertNotices;
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public serverNotices;
    
    // Fee structure
    uint256 public serviceFee = 150e6;    // 150 TRX for encrypted documents
    uint256 public textOnlyFee = 15e6;    // 15 TRX for text only
    uint256 public creationFee = 75e6;    // 75 TRX for process servers
    uint256 public sponsorshipFee = 2e6;  // 2 TRX
    address public feeCollector;
    
    // Events
    event PublicKeyRegistered(address indexed user, bytes publicKey);
    event PublicKeyUpdated(address indexed user, bytes oldKey, bytes newKey);
    event NoticeServed(uint256 indexed alertId, uint256 indexed documentId, address indexed recipient);
    event NoticeAcknowledged(uint256 indexed alertId, address indexed recipient);
    event DocumentDecrypted(uint256 indexed documentId, address indexed viewer);
    
    constructor() ERC721("Legal Notice NFT", "NOTICE") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        feeCollector = msg.sender;
        _alertIdCounter.increment(); // Start at 1
    }
    
    // Public Key Registration
    function registerPublicKey(bytes memory publicKey) external {
        require(publicKey.length > 0, "Invalid public key");
        
        if (hasRegisteredKey[msg.sender]) {
            bytes memory oldKey = publicKeyRegistry[msg.sender];
            publicKeyRegistry[msg.sender] = publicKey;
            emit PublicKeyUpdated(msg.sender, oldKey, publicKey);
        } else {
            publicKeyRegistry[msg.sender] = publicKey;
            hasRegisteredKey[msg.sender] = true;
            emit PublicKeyRegistered(msg.sender, publicKey);
        }
    }
    
    // Get public key for address
    function getPublicKey(address user) external view returns (bytes memory) {
        require(hasRegisteredKey[user], "User has not registered public key");
        return publicKeyRegistry[user];
    }
    
    // Check if address has registered key
    function hasPublicKey(address user) external view returns (bool) {
        return hasRegisteredKey[user];
    }
    
    // Serve encrypted document notice
    function serveEncryptedNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory encryptedKey,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory publicNoticeText,    // Public text that accompanies encrypted doc
        string memory legalRights,
        bool sponsorFees
    ) public payable nonReentrant returns (uint256 alertId, uint256 documentId) {
        require(hasRegisteredKey[recipient], "Recipient must register public key first");
        
        // Calculate fee
        uint256 requiredFee = hasRole(PROCESS_SERVER_ROLE, msg.sender) ? creationFee : serviceFee;
        if (sponsorFees) {
            requiredFee += sponsorshipFee;
        }
        
        require(msg.value >= requiredFee, "Insufficient fee");
        
        // Create document record
        _tokenIdCounter.increment();
        documentId = _tokenIdCounter.current();
        
        documentNotices[documentId] = DocumentNotice({
            encryptedIPFS: encryptedIPFS,
            encryptedKey: encryptedKey,
            authorizedViewer: recipient,
            alertId: 0, // Will be set below
            isRestricted: true,
            isEncrypted: true
        });
        
        // Create alert
        alertId = _alertIdCounter.current();
        _alertIdCounter.increment();
        
        uint256 deadline = block.timestamp + 30 days;
        
        alertNotices[alertId] = AlertNotice({
            recipient: recipient,
            sender: msg.sender,
            documentId: documentId,
            timestamp: block.timestamp,
            acknowledged: false,
            issuingAgency: issuingAgency,
            noticeType: noticeType,
            caseNumber: caseNumber,
            caseDetails: publicNoticeText,
            legalRights: legalRights,
            responseDeadline: deadline,
            previewImage: ""
        });
        
        documentNotices[documentId].alertId = alertId;
        
        // Track notices
        recipientAlerts[recipient].push(alertId);
        serverNotices[msg.sender].push(alertId);
        
        // Transfer fees
        if (msg.value > 0) {
            (bool success, ) = payable(feeCollector).call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }
        
        emit NoticeServed(alertId, documentId, recipient);
        
        return (alertId, documentId);
    }
    
    // Serve text-only notice (no encryption needed)
    function serveTextNotice(
        address recipient,
        string memory noticeText,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory legalRights
    ) public payable nonReentrant returns (uint256 alertId) {
        // Text-only notices don't require public key
        require(msg.value >= textOnlyFee, "Insufficient fee");
        
        // Create alert without document
        alertId = _alertIdCounter.current();
        _alertIdCounter.increment();
        
        uint256 deadline = block.timestamp + 30 days;
        
        alertNotices[alertId] = AlertNotice({
            recipient: recipient,
            sender: msg.sender,
            documentId: 0, // No document for text-only
            timestamp: block.timestamp,
            acknowledged: false,
            issuingAgency: issuingAgency,
            noticeType: noticeType,
            caseNumber: caseNumber,
            caseDetails: noticeText,
            legalRights: legalRights,
            responseDeadline: deadline,
            previewImage: ""
        });
        
        recipientAlerts[recipient].push(alertId);
        serverNotices[msg.sender].push(alertId);
        
        // Transfer fees
        if (msg.value > 0) {
            (bool success, ) = payable(feeCollector).call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }
        
        emit NoticeServed(alertId, 0, recipient);
        
        return alertId;
    }
    
    // Accept notice (required for encrypted documents)
    function acceptNotice(uint256 alertId) external {
        AlertNotice storage notice = alertNotices[alertId];
        require(notice.recipient == msg.sender, "Not the recipient");
        require(!notice.acknowledged, "Already acknowledged");
        require(notice.documentId > 0, "Text notices don't require acceptance");
        
        notice.acknowledged = true;
        
        emit NoticeAcknowledged(alertId, msg.sender);
    }
    
    // Get decryption key (only after acceptance)
    function getDecryptionKey(uint256 documentId) external view returns (string memory) {
        DocumentNotice memory doc = documentNotices[documentId];
        require(doc.authorizedViewer == msg.sender, "Not authorized");
        
        AlertNotice memory alert = alertNotices[doc.alertId];
        require(alert.acknowledged, "Must accept notice first");
        
        return doc.encryptedKey;
    }
    
    // View document details
    function viewDocument(uint256 documentId) external view returns (
        string memory encryptedIPFS,
        string memory encryptedKey,
        bool canDecrypt
    ) {
        DocumentNotice memory doc = documentNotices[documentId];
        AlertNotice memory alert = alertNotices[doc.alertId];
        
        bool authorized = (doc.authorizedViewer == msg.sender && alert.acknowledged);
        
        return (
            doc.encryptedIPFS,
            authorized ? doc.encryptedKey : "",
            authorized
        );
    }
    
    // Get user's alerts
    function getRecipientAlerts(address recipient) external view returns (uint256[] memory) {
        return recipientAlerts[recipient];
    }
    
    // Get server's notices
    function getServerNotices(address server) external view returns (uint256[] memory) {
        return serverNotices[server];
    }
    
    // Admin functions
    function updateServiceFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        serviceFee = newFee;
    }
    
    function updateTextOnlyFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        textOnlyFee = newFee;
    }
    
    function updateCreationFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        creationFee = newFee;
    }
    
    function updateFeeCollector(address newCollector) external onlyRole(ADMIN_ROLE) {
        require(newCollector != address(0), "Invalid address");
        feeCollector = newCollector;
    }
    
    // Required overrides
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}