// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LegalNoticeNFT_Hybrid is ERC721, ERC721URIStorage, AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    
    Counters.Counter private _noticeIdCounter;
    Counters.Counter private _serverIdCounter;
    
    // ADD THIS: Track total supply for Tronscan
    uint256 public totalNotices;
    
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
    
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public senderNotices;
    mapping(address => bool) public lawEnforcementExempt;
    
    uint256 public constant SERVICE_FEE = 10000000000000000000; // 10 TRX in SUN
    
    event NoticeCreated(uint256 indexed noticeId, address indexed recipient, address indexed sender);
    event NoticeAccepted(uint256 indexed noticeId, address indexed recipient);
    event FeeReceived(address indexed from, uint256 amount);
    event ProcessServerRegistered(address indexed server, uint256 serverId);
    event ProcessServerAssigned(uint256 indexed noticeId, uint256 indexed serverId);
    event LawEnforcementExemptionSet(address indexed account, bool exempt);
    
    constructor() ERC721("Legal Notice NFT", "NOTICE") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _noticeIdCounter.increment(); // Start at 1
    }
    
    // ADD THIS: totalSupply function for Tronscan
    function totalSupply() public view returns (uint256) {
        return totalNotices;
    }