// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LegalNoticeNFT_WithIPFS is ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl, ReentrancyGuard {
    using Strings for uint256;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    
    uint256 private _noticeIdCounter = 1;
    uint256 private _serverIdCounter = 1;
    
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
        string metadataURI;    // IPFS URI for NFT metadata
    }
    
    // Updated request struct to include metadata URI
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
        string metadataURI;    // Add IPFS metadata URI
    }
    
    // Storage mappings
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public senderNotices;
    mapping(address => ProcessServer) public processServers;
    mapping(address => bool) public lawEnforcementExemptions;
    
    // Fee configuration
    uint128 public serviceFee = 20e6;      // 20 TRX
    uint128 public textOnlyFee = 10e6;     // 10 TRX
    uint128 public creationFee = 5e6;      // 5 TRX
    uint128 public sponsorshipFee = 0;     // 0 TRX
    address public feeCollector;
    
    // Control flags
    bool public paused;
    bool public emergencyMode;
    
    // Events
    event NoticeCreated(uint256 indexed noticeId, address indexed recipient, address indexed sender);
    event NoticeAccepted(uint256 indexed noticeId, address indexed recipient, uint256 timestamp);
    event ProcessServerRegistered(address indexed server, uint256 serverId, string name);
    event FeesUpdated(uint128 serviceFee, uint128 textOnlyFee, uint128 creationFee);
    
    constructor() ERC721("Legal Notice NFT", "NOTICE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
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
    
    // Create single notice with IPFS metadata
    function createNotice(NoticeRequest calldata req) 
        external payable nonReentrant whenNotPaused onlyAuthorized 
        returns (uint256) 
    {
        require(req.recipient != address(0), "Invalid recipient");
        require(bytes(req.metadataURI).length > 0, "Metadata URI required");
        
        uint256 noticeId = _noticeIdCounter++;
        uint256 fee = _calculateAndChargeFee(msg.sender, req.hasDocument);
        
        // Store notice with metadata URI
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
        
        // Mint with IPFS metadata URI
        _safeMint(req.recipient, noticeId);
        _setTokenURI(noticeId, req.metadataURI);
        
        _updateServerStats(msg.sender);
        emit NoticeCreated(noticeId, req.recipient, msg.sender);
        
        return noticeId;
    }
    
    // Accept notice (unchanged)
    function acceptNotice(uint256 noticeId) external nonReentrant returns (string memory) {
        require(_exists(noticeId), "Notice does not exist");
        require(ownerOf(noticeId) == msg.sender, "Not the recipient");
        
        uint256 packedData = notices[noticeId].packedData;
        require((packedData >> 1) & 1 == 0, "Already accepted");
        
        notices[noticeId].packedData = packedData | 2; // Set accepted flag
        
        emit NoticeAccepted(noticeId, msg.sender, block.timestamp);
        
        // Return decryption key
        string memory documentData = notices[noticeId].documentData;
        (, string memory encryptionKey) = _splitDocumentData(documentData);
        return encryptionKey;
    }
    
    // Helper functions
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
    
    function _updateServerStats(address server) private {
        if (processServers[server].serverId > 0) {
            processServers[server].noticesServed++;
        }
    }
    
    function _splitDocumentData(string memory data) private pure returns (string memory ipfsHash, string memory key) {
        bytes memory dataBytes = bytes(data);
        uint256 separatorIndex = 0;
        
        for (uint256 i = 0; i < dataBytes.length; i++) {
            if (dataBytes[i] == "|") {
                separatorIndex = i;
                break;
            }
        }
        
        bytes memory ipfsBytes = new bytes(separatorIndex);
        bytes memory keyBytes = new bytes(dataBytes.length - separatorIndex - 1);
        
        for (uint256 i = 0; i < separatorIndex; i++) {
            ipfsBytes[i] = dataBytes[i];
        }
        
        for (uint256 i = separatorIndex + 1; i < dataBytes.length; i++) {
            keyBytes[i - separatorIndex - 1] = dataBytes[i];
        }
        
        return (string(ipfsBytes), string(keyBytes));
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
    
    // Admin functions
    function setFees(uint128 _serviceFee, uint128 _textOnlyFee, uint128 _creationFee) external onlyRole(ADMIN_ROLE) {
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
    
    function setLawEnforcementExemption(address user, bool exempt) external onlyRole(ADMIN_ROLE) {
        lawEnforcementExemptions[user] = exempt;
    }
}