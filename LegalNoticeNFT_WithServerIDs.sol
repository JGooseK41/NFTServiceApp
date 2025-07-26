// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LegalNoticeNFT_WithServerIDs is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    
    Counters.Counter private _tokenIdCounter;
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
    mapping(uint256 => uint256) public tokenToServerId; // Maps token ID to server ID who created it
    
    // Fee structure
    uint256 public serviceFee = 50e6; // 50 TRX
    uint256 public creationFee = 5e6; // 5 TRX for process servers
    uint256 public sponsorshipFee = 100e6; // 100 TRX for sponsorship
    address public feeCollector;
    
    // Enhanced notice structure
    struct LegalNotice {
        uint256 id;
        address recipient;
        string noticeType;
        string referenceNumber;
        string responseDeadline;
        uint256 timestamp;
        bool accepted;
        uint256 acceptedTimestamp;
        address processServer;
        uint256 serverId; // Added server ID
        string serverName; // Added server name for easy access
        string issuingAgency;
        string tokenName;
    }
    
    mapping(uint256 => LegalNotice) public legalNotices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public serverNotices;
    
    // Events
    event ProcessServerRegistered(address indexed server, uint256 indexed serverId, string name, string agency);
    event ProcessServerUpdated(address indexed server, uint256 indexed serverId, string name, string agency);
    event NoticeCreated(uint256 indexed tokenId, address indexed recipient, address indexed processServer, uint256 serverId, string tokenName);
    event NoticeAccepted(uint256 indexed tokenId, address indexed recipient, uint256 timestamp);
    event FeeUpdated(string feeType, uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    
    constructor() ERC721("Legal Notice NFT", "NOTICE") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        feeCollector = msg.sender;
        _serverIdCounter.increment(); // Start server IDs at 1
    }
    
    // Override grantRole to auto-assign server IDs
    function grantRole(bytes32 role, address account) public override {
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
        require(hasRole(PROCESS_SERVER_ROLE, msg.sender), "Must be a process server");
        
        ProcessServer storage server = processServers[msg.sender];
        require(server.serverId > 0, "Server not initialized");
        
        server.name = name;
        server.agency = agency;
        
        emit ProcessServerUpdated(msg.sender, server.serverId, name, agency);
    }
    
    // Create a legal notice with server ID in token name
    function createLegalNotice(
        address recipient,
        string memory uri,
        string memory noticeType,
        string memory referenceNumber,
        string memory responseDeadline,
        string memory issuingAgency,
        string memory tokenName
    ) public payable nonReentrant returns (uint256) {
        ProcessServer storage server = processServers[msg.sender];
        uint256 requiredFee;
        
        if (hasRole(PROCESS_SERVER_ROLE, msg.sender)) {
            requiredFee = creationFee;
            require(server.serverId > 0, "Process server not properly registered");
        } else {
            requiredFee = serviceFee;
        }
        
        require(msg.value >= requiredFee, "Insufficient fee");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        // Prepend server ID to token name
        string memory finalTokenName;
        if (server.serverId > 0) {
            finalTokenName = string(abi.encodePacked("PS#", uint2str(server.serverId), "-", tokenName));
            server.noticesServed++;
        } else {
            finalTokenName = string(abi.encodePacked("USR-", tokenName));
        }
        
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);
        
        // Store enhanced notice data
        legalNotices[tokenId] = LegalNotice({
            id: tokenId,
            recipient: recipient,
            noticeType: noticeType,
            referenceNumber: referenceNumber,
            responseDeadline: responseDeadline,
            timestamp: block.timestamp,
            accepted: false,
            acceptedTimestamp: 0,
            processServer: msg.sender,
            serverId: server.serverId,
            serverName: server.name,
            issuingAgency: issuingAgency,
            tokenName: finalTokenName
        });
        
        recipientNotices[recipient].push(tokenId);
        serverNotices[msg.sender].push(tokenId);
        tokenToServerId[tokenId] = server.serverId;
        
        // Transfer fee
        if (msg.value > 0) {
            (bool success, ) = payable(feeCollector).call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }
        
        emit NoticeCreated(tokenId, recipient, msg.sender, server.serverId, finalTokenName);
        return tokenId;
    }
    
    // Accept notice
    function acceptNotice(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "Not the notice recipient");
        require(!legalNotices[tokenId].accepted, "Notice already accepted");
        
        legalNotices[tokenId].accepted = true;
        legalNotices[tokenId].acceptedTimestamp = block.timestamp;
        
        emit NoticeAccepted(tokenId, msg.sender, block.timestamp);
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
    
    // Helper function to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
    
    // Update fees (admin only)
    function updateServiceFee(uint256 newFee) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Admin only");
        uint256 oldFee = serviceFee;
        serviceFee = newFee;
        emit FeeUpdated("service", oldFee, newFee);
    }
    
    function updateCreationFee(uint256 newFee) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Admin only");
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit FeeUpdated("creation", oldFee, newFee);
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