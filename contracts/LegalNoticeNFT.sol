// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LegalNoticeNFT
 * @dev Optimized NFT contract for legal document service with reduced gas costs
 */
contract LegalNoticeNFT is ERC721, AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SERVER_ROLE = keccak256("SERVER_ROLE");
    
    // Counters for token IDs
    Counters.Counter private _noticeIdCounter;
    Counters.Counter private _alertIdCounter;
    
    // Fee management
    uint256 public creationFee;
    address payable public feeCollector;
    mapping(address => bool) public feeExemptions;
    
    // Resource sponsorship
    bool public resourceSponsorshipEnabled;
    
    // Optimized storage using packed structs
    struct Notice {
        address recipient;      // 20 bytes
        address server;        // 20 bytes
        uint128 timestamp;     // 16 bytes (enough until year 10,889)
        uint64 caseNumberHash; // 8 bytes (hash of case number to save space)
        uint32 alertTokenId;   // 4 bytes (supports 4 billion alerts)
        uint16 jurisdictionIndex; // 2 bytes (supports 65k jurisdictions)
        uint8 documentType;    // 1 byte (supports 256 types)
        uint8 status;          // 1 byte (0: pending, 1: accepted)
        // Total: 72 bytes (fits in 3 storage slots)
    }
    
    // Separate storage for variable-length data
    mapping(uint256 => string) private _noticeIPFSHashes;
    mapping(uint256 => bytes32) private _noticeContentHashes;
    
    // Alert tokens - minimal storage
    struct Alert {
        address owner;
        uint256 noticeId;
    }
    
    mapping(uint256 => Alert) public alerts;
    mapping(uint256 => string) private _alertPreviews;
    
    // User mappings for quick lookups
    mapping(address => uint256[]) private _userNotices;
    mapping(address => uint256[]) private _userAlerts;
    
    // Notices storage
    mapping(uint256 => Notice) public notices;
    
    // Events
    event LegalNoticeCreated(
        uint256 indexed noticeId,
        uint256 indexed alertId,
        address indexed recipient,
        address server,
        uint8 documentType
    );
    
    event NoticeAccepted(uint256 indexed noticeId, uint256 timestamp);
    event FeeUpdated(uint256 newFee);
    event FeeCollectorUpdated(address newCollector);
    event ResourceSponsorshipUpdated(bool enabled);
    
    constructor(address payable _feeCollector) ERC721("LegalNotice", "LEGAL") {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
        creationFee = 10 * 10**6; // 10 TRX in SUN (TRON's smallest unit)
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a legal notice NFT with optimized storage
     */
    function createLegalNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewImage,
        bytes32 contentHash,
        string calldata caseNumber,
        uint16 jurisdictionIndex,
        uint8 documentType
    ) external payable nonReentrant returns (uint256 noticeId, uint256 alertId) {
        // Check authorization
        require(
            hasRole(SERVER_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        
        // Check fee
        if (!feeExemptions[msg.sender]) {
            require(msg.value >= creationFee, "Insufficient fee");
            
            // Transfer fee to collector
            (bool success, ) = feeCollector.call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }
        
        // Increment counters
        _noticeIdCounter.increment();
        _alertIdCounter.increment();
        noticeId = _noticeIdCounter.current();
        alertId = _alertIdCounter.current();
        
        // Create notice with packed struct
        notices[noticeId] = Notice({
            recipient: recipient,
            server: msg.sender,
            timestamp: uint128(block.timestamp),
            caseNumberHash: uint64(uint256(keccak256(bytes(caseNumber)))),
            alertTokenId: uint32(alertId),
            jurisdictionIndex: jurisdictionIndex,
            documentType: documentType,
            status: 0 // pending
        });
        
        // Store variable-length data separately
        _noticeIPFSHashes[noticeId] = ipfsHash;
        _noticeContentHashes[noticeId] = contentHash;
        
        // Create alert token
        alerts[alertId] = Alert({
            owner: recipient,
            noticeId: noticeId
        });
        _alertPreviews[alertId] = previewImage;
        
        // Update user mappings
        _userNotices[msg.sender].push(noticeId);
        _userAlerts[recipient].push(alertId);
        
        // Mint NFTs
        _safeMint(msg.sender, noticeId);
        
        emit LegalNoticeCreated(noticeId, alertId, recipient, msg.sender, documentType);
    }
    
    /**
     * @dev Accept a notice (recipient acknowledges receipt)
     */
    function acceptNotice(uint256 tokenId) external {
        Notice storage notice = notices[tokenId];
        require(notice.recipient == msg.sender, "Not the recipient");
        require(notice.status == 0, "Already accepted");
        
        notice.status = 1;
        
        emit NoticeAccepted(tokenId, block.timestamp);
    }
    
    /**
     * @dev Get notice IPFS hash
     */
    function getNoticeIPFS(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Notice does not exist");
        return _noticeIPFSHashes[tokenId];
    }
    
    /**
     * @dev Get notice content hash
     */
    function getNoticeContentHash(uint256 tokenId) external view returns (bytes32) {
        require(_exists(tokenId), "Notice does not exist");
        return _noticeContentHashes[tokenId];
    }
    
    /**
     * @dev Get alert preview image
     */
    function getAlertPreview(uint256 alertId) external view returns (string memory) {
        require(alerts[alertId].owner != address(0), "Alert does not exist");
        return _alertPreviews[alertId];
    }
    
    /**
     * @dev Get user's notices
     */
    function getUserNotices(address user) external view returns (uint256[] memory) {
        return _userNotices[user];
    }
    
    /**
     * @dev Get user's alerts
     */
    function getUserAlerts(address user) external view returns (uint256[] memory) {
        return _userAlerts[user];
    }
    
    /**
     * @dev Update creation fee (admin only)
     */
    function updateFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        creationFee = newFee;
        emit FeeUpdated(newFee);
    }
    
    /**
     * @dev Update fee collector (admin only)
     */
    function updateFeeCollector(address payable newCollector) external onlyRole(ADMIN_ROLE) {
        require(newCollector != address(0), "Invalid collector");
        feeCollector = newCollector;
        emit FeeCollectorUpdated(newCollector);
    }
    
    /**
     * @dev Set fee exemption for an address
     */
    function setFeeExemption(address user, bool exempt) external onlyRole(ADMIN_ROLE) {
        feeExemptions[user] = exempt;
    }
    
    /**
     * @dev Enable/disable resource sponsorship (TRON specific)
     */
    function setResourceSponsorship(bool enabled) external onlyRole(ADMIN_ROLE) {
        resourceSponsorshipEnabled = enabled;
        emit ResourceSponsorshipUpdated(enabled);
    }
    
    /**
     * @dev Deposit TRX for resource sponsorship
     */
    function depositForFees() external payable {
        // Funds stay in contract for sponsorship
    }
    
    /**
     * @dev Withdraw TRX from contract (admin only)
     */
    function withdrawTRX(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Override tokenURI to return IPFS metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        string memory ipfsHash = _noticeIPFSHashes[tokenId];
        return string(abi.encodePacked("ipfs://", ipfsHash, "/metadata.json"));
    }
    
    /**
     * @dev Required overrides for AccessControl
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}