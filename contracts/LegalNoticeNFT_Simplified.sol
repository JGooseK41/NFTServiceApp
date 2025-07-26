// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LegalNoticeNFT_Simplified is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    
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
        string encryptedIPFS;      // Encrypted document on IPFS
        string encryptionKey;      // Simple encryption key (stored directly)
        string publicText;         // Public notice text
        string noticeType;
        string caseNumber;
        string issuingAgency;
        uint256 timestamp;
        bool accepted;             // Has recipient accepted
        bool hasDocument;          // true = Document Images, false = Text Only
        uint256 serverId;          // Process server ID who created this
        string tokenName;          // Name with prepended server ID
    }
    
    // Storage
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public senderNotices;
    
    // Fee structure - consolidated
    uint256 public serviceFee = 150e6;         // 150 TRX for Document Images
    uint256 public textOnlyFee = 15e6;         // 15 TRX for Text Only
    uint256 public creationFee = 75e6;         // 75 TRX for process servers
    uint256 public sponsorshipFee = 2e6;       // 2 TRX for sponsoring recipient
    address public feeCollector;
    
    // Law enforcement exemptions (cost-only pricing)
    mapping(address => bool) public lawEnforcementExemptions;
    mapping(address => string) public lawEnforcementAgencies;
    
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
    
    event ProcessServerRegistered(address indexed server, uint256 indexed serverId, string name, string agency);
    event ProcessServerUpdated(address indexed server, uint256 indexed serverId, string name, string agency);
    
    event NoticeAccepted(
        uint256 indexed noticeId,
        address indexed recipient,
        uint256 timestamp
    );
    
    // Admin events
    event FeeUpdated(string feeType, uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FeeExemptionSet(address indexed user, bool serviceFeeExempt, bool fullFeeExempt);
    event ProcessServerStatusChanged(address indexed server, bool active);
    event ContractPaused(bool paused);
    event Withdrawal(address indexed to, uint256 amount);
    event FeesSponsored(address indexed recipient, uint256 amount);
    
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
            _serverIdCounter.increment();
            
            processServers[account] = ProcessServer({
                serverId: newServerId,
                name: "",
                agency: "",
                registeredDate: block.timestamp,
                noticesServed: 0,
                active: true
            });
            
            serverIdToAddress[newServerId] = account;
            emit ProcessServerRegistered(account, newServerId, "", "");
        }
    }
    
    // Register or update process server details
    function registerProcessServer(string memory name, string memory agency) external {
        require(hasRole(PROCESS_SERVER_ROLE, msg.sender), "Not server");
        require(bytes(name).length > 0, "Invalid name");
        require(bytes(agency).length > 0, "Invalid agency");
        
        ProcessServer storage server = processServers[msg.sender];
        require(server.serverId > 0, "Not init");
        
        server.name = name;
        server.agency = agency;
        
        emit ProcessServerUpdated(msg.sender, server.serverId, name, agency);
    }
    
    
    // Create notice with encrypted document (Document Images)
    function createDocumentNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory encryptionKey,
        string memory publicText,
        string memory noticeType,
        string memory caseNumber,
        string memory issuingAgency,
        string memory baseTokenName
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        // Input validation
        require(recipient != address(0), "Invalid recipient");
        require(bytes(publicText).length > 0, "Invalid text");
        require(bytes(encryptedIPFS).length > 0, "Invalid IPFS");
        require(bytes(noticeType).length > 0, "Invalid type");
        require(bytes(caseNumber).length > 0, "Invalid case");
        
        // Calculate fee based on user type
        uint256 requiredFee;
        
        if (lawEnforcementExemptions[msg.sender]) {
            // Law enforcement pays only actual costs (no profit)
            // They still pay sponsorship for recipient
            requiredFee = sponsorshipFee;  // 2 TRX for recipient support only
        } else if (hasRole(PROCESS_SERVER_ROLE, msg.sender)) {
            // Process servers pay creation fee + sponsorship
            requiredFee = creationFee + sponsorshipFee;
        } else {
            // Regular users pay full service fee + sponsorship
            requiredFee = serviceFee + sponsorshipFee;
        }
        
        require(msg.value >= requiredFee, "Fee");
        
        // Create notice
        uint256 noticeId = _noticeIdCounter.current();
        _noticeIdCounter.increment();
        
        // Get server info and create token name
        ProcessServer storage server = processServers[msg.sender];
        string memory finalTokenName;
        uint256 serverId = 0;
        
        if (server.serverId > 0) {
            serverId = server.serverId;
            finalTokenName = string(abi.encodePacked("PS#", Strings.toString(serverId), "-", baseTokenName));
            server.noticesServed++;
        } else {
            finalTokenName = string(abi.encodePacked("USR-", baseTokenName));
        }
        
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
            serverId: serverId,
            tokenName: finalTokenName
        });
        
        // Track notices
        recipientNotices[recipient].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
        
        // Mint NFT to recipient
        _safeMint(recipient, noticeId);
        
        emit NoticeCreated(noticeId, recipient, msg.sender, true, block.timestamp, serverId, finalTokenName);
        
        // Transfer fee (moved after state changes)
        if (msg.value > 0) {
            (bool success, ) = payable(feeCollector).call{value: msg.value}("");
            require(success, "Fee failed");
        }
        
        return noticeId;
    }
    
    // Create text-only notice (no document, no acceptance required)
    function createTextNotice(
        address recipient,
        string memory publicText,
        string memory noticeType,
        string memory caseNumber,
        string memory issuingAgency,
        string memory baseTokenName
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        // Input validation
        require(recipient != address(0), "Invalid recipient");
        require(bytes(publicText).length > 0, "Invalid text");
        require(bytes(noticeType).length > 0, "Invalid type");
        require(bytes(caseNumber).length > 0, "Invalid case");
        
        // Calculate fee based on user type
        uint256 requiredFee;
        
        if (lawEnforcementExemptions[msg.sender]) {
            // Law enforcement pays only sponsorship (no profit on text notices)
            requiredFee = sponsorshipFee;
        } else {
            // Everyone else pays text fee + sponsorship
            requiredFee = textOnlyFee + sponsorshipFee;
        }
        
        require(msg.value >= requiredFee, "Fee");
        
        uint256 noticeId = _noticeIdCounter.current();
        _noticeIdCounter.increment();
        
        // Get server info and create token name
        ProcessServer storage server = processServers[msg.sender];
        string memory finalTokenName;
        uint256 serverId = 0;
        
        if (server.serverId > 0) {
            serverId = server.serverId;
            finalTokenName = string(abi.encodePacked("PS#", Strings.toString(serverId), "-", baseTokenName));
            server.noticesServed++;
        } else {
            finalTokenName = string(abi.encodePacked("USR-", baseTokenName));
        }
        
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
            accepted: false, // Not required for text-only
            hasDocument: false,
            serverId: serverId,
            tokenName: finalTokenName
        });
        
        recipientNotices[recipient].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
        
        // Mint NFT to recipient
        _safeMint(recipient, noticeId);
        
        emit NoticeCreated(noticeId, recipient, msg.sender, false, block.timestamp, serverId, finalTokenName);
        
        // Transfer fee (moved after state changes)
        if (msg.value > 0) {
            (bool success, ) = payable(feeCollector).call{value: msg.value}("");
            require(success, "Fee failed");
        }
        
        return noticeId;
    }
    
    // Accept notice and get decryption key (one-click process)
    function acceptNotice(uint256 noticeId) external returns (string memory decryptionKey) {
        Notice storage notice = notices[noticeId];
        
        require(notice.recipient == msg.sender, "Not the recipient");
        require(notice.hasDocument, "Text only");
        require(!notice.accepted, "Already accepted");
        
        // Mark as accepted
        notice.accepted = true;
        
        emit NoticeAccepted(noticeId, msg.sender, block.timestamp);
        
        // Return decryption key immediately
        return notice.encryptionKey;
    }
    
    // View notice details (public info only)
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
    
    
    // Get document details (only for recipient after acceptance)
    function getDocument(uint256 noticeId) external view returns (
        string memory encryptedIPFS,
        string memory decryptionKey
    ) {
        Notice memory notice = notices[noticeId];
        
        require(notice.recipient == msg.sender, "Not recipient");
        require(notice.hasDocument, "No doc");
        require(notice.accepted, "Not accepted");
        
        return (notice.encryptedIPFS, notice.encryptionKey);
    }
    
    // Get recipient's notices
    function getRecipientNotices(address recipient) external view returns (uint256[] memory) {
        return recipientNotices[recipient];
    }
    
    
    // Get sender's notices
    function getSenderNotices(address sender) external view returns (uint256[] memory) {
        return senderNotices[sender];
    }
    
    // Get process server info
    function getProcessServerInfo(address serverAddress) public view returns (
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
    
    // Get server info by ID
    function getServerById(uint256 serverId) public view returns (
        address serverAddress,
        string memory name,
        string memory agency,
        uint256 noticesServed
    ) {
        address addr = serverIdToAddress[serverId];
        ProcessServer memory server = processServers[addr];
        return (addr, server.name, server.agency, server.noticesServed);
    }
    
    // Get total number of notices created
    function totalNotices() external view returns (uint256) {
        return _noticeIdCounter.current() > 0 ? _noticeIdCounter.current() - 1 : 0;
    }
    
    
    // Admin functions - combined fee updates
    function updateFees(uint256 _serviceFee, uint256 _textFee, uint256 _creationFee, uint256 _sponsorshipFee) external onlyRole(ADMIN_ROLE) {
        if (_serviceFee > 0) {
            emit FeeUpdated("serviceFee", serviceFee, _serviceFee);
            serviceFee = _serviceFee;
        }
        if (_textFee > 0) {
            emit FeeUpdated("textOnlyFee", textOnlyFee, _textFee);
            textOnlyFee = _textFee;
        }
        if (_creationFee > 0) {
            emit FeeUpdated("creationFee", creationFee, _creationFee);
            creationFee = _creationFee;
        }
        if (_sponsorshipFee > 0) {
            emit FeeUpdated("sponsorshipFee", sponsorshipFee, _sponsorshipFee);
            sponsorshipFee = _sponsorshipFee;
        }
    }
    
    function updateFeeCollector(address newCollector) external onlyRole(ADMIN_ROLE) {
        require(newCollector != address(0), "Invalid");
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }
    
    // Fee calculation for compatibility  
    function calculateFee(address user) public view returns (uint256) {
        if (lawEnforcementExemptions[user]) return 0;
        if (hasRole(PROCESS_SERVER_ROLE, user)) return creationFee;
        return serviceFee;
    }
    
    // Set law enforcement exemption (new method)
    function setLawEnforcementExemption(address user, string memory agencyName) external onlyRole(ADMIN_ROLE) {
        require(bytes(agencyName).length > 0, "Agency name required");
        lawEnforcementExemptions[user] = true;
        lawEnforcementAgencies[user] = agencyName;
        emit FeeExemptionSet(user, true, true);
    }
    
    function removeLawEnforcementExemption(address user) external onlyRole(ADMIN_ROLE) {
        lawEnforcementExemptions[user] = false;
        delete lawEnforcementAgencies[user];
        emit FeeExemptionSet(user, false, false);
    }
    
    // Withdraw function
    function withdrawTRX(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = payable(feeCollector).call{value: amount}("");
        require(success, "Withdrawal failed");
        emit Withdrawal(feeCollector, amount);
    }
    
    // Process server management
    function setProcessServerStatus(address server, bool active) external onlyRole(ADMIN_ROLE) {
        require(processServers[server].serverId > 0, "Not registered");
        processServers[server].active = active;
        emit ProcessServerStatusChanged(server, active);
    }
    
    
    // Batch create notices
    function createBatchNotices(
        address[] calldata recipients,
        string calldata publicText,
        string calldata encryptedIPFS,
        string calldata encryptionKey,
        string calldata noticeType,
        string calldata caseNumber,
        string calldata issuingAgency,
        string calldata tokenNamePrefix,
        bool hasDocument,
        bool sponsorFees
    ) external payable whenNotPaused returns (uint256[] memory) {
        require(recipients.length > 0 && recipients.length <= 20, "Invalid batch");
        if (hasDocument) require(bytes(encryptedIPFS).length > 0, "Empty IPFS");
        
        uint256[] memory noticeIds = new uint256[](recipients.length);
        uint256 individualFee = calculateFee(msg.sender);
        uint256 totalFee = individualFee * recipients.length;
        
        if (sponsorFees) totalFee += sponsorshipFee * recipients.length;
        require(msg.value >= totalFee, "Insufficient fee");
        
        ProcessServer storage server = processServers[msg.sender];
        require(server.active || hasRole(PROCESS_SERVER_ROLE, msg.sender), "Not authorized");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            
            uint256 noticeId = _noticeIdCounter.current();
            _noticeIdCounter.increment();
            
            notices[noticeId] = Notice({
                recipient: recipients[i],
                sender: msg.sender,
                encryptedIPFS: hasDocument ? encryptedIPFS : "",
                encryptionKey: hasDocument ? encryptionKey : "",
                publicText: hasDocument ? "" : publicText,
                noticeType: noticeType,
                caseNumber: caseNumber,
                issuingAgency: issuingAgency,
                timestamp: block.timestamp,
                accepted: false,
                hasDocument: hasDocument,
                serverId: server.serverId,
                tokenName: string(abi.encodePacked(tokenNamePrefix, " #", Strings.toString(i + 1)))
            });
            
            recipientNotices[recipients[i]].push(noticeId);
            senderNotices[msg.sender].push(noticeId);
            _safeMint(recipients[i], noticeId);
            
            if (server.serverId > 0) server.noticesServed++;
            
            if (sponsorFees) {
                (bool sent, ) = payable(recipients[i]).call{value: sponsorshipFee}("");
                if (sent) emit FeesSponsored(recipients[i], sponsorshipFee);
            }
            
            emit NoticeCreated(noticeId, recipients[i], msg.sender, hasDocument, block.timestamp, server.serverId, notices[noticeId].tokenName);
            noticeIds[i] = noticeId;
        }
        
        if (totalFee > 0) {
            uint256 feeAmount = individualFee * recipients.length;
            (bool success, ) = payable(feeCollector).call{value: feeAmount}("");
            require(success, "Fee failed");
        }
        
        if (msg.value > totalFee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - totalFee}("");
            require(success, "Refund failed");
        }
        
        return noticeIds;
    }
    
    
    
    
    
    // Emergency pause (if needed)
    bool public paused = false;
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        paused = true;
        emit ContractPaused(true);
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        paused = false;
        emit ContractPaused(false);
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