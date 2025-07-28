// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract LegalNoticeNFT_Enhanced is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    
    Counters.Counter private _noticeIdCounter;
    Counters.Counter private _serverIdCounter;
    
    // Process Server Management
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
    
    // Simplified notice structure
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
    
    // Batch notice parameters
    struct BatchNoticeParams {
        string publicText;
        string encryptedIPFS;
        string encryptionKey;
        string noticeType;
        string caseNumber;
        string issuingAgency;
        string tokenNamePrefix;
        bool hasDocument;
        bool sponsorFees;
    }
    
    // Storage
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public senderNotices;
    
    // Fee structure
    uint256 public serviceFee = 20000000;      // 20 TRX
    uint256 public textOnlyFee = 15000000;     // 15 TRX
    uint256 public creationFee = 10000000;     // 10 TRX (operations)
    uint256 public sponsorshipFee = 2000000;   // 2 TRX (recipient support)
    
    // Fee exemptions
    mapping(address => bool) public lawEnforcementExemptions;
    mapping(address => string) public lawEnforcementAgencies;
    
    address public feeCollector;
    bool public paused = false;
    
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
    event ProcessServerStatusChanged(address indexed server, bool active);
    event FeeUpdated(string feeType, uint256 oldFee, uint256 newFee);
    event ContractPaused(bool paused);
    event Withdrawal(address indexed to, uint256 amount);
    event FeesSponsored(address indexed recipient, uint256 amount);
    
    // Modifiers
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            hasRole(PROCESS_SERVER_ROLE, msg.sender) || 
            hasRole(ADMIN_ROLE, msg.sender) ||
            lawEnforcementExemptions[msg.sender],
            "Unauthorized: Must be approved user"
        );
        _;
    }
    
    constructor() ERC721("Legal Notice NFT", "NOTICE") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        feeCollector = msg.sender;
        _noticeIdCounter.increment();
        _serverIdCounter.increment();
    }
    
    // Override grantRole to auto-assign server IDs
    function grantRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        super.grantRole(role, account);
        
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
    
    // Calculate fee based on user exemptions
    function calculateFee(address user) public view returns (uint256) {
        if (lawEnforcementExemptions[user]) {
            return creationFee + sponsorshipFee;
        }
        return serviceFee + creationFee + sponsorshipFee;
    }
    
    // Create document notice - RESTRICTED
    function createDocumentNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory encryptionKey,
        string memory publicText,
        string memory noticeType,
        string memory caseNumber,
        string memory issuingAgency,
        string memory baseTokenName
    ) external payable nonReentrant whenNotPaused onlyAuthorized returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(publicText).length > 0, "Invalid text");
        require(bytes(encryptedIPFS).length > 0, "Invalid IPFS");
        
        uint256 fee = calculateFee(msg.sender);
        require(msg.value >= fee, "Insufficient fee");
        
        uint256 noticeId = _noticeIdCounter.current();
        _noticeIdCounter.increment();
        
        ProcessServer storage server = processServers[msg.sender];
        
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
            hasDocument: true,
            serverId: server.serverId,
            tokenName: tokenName
        });
        
        recipientNotices[recipient].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
        
        _safeMint(recipient, noticeId);
        _setTokenURI(noticeId, generateEnhancedTokenURI(noticeId));
        
        if (server.serverId > 0) server.noticesServed++;
        
        (bool success, ) = payable(feeCollector).call{value: fee}("");
        require(success, "Fee transfer failed");
        
        if (msg.value > fee) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(refunded, "Refund failed");
        }
        
        emit NoticeCreated(noticeId, recipient, msg.sender, true, block.timestamp, server.serverId, tokenName);
        
        return noticeId;
    }
    
    // Create text notice - RESTRICTED
    function createTextNotice(
        address recipient,
        string memory publicText,
        string memory noticeType,
        string memory caseNumber,
        string memory issuingAgency,
        string memory baseTokenName
    ) external payable nonReentrant whenNotPaused onlyAuthorized returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(publicText).length > 0, "Invalid text");
        
        uint256 fee = lawEnforcementExemptions[msg.sender] ? 5000000 : textOnlyFee;
        require(msg.value >= fee, "Insufficient fee");
        
        uint256 noticeId = _noticeIdCounter.current();
        _noticeIdCounter.increment();
        
        ProcessServer storage server = processServers[msg.sender];
        
        string memory tokenName = string(abi.encodePacked(baseTokenName, " #", noticeId.toString()));
        
        notices[noticeId] = Notice({
            recipient: recipient,
            sender: msg.sender,
            encryptedIPFS: "",
            encryptionKey: "",
            publicText: publicText,
            noticeType: noticeType,
            caseNumber: caseNumber,
            issuingAgency: issuingAgency,
            timestamp: block.timestamp,
            accepted: false,
            hasDocument: false,
            serverId: server.serverId,
            tokenName: tokenName
        });
        
        recipientNotices[recipient].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
        
        _safeMint(recipient, noticeId);
        _setTokenURI(noticeId, generateEnhancedTokenURI(noticeId));
        
        if (server.serverId > 0) server.noticesServed++;
        
        (bool success, ) = payable(feeCollector).call{value: fee}("");
        require(success, "Fee transfer failed");
        
        if (msg.value > fee) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(refunded, "Refund failed");
        }
        
        emit NoticeCreated(noticeId, recipient, msg.sender, false, block.timestamp, server.serverId, tokenName);
        
        return noticeId;
    }
    
    // Accept notice
    function acceptNotice(uint256 noticeId) external nonReentrant returns (string memory) {
        require(_exists(noticeId), "Notice does not exist");
        require(ownerOf(noticeId) == msg.sender, "Not the recipient");
        require(!notices[noticeId].accepted, "Already accepted");
        
        notices[noticeId].accepted = true;
        emit NoticeAccepted(noticeId, msg.sender, block.timestamp);
        
        if (notices[noticeId].hasDocument) {
            return notices[noticeId].encryptionKey;
        }
        return "";
    }
    
    // Generate enhanced token URI with full metadata
    function generateEnhancedTokenURI(uint256 noticeId) private view returns (string memory) {
        Notice memory notice = notices[noticeId];
        
        // Build metadata in parts to avoid stack issues
        string memory part1 = string(abi.encodePacked(
            '{"name":"', notice.tokenName, '",',
            '"description":"LEGAL NOTICE - ', notice.noticeType,
            ' | Case: ', notice.caseNumber
        ));
        
        string memory part2;
        if (notice.hasDocument) {
            part2 = string(abi.encodePacked(
                ' | ACTION REQUIRED: ', notice.publicText,
                ' | TO VIEW DOCUMENTS: Call acceptNotice(', noticeId.toString(), ') on this contract",'
            ));
        } else {
            part2 = string(abi.encodePacked(
                ' | ', notice.publicText,
                ' | Issued by: ', notice.issuingAgency, '",'
            ));
        }
        
        string memory part3 = string(abi.encodePacked(
            '"attributes":[',
            '{"trait_type":"Type","value":"', notice.noticeType, '"},',
            '{"trait_type":"Case","value":"', notice.caseNumber, '"},',
            '{"trait_type":"Agency","value":"', notice.issuingAgency, '"}]}'
        ));
        
        return string(abi.encodePacked(
            'data:application/json;charset=UTF-8,',
            part1, part2, part3
        ));
    }
    
    // Get notice info
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
    
    // Get document
    function getDocument(uint256 noticeId) external view returns (string memory, string memory) {
        require(_exists(noticeId), "Notice does not exist");
        require(
            ownerOf(noticeId) == msg.sender || 
            notices[noticeId].sender == msg.sender ||
            hasRole(ADMIN_ROLE, msg.sender),
            "Unauthorized"
        );
        return (notices[noticeId].encryptedIPFS, notices[noticeId].encryptionKey);
    }
    
    // Get notices
    function getRecipientNotices(address recipient) external view returns (uint256[] memory) {
        return recipientNotices[recipient];
    }
    
    function getSenderNotices(address sender) external view returns (uint256[] memory) {
        return senderNotices[sender];
    }
    
    // Total notices
    function totalNotices() external view returns (uint256) {
        return _noticeIdCounter.current() > 0 ? _noticeIdCounter.current() - 1 : 0;
    }
    
    // Process server info
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
    
    // Admin functions
    function setLawEnforcementExemption(address user, string memory agencyName) external onlyRole(ADMIN_ROLE) {
        require(bytes(agencyName).length > 0, "Agency name required");
        lawEnforcementExemptions[user] = true;
        lawEnforcementAgencies[user] = agencyName;
    }
    
    function removeLawEnforcementExemption(address user) external onlyRole(ADMIN_ROLE) {
        lawEnforcementExemptions[user] = false;
        delete lawEnforcementAgencies[user];
    }
    
    function updateFees(uint256 _serviceFee, uint256 _textFee, uint256 _creationFee, uint256 _sponsorshipFee) external onlyRole(ADMIN_ROLE) {
        serviceFee = _serviceFee;
        textOnlyFee = _textFee;
        creationFee = _creationFee;
        sponsorshipFee = _sponsorshipFee;
    }
    
    function updateFeeCollector(address newCollector) external onlyRole(ADMIN_ROLE) {
        require(newCollector != address(0), "Invalid address");
        feeCollector = newCollector;
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