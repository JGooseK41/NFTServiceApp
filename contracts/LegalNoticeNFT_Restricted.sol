// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title LegalNoticeNFT - Restricted Access Version
 * @notice Only approved process servers and law enforcement can create notices
 * @dev Implements strict access control for notice creation
 */
contract LegalNoticeNFT is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    bytes32 public constant LAW_ENFORCEMENT_ROLE = keccak256("LAW_ENFORCEMENT_ROLE");
    
    // Counters
    Counters.Counter private _noticeIdCounter;
    Counters.Counter private _serverIdCounter;
    
    // Fee structure
    uint256 public serviceFee = 20 * 10**6; // 20 TRX (profit margin)
    uint256 public creationFee = 10 * 10**6; // 10 TRX (operations)
    uint256 public sponsorshipFee = 2 * 10**6; // 2 TRX (recipient support)
    uint256 public textOnlyFee = 15 * 10**6; // 15 TRX for text-only notices
    
    address public feeCollector;
    bool public paused;
    
    // Process server info
    struct ProcessServer {
        uint256 serverId;
        string name;
        string agency;
        uint256 registeredDate;
        uint256 noticesServed;
        bool active;
    }
    
    mapping(address => ProcessServer) public processServers;
    mapping(uint256 => address) public serverIdToAddress;
    
    // Law enforcement agencies
    mapping(address => string) public lawEnforcementAgencies;
    
    // Notice structure
    struct Notice {
        address recipient;
        address sender;
        string encryptedIPFS;
        string encryptionKey;
        string publicText;
        string noticeType;
        string caseNumber;
        string issuingAgency;
        uint256 timestamp;
        bool accepted;
        bool hasDocument;
        uint256 serverId;
        string tokenName;
    }
    
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public senderNotices;
    
    // Events
    event NoticeCreated(
        uint256 indexed noticeId,
        address indexed recipient,
        address indexed sender,
        bool hasDocument,
        uint256 timestamp,
        uint256 serverId,
        string tokenName
    );
    
    event NoticeAccepted(uint256 indexed noticeId, address indexed recipient, uint256 timestamp);
    event ProcessServerRegistered(address indexed server, uint256 indexed serverId, string name, string agency);
    event ProcessServerUpdated(address indexed server, uint256 indexed serverId, string name, string agency);
    event ProcessServerStatusChanged(address indexed server, bool active);
    event FeeUpdated(string feeType, uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event ContractPaused(bool paused);
    event Withdrawal(address indexed to, uint256 amount);
    event FeesSponsored(address indexed recipient, uint256 amount);
    
    // Modifiers
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier onlyApprovedUsers() {
        require(
            hasRole(PROCESS_SERVER_ROLE, msg.sender) || 
            hasRole(LAW_ENFORCEMENT_ROLE, msg.sender) ||
            hasRole(ADMIN_ROLE, msg.sender),
            "Unauthorized: Must be approved process server or law enforcement"
        );
        _;
    }
    
    constructor() ERC721("Legal Notice NFT", "NOTICE") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        feeCollector = msg.sender;
        _noticeIdCounter.increment(); // Start at 1
        _serverIdCounter.increment(); // Start server IDs at 1
    }
    
    // Override grantRole to auto-assign server IDs
    function grantRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        super.grantRole(role, account);
        
        // Auto-register process server with next ID when role is granted
        if (role == PROCESS_SERVER_ROLE && processServers[account].serverId == 0) {
            uint256 newServerId = _serverIdCounter.current();
            processServers[account] = ProcessServer({
                serverId: newServerId,
                name: "",
                agency: "",
                registeredDate: block.timestamp,
                noticesServed: 0,
                active: true
            });
            serverIdToAddress[newServerId] = account;
            _serverIdCounter.increment();
        }
    }
    
    // Grant law enforcement role with agency name
    function grantLawEnforcementRole(address user, string memory agencyName) external onlyRole(ADMIN_ROLE) {
        require(bytes(agencyName).length > 0, "Agency name required");
        grantRole(LAW_ENFORCEMENT_ROLE, user);
        lawEnforcementAgencies[user] = agencyName;
    }
    
    // Remove law enforcement role
    function revokeLawEnforcementRole(address user) external onlyRole(ADMIN_ROLE) {
        revokeRole(LAW_ENFORCEMENT_ROLE, user);
        delete lawEnforcementAgencies[user];
    }
    
    // Calculate fee based on user role
    function calculateFee(address user) public view returns (uint256) {
        if (hasRole(LAW_ENFORCEMENT_ROLE, user)) {
            // Law enforcement pays only operational costs
            return creationFee + sponsorshipFee;
        }
        // Process servers pay full price
        return serviceFee + creationFee + sponsorshipFee;
    }
    
    // Calculate text-only fee based on user role
    function calculateTextOnlyFee(address user) public view returns (uint256) {
        if (hasRole(LAW_ENFORCEMENT_ROLE, user)) {
            // Law enforcement pays reduced rate
            return 5 * 10**6; // 5 TRX
        }
        return textOnlyFee; // 15 TRX
    }
    
    // Create document notice - RESTRICTED TO APPROVED USERS
    function createDocumentNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory encryptionKey,
        string memory publicText,
        string memory noticeType,
        string memory caseNumber,
        string memory issuingAgency,
        string memory baseTokenName
    ) external payable nonReentrant whenNotPaused onlyApprovedUsers returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(encryptedIPFS).length > 0, "Document hash required");
        require(bytes(encryptionKey).length > 0, "Encryption key required");
        
        uint256 requiredFee = calculateFee(msg.sender);
        require(msg.value >= requiredFee, "Insufficient fee");
        
        uint256 noticeId = _createNotice(
            recipient,
            encryptedIPFS,
            encryptionKey,
            publicText,
            noticeType,
            caseNumber,
            issuingAgency,
            baseTokenName,
            true
        );
        
        _handleFees(requiredFee);
        
        return noticeId;
    }
    
    // Create text-only notice - RESTRICTED TO APPROVED USERS
    function createTextNotice(
        address recipient,
        string memory publicText,
        string memory noticeType,
        string memory caseNumber,
        string memory issuingAgency,
        string memory baseTokenName
    ) external payable nonReentrant whenNotPaused onlyApprovedUsers returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(publicText).length > 0, "Notice text required");
        
        uint256 requiredFee = calculateTextOnlyFee(msg.sender);
        require(msg.value >= requiredFee, "Insufficient fee");
        
        uint256 noticeId = _createNotice(
            recipient,
            "",
            "",
            publicText,
            noticeType,
            caseNumber,
            issuingAgency,
            baseTokenName,
            false
        );
        
        _handleFees(requiredFee);
        
        return noticeId;
    }
    
    // Internal function to create notice
    function _createNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory encryptionKey,
        string memory publicText,
        string memory noticeType,
        string memory caseNumber,
        string memory issuingAgency,
        string memory baseTokenName,
        bool hasDocument
    ) private returns (uint256) {
        uint256 noticeId = _noticeIdCounter.current();
        _noticeIdCounter.increment();
        
        uint256 serverId = processServers[msg.sender].serverId;
        
        // Generate token name with notice ID
        string memory tokenName = string(abi.encodePacked(baseTokenName, " #", noticeId.toString()));
        
        notices[noticeId] = Notice({
            recipient: recipient,
            sender: msg.sender,
            encryptedIPFS: encryptedIPFS,
            encryptionKey: encryptionKey,
            publicText: publicText,
            noticeType: noticeType,
            caseNumber: caseNumber,
            issuingAgency: issuingAgency,
            timestamp: block.timestamp,
            accepted: false,
            hasDocument: hasDocument,
            serverId: serverId,
            tokenName: tokenName
        });
        
        recipientNotices[recipient].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
        
        // Update server stats if applicable
        if (serverId > 0) {
            processServers[msg.sender].noticesServed++;
        }
        
        // Mint NFT to recipient
        _safeMint(recipient, noticeId);
        _setTokenURI(noticeId, _generateTokenURI(noticeId));
        
        emit NoticeCreated(noticeId, recipient, msg.sender, hasDocument, block.timestamp, serverId, tokenName);
        
        return noticeId;
    }
    
    // Handle fee distribution
    function _handleFees(uint256 requiredFee) private {
        // Send fees to collector
        (bool success, ) = feeCollector.call{value: requiredFee}("");
        require(success, "Fee transfer failed");
        
        // Refund excess
        if (msg.value > requiredFee) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - requiredFee}("");
            require(refundSuccess, "Refund failed");
        }
    }
    
    // Accept notice (recipient only)
    function acceptNotice(uint256 noticeId) external nonReentrant returns (string memory) {
        require(_exists(noticeId), "Notice does not exist");
        require(ownerOf(noticeId) == msg.sender, "Not the recipient");
        require(!notices[noticeId].accepted, "Already accepted");
        
        notices[noticeId].accepted = true;
        
        emit NoticeAccepted(noticeId, msg.sender, block.timestamp);
        
        // Return decryption key if document exists
        if (notices[noticeId].hasDocument) {
            return notices[noticeId].encryptionKey;
        }
        
        return "";
    }
    
    // Register/update process server details
    function registerProcessServer(string memory name, string memory agency) external {
        require(hasRole(PROCESS_SERVER_ROLE, msg.sender), "Not a process server");
        require(bytes(name).length > 0, "Name required");
        require(bytes(agency).length > 0, "Agency required");
        
        ProcessServer storage server = processServers[msg.sender];
        require(server.serverId > 0, "Server ID not assigned");
        
        server.name = name;
        server.agency = agency;
        
        if (server.registeredDate == 0) {
            server.registeredDate = block.timestamp;
            emit ProcessServerRegistered(msg.sender, server.serverId, name, agency);
        } else {
            emit ProcessServerUpdated(msg.sender, server.serverId, name, agency);
        }
    }
    
    // Admin functions
    function setProcessServerStatus(address server, bool active) external onlyRole(ADMIN_ROLE) {
        require(processServers[server].serverId > 0, "Not a registered server");
        processServers[server].active = active;
        emit ProcessServerStatusChanged(server, active);
    }
    
    function updateFees(
        uint256 _serviceFee,
        uint256 _textFee,
        uint256 _creationFee,
        uint256 _sponsorshipFee
    ) external onlyRole(ADMIN_ROLE) {
        serviceFee = _serviceFee;
        textOnlyFee = _textFee;
        creationFee = _creationFee;
        sponsorshipFee = _sponsorshipFee;
        
        emit FeeUpdated("service", serviceFee, _serviceFee);
        emit FeeUpdated("textOnly", textOnlyFee, _textFee);
        emit FeeUpdated("creation", creationFee, _creationFee);
        emit FeeUpdated("sponsorship", sponsorshipFee, _sponsorshipFee);
    }
    
    function updateFeeCollector(address newCollector) external onlyRole(ADMIN_ROLE) {
        require(newCollector != address(0), "Invalid address");
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        paused = true;
        emit ContractPaused(true);
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        paused = false;
        emit ContractPaused(false);
    }
    
    function withdrawTRX(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
        emit Withdrawal(msg.sender, amount);
    }
    
    // View functions
    function getNoticeInfo(uint256 noticeId) external view returns (
        address recipient,
        address sender,
        string memory publicText,
        string memory noticeType,
        string memory caseNumber,
        string memory issuingAgency,
        uint256 timestamp,
        bool accepted,
        bool hasDocument,
        uint256 serverId,
        string memory tokenName
    ) {
        Notice memory notice = notices[noticeId];
        return (
            notice.recipient,
            notice.sender,
            notice.publicText,
            notice.noticeType,
            notice.caseNumber,
            notice.issuingAgency,
            notice.timestamp,
            notice.accepted,
            notice.hasDocument,
            notice.serverId,
            notice.tokenName
        );
    }
    
    function getDocument(uint256 noticeId) external view returns (
        string memory encryptedIPFS,
        string memory decryptionKey
    ) {
        require(_exists(noticeId), "Notice does not exist");
        require(
            ownerOf(noticeId) == msg.sender || 
            notices[noticeId].sender == msg.sender ||
            hasRole(ADMIN_ROLE, msg.sender),
            "Unauthorized"
        );
        
        return (notices[noticeId].encryptedIPFS, notices[noticeId].encryptionKey);
    }
    
    function getRecipientNotices(address recipient) external view returns (uint256[] memory) {
        return recipientNotices[recipient];
    }
    
    function getSenderNotices(address sender) external view returns (uint256[] memory) {
        return senderNotices[sender];
    }
    
    function getProcessServerInfo(address serverAddress) external view returns (
        uint256 serverId,
        string memory name,
        string memory agency,
        uint256 registeredDate,
        uint256 noticesServed,
        bool active
    ) {
        ProcessServer memory server = processServers[serverAddress];
        return (
            server.serverId,
            server.name,
            server.agency,
            server.registeredDate,
            server.noticesServed,
            server.active
        );
    }
    
    function totalNotices() external view returns (uint256) {
        return _noticeIdCounter.current() - 1;
    }
    
    // Generate token URI
    function _generateTokenURI(uint256 noticeId) private view returns (string memory) {
        Notice memory notice = notices[noticeId];
        
        // Create JSON metadata
        string memory json = string(abi.encodePacked(
            '{"name": "', notice.tokenName, '",',
            '"description": "Legal Notice NFT - ', notice.noticeType, '",',
            '"attributes": [',
            '{"trait_type": "Notice Type", "value": "', notice.noticeType, '"},',
            '{"trait_type": "Case Number", "value": "', notice.caseNumber, '"},',
            '{"trait_type": "Issuing Agency", "value": "', notice.issuingAgency, '"},',
            '{"trait_type": "Has Document", "value": "', notice.hasDocument ? "Yes" : "No", '"},',
            '{"trait_type": "Accepted", "value": "', notice.accepted ? "Yes" : "No", '"}',
            ']}'
        ));
        
        // Encode to base64
        string memory base64Json = string(abi.encodePacked(
            "data:application/json;base64,",
            _base64Encode(bytes(json))
        ));
        
        return base64Json;
    }
    
    // Base64 encoding helper
    function _base64Encode(bytes memory data) private pure returns (string memory) {
        if (data.length == 0) return "";
        
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        string memory result = "";
        
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory encoded = new bytes(encodedLen);
        
        uint256 dataIndex = 0;
        uint256 encodedIndex = 0;
        
        while (dataIndex < data.length) {
            uint256 a = uint8(data[dataIndex]);
            uint256 b = dataIndex + 1 < data.length ? uint8(data[dataIndex + 1]) : 0;
            uint256 c = dataIndex + 2 < data.length ? uint8(data[dataIndex + 2]) : 0;
            
            uint256 triple = (a << 16) + (b << 8) + c;
            
            encoded[encodedIndex] = bytes(table)[(triple >> 18) & 0x3F];
            encoded[encodedIndex + 1] = bytes(table)[(triple >> 12) & 0x3F];
            encoded[encodedIndex + 2] = dataIndex + 1 < data.length ? bytes(table)[(triple >> 6) & 0x3F] : bytes("=")[0];
            encoded[encodedIndex + 3] = dataIndex + 2 < data.length ? bytes(table)[triple & 0x3F] : bytes("=")[0];
            
            dataIndex += 3;
            encodedIndex += 4;
        }
        
        return string(encoded);
    }
    
    // Required overrides
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}