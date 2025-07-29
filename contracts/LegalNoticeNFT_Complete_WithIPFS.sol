// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LegalNoticeNFT_Complete_WithIPFS is ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl, ReentrancyGuard {
    using Strings for uint256;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    
    // Simple counters instead of library
    uint256 private _noticeIdCounter = 1;
    uint256 private _serverIdCounter = 1;
    
    // Optimized structs
    struct ProcessServer {
        uint128 serverId;
        uint128 noticesServed;
        uint256 registeredDate;
        string name;
        string agency;
        bool active;
    }
    
    struct Notice {
        address recipient;
        address sender;
        string documentData;    // Combined IPFS + key
        string publicText;
        string metadata;        // Combined type + case + agency
        uint256 packedData;    // timestamp(64) + serverId(64) + flags(128)
        string tokenName;
        string metadataURI;    // NEW: IPFS URI for NFT metadata
    }
    
    // Request struct to avoid stack too deep
    struct NoticeRequest {
        address recipient;
        string publicText;
        string noticeType;
        string caseNumber;
        string issuingAgency;
        string baseTokenName;
        bool hasDocument;
        string encryptedIPFS;
        string encryptionKey;
        string metadataURI;    // NEW: Add IPFS metadata URI
    }
    
    struct BatchRequest {
        address[] recipients;
        string publicText;
        string noticeType;
        string caseNumber;
        string issuingAgency;
        string tokenNamePrefix;
        bool hasDocument;
        string documentData;
        string metadata;
        bool sponsorFees;
        string[] metadataURIs;  // NEW: Array of metadata URIs for batch
    }
    
    // Storage mappings
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public senderNotices;
    mapping(address => ProcessServer) public processServers;
    mapping(uint256 => address) public serverIdToAddress;
    mapping(address => bool) public lawEnforcementExemptions;
    mapping(address => string) public lawEnforcementAgencies;
    
    // Fee configuration
    uint128 public serviceFee = 20000000;       // 20 TRX
    uint128 public textOnlyFee = 10000000;      // 10 TRX
    uint128 public creationFee = 5000000;       // 5 TRX
    uint128 public sponsorshipFee = 2000000;    // 2 TRX
    address public feeCollector;
    
    // Control flags
    bool public paused;
    bool public emergencyMode;
    
    // Events
    event NoticeCreated(uint256 indexed noticeId, address indexed recipient, address indexed sender);
    event NoticeAccepted(uint256 indexed noticeId, address indexed recipient, uint256 timestamp);
    event ProcessServerRegistered(address indexed server, uint256 serverId, string name, string agency);
    event LawEnforcementExemption(address indexed user, bool exempt, string agency);
    event BatchNoticesCreated(uint256[] noticeIds, address[] recipients, address indexed sender);
    event FeesUpdated(uint128 serviceFee, uint128 textOnlyFee, uint128 creationFee);
    
    constructor() ERC721("Legal Notice NFT", "NOTICE") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        feeCollector = msg.sender;
    }
    
    modifier onlyAuthorized() {
        require(
            hasRole(PROCESS_SERVER_ROLE, msg.sender) || 
            hasRole(ADMIN_ROLE, msg.sender) ||
            lawEnforcementExemptions[msg.sender],
            "Not authorized"
        );
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused || hasRole(ADMIN_ROLE, msg.sender), "Paused");
        _;
    }
    
    // Single create function
    function createNotice(NoticeRequest calldata req) 
        external payable nonReentrant whenNotPaused onlyAuthorized 
        returns (uint256) 
    {
        _validateRequest(req);
        
        uint256 noticeId = _noticeIdCounter++;
        uint256 fee = _calculateAndChargeFee(msg.sender, req.hasDocument);
        
        _storeNotice(noticeId, req);
        _mintNotice(noticeId, req.recipient, req.metadataURI);
        _updateServerStats(msg.sender);
        
        emit NoticeCreated(noticeId, req.recipient, msg.sender);
        return noticeId;
    }
    
    // Batch create with packed params
    function createBatchNotices(BatchRequest calldata req)
        external payable nonReentrant whenNotPaused onlyAuthorized
        returns (uint256[] memory)
    {
        require(req.recipients.length > 0 && req.recipients.length <= 20, "Invalid batch");
        
        // Check if metadataURIs array matches recipients if provided
        require(
            req.metadataURIs.length == 0 || req.metadataURIs.length == req.recipients.length,
            "Metadata URIs must match recipients count"
        );
        
        uint256[] memory noticeIds = new uint256[](req.recipients.length);
        uint256 fee = _calculateBatchFee(msg.sender, req.recipients.length, req.hasDocument);
        require(msg.value >= fee, "Insufficient fee");
        
        for (uint256 i = 0; i < req.recipients.length; i++) {
            noticeIds[i] = _createBatchNotice(req, i);
        }
        
        _processBatchPayments(fee, req.sponsorFees, req.recipients);
        emit BatchNoticesCreated(noticeIds, req.recipients, msg.sender);
        
        return noticeIds;
    }
    
    // Accept notice
    function acceptNotice(uint256 noticeId) external nonReentrant returns (string memory) {
        require(_exists(noticeId), "Notice does not exist");
        require(ownerOf(noticeId) == msg.sender, "Not the recipient");
        
        uint256 packedData = notices[noticeId].packedData;
        require((packedData >> 1) & 1 == 0, "Already accepted");
        
        notices[noticeId].packedData = packedData | 2; // Set accepted flag
        
        emit NoticeAccepted(noticeId, msg.sender, block.timestamp);
        
        // Return decryption key
        string memory documentData = notices[noticeId].documentData;
        bytes memory dataBytes = bytes(documentData);
        
        // Find separator
        uint256 separatorIndex = 0;
        for (uint256 i = 0; i < dataBytes.length; i++) {
            if (dataBytes[i] == "|") {
                separatorIndex = i;
                break;
            }
        }
        
        // Extract key after separator
        bytes memory keyBytes = new bytes(dataBytes.length - separatorIndex - 1);
        for (uint256 i = separatorIndex + 1; i < dataBytes.length; i++) {
            keyBytes[i - separatorIndex - 1] = dataBytes[i];
        }
        
        return string(keyBytes);
    }
    
    // Get notice details
    function getNotice(uint256 noticeId) external view returns (Notice memory) {
        require(_exists(noticeId), "Notice does not exist");
        return notices[noticeId];
    }
    
    // Override grantRole to auto-register process servers
    function grantRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        super.grantRole(role, account);
        
        // Auto-register process server
        if (role == PROCESS_SERVER_ROLE && processServers[account].serverId == 0) {
            uint128 serverId = uint128(_serverIdCounter++);
            processServers[account] = ProcessServer({
                serverId: serverId,
                noticesServed: 0,
                registeredDate: block.timestamp,
                name: "Process Server",
                agency: "Independent",
                active: true
            });
            serverIdToAddress[serverId] = account;
            emit ProcessServerRegistered(account, serverId, "Process Server", "Independent");
        }
    }
    
    // Register process server with details
    function registerProcessServer(
        address server, 
        string calldata name, 
        string calldata agency
    ) external onlyRole(ADMIN_ROLE) {
        require(server != address(0), "Invalid address");
        require(processServers[server].serverId == 0, "Already registered");
        
        uint128 serverId = uint128(_serverIdCounter++);
        processServers[server] = ProcessServer({
            serverId: serverId,
            noticesServed: 0,
            registeredDate: block.timestamp,
            name: name,
            agency: agency,
            active: true
        });
        
        serverIdToAddress[serverId] = server;
        _grantRole(PROCESS_SERVER_ROLE, server);
        
        emit ProcessServerRegistered(server, serverId, name, agency);
    }
    
    // Admin functions
    function setFees(uint128 _serviceFee, uint128 _textOnlyFee, uint128 _creationFee) 
        external onlyRole(ADMIN_ROLE) 
    {
        serviceFee = _serviceFee;
        textOnlyFee = _textOnlyFee;
        creationFee = _creationFee;
        emit FeesUpdated(_serviceFee, _textOnlyFee, _creationFee);
    }
    
    function setSponsorshipFee(uint128 _fee) external onlyRole(ADMIN_ROLE) {
        sponsorshipFee = _fee;
    }
    
    function setFeeCollector(address _collector) external onlyRole(ADMIN_ROLE) {
        require(_collector != address(0), "Invalid address");
        feeCollector = _collector;
    }
    
    function setPaused(bool _paused) external onlyRole(ADMIN_ROLE) {
        paused = _paused;
    }
    
    function setLawEnforcementExemption(address user, bool exempt, string calldata agency) 
        external onlyRole(ADMIN_ROLE) 
    {
        lawEnforcementExemptions[user] = exempt;
        if (exempt && bytes(agency).length > 0) {
            lawEnforcementAgencies[user] = agency;
        } else if (!exempt) {
            delete lawEnforcementAgencies[user];
        }
        emit LawEnforcementExemption(user, exempt, agency);
    }
    
    function withdrawBalance() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool sent,) = feeCollector.call{value: balance}("");
        require(sent, "Transfer failed");
    }
    
    // Internal functions
    function _validateRequest(NoticeRequest calldata req) private pure {
        require(req.recipient != address(0), "Invalid recipient");
        require(bytes(req.baseTokenName).length > 0, "Token name required");
        require(!req.hasDocument || bytes(req.encryptedIPFS).length > 0, "Document required");
    }
    
    function _storeNotice(uint256 noticeId, NoticeRequest calldata req) private {
        notices[noticeId] = Notice({
            recipient: req.recipient,
            sender: msg.sender,
            documentData: string(abi.encodePacked(req.encryptedIPFS, "|", req.encryptionKey)),
            publicText: req.publicText,
            metadata: string(abi.encodePacked(req.noticeType, "|", req.caseNumber, "|", req.issuingAgency)),
            packedData: _packData(block.timestamp, processServers[msg.sender].serverId, req.hasDocument),
            tokenName: string(abi.encodePacked(req.baseTokenName, " #", noticeId.toString())),
            metadataURI: req.metadataURI
        });
        
        recipientNotices[req.recipient].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
    }
    
    function _calculateAndChargeFee(address user, bool hasDocument) private returns (uint256) {
        uint256 fee;
        if (lawEnforcementExemptions[user]) {
            fee = uint256(creationFee) + uint256(sponsorshipFee);
        } else {
            fee = uint256(hasDocument ? serviceFee : textOnlyFee) + uint256(creationFee) + uint256(sponsorshipFee);
        }
        
        require(msg.value >= fee, "Insufficient fee");
        if (fee > 0 && feeCollector != address(0)) {
            (bool sent,) = feeCollector.call{value: fee}("");
            require(sent, "Fee transfer failed");
        }
        
        return fee;
    }
    
    function _packData(uint256 timestamp, uint128 serverId, bool hasDocument) private pure returns (uint256) {
        return (timestamp << 192) | (uint256(serverId) << 64) | (hasDocument ? 1 : 0);
    }
    
    function _mintNotice(uint256 noticeId, address recipient, string memory metadataURI) private {
        _safeMint(recipient, noticeId);
        
        // Use IPFS URI if provided, otherwise generate on-chain URI
        if (bytes(metadataURI).length > 0) {
            _setTokenURI(noticeId, metadataURI);
        } else {
            _setTokenURI(noticeId, _generateTokenURI(noticeId));
        }
    }
    
    function _updateServerStats(address server) private {
        if (processServers[server].serverId > 0) {
            processServers[server].noticesServed++;
        }
    }
    
    function _generateTokenURI(uint256 noticeId) private view returns (string memory) {
        Notice storage notice = notices[noticeId];
        bool hasDocument = (notice.packedData & 1) == 1;
        
        string memory desc = hasDocument ? 
            string(abi.encodePacked("LEGAL NOTICE - ACTION REQUIRED | View at: https://nftserviceapp.netlify.app/#notice-", noticeId.toString())) :
            string(abi.encodePacked("LEGAL NOTICE - ", notice.publicText));
            
        return string(abi.encodePacked(
            'data:application/json,{"name":"',
            notice.tokenName,
            '","description":"',
            desc,
            '"}'
        ));
    }
    
    function _createBatchNotice(BatchRequest calldata req, uint256 index) private returns (uint256) {
        require(req.recipients[index] != address(0), "Invalid recipient");
        
        uint256 noticeId = _noticeIdCounter++;
        
        notices[noticeId] = Notice({
            recipient: req.recipients[index],
            sender: msg.sender,
            documentData: req.documentData,
            publicText: req.publicText,
            metadata: req.metadata,
            packedData: _packData(block.timestamp, processServers[msg.sender].serverId, req.hasDocument),
            tokenName: string(abi.encodePacked(req.tokenNamePrefix, " #", (index + 1).toString())),
            metadataURI: req.metadataURIs.length > 0 ? req.metadataURIs[index] : ""
        });
        
        recipientNotices[req.recipients[index]].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
        
        string memory metadataURI = req.metadataURIs.length > 0 ? req.metadataURIs[index] : "";
        _mintNotice(noticeId, req.recipients[index], metadataURI);
        
        _updateServerStats(msg.sender);
        emit NoticeCreated(noticeId, req.recipients[index], msg.sender);
        
        return noticeId;
    }
    
    function _processBatchPayments(uint256 totalFee, bool sponsorFees, address[] calldata recipients) private {
        if (totalFee > 0 && feeCollector != address(0)) {
            (bool sent,) = feeCollector.call{value: totalFee}("");
            require(sent, "Fee transfer failed");
        }
        
        // Return excess payment
        if (msg.value > totalFee) {
            (bool refunded,) = msg.sender.call{value: msg.value - totalFee}("");
            require(refunded, "Refund failed");
        }
    }
    
    function _calculateBatchFee(address user, uint256 count, bool hasDocument) private view returns (uint256) {
        uint256 individualFee;
        if (lawEnforcementExemptions[user]) {
            individualFee = uint256(creationFee) + uint256(sponsorshipFee);
        } else {
            individualFee = uint256(hasDocument ? serviceFee : textOnlyFee) + uint256(creationFee) + uint256(sponsorshipFee);
        }
        return individualFee * count;
    }
    
    // Required overrides
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}