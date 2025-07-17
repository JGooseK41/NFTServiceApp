// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalNoticeNFT for TRON
 * @dev Highly optimized TRC-721 contract for legal document service
 * @notice Gas optimizations for TRON network with minimal storage usage
 */
contract LegalNoticeNFT {
    // TRC-721 Basic Interface
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // Custom Events
    event LegalNoticeCreated(uint256 indexed noticeId, uint256 indexed alertId, address indexed recipient);
    event NoticeAccepted(uint256 indexed noticeId);
    
    // Minimal storage mappings
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Roles stored as simple mappings (cheaper than AccessControl)
    mapping(address => bool) public admins;
    mapping(address => bool) public servers;
    
    // Optimized notice storage (single mapping)
    mapping(uint256 => uint256) private _noticeData; // Packed data
    mapping(uint256 => string) private _ipfsHashes;
    mapping(uint256 => bytes32) private _contentHashes;
    
    // Alert storage
    mapping(uint256 => uint256) private _alertData; // owner + noticeId packed
    mapping(uint256 => string) private _alertPreviews;
    
    // User lookups (using arrays for gas efficiency)
    mapping(address => uint256[]) private _userNotices;
    mapping(address => uint256[]) private _userAlerts;
    
    // Fee management
    uint256 public creationFee = 10_000_000; // 10 TRX in SUN
    address payable public feeCollector;
    mapping(address => bool) public feeExempt;
    
    // Counters
    uint256 private _noticeCounter;
    uint256 private _alertCounter;
    
    // Constants for bit packing
    uint256 constant RECIPIENT_MASK = 0x000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    uint256 constant SERVER_SHIFT = 160;
    uint256 constant TIMESTAMP_SHIFT = 320;
    uint256 constant STATUS_SHIFT = 448;
    uint256 constant DOCTYPE_SHIFT = 456;
    uint256 constant JURISDICTION_SHIFT = 464;
    uint256 constant ALERT_SHIFT = 480;
    
    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }
    
    modifier onlyAuthorized() {
        require(servers[msg.sender] || admins[msg.sender], "Not authorized");
        _;
    }
    
    constructor(address payable _feeCollector) {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
        admins[msg.sender] = true;
    }
    
    /**
     * @dev Create legal notice with maximum gas optimization
     * @notice All data is packed into minimal storage slots
     */
    function createLegalNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewImage,
        bytes32 contentHash,
        string calldata, // caseNumber - only used for hashing
        uint16 jurisdiction,
        uint8 docType
    ) external payable onlyAuthorized returns (uint256 noticeId, uint256 alertId) {
        // Handle fee
        if (!feeExempt[msg.sender] && msg.value > 0) {
            (bool sent,) = feeCollector.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }
        
        // Increment counters
        noticeId = ++_noticeCounter;
        alertId = ++_alertCounter;
        
        // Pack notice data into single uint256
        uint256 packedData = uint256(uint160(recipient));
        packedData |= uint256(uint160(msg.sender)) << SERVER_SHIFT;
        packedData |= uint256(uint128(block.timestamp)) << TIMESTAMP_SHIFT;
        packedData |= uint256(docType) << DOCTYPE_SHIFT;
        packedData |= uint256(jurisdiction) << JURISDICTION_SHIFT;
        packedData |= uint256(alertId) << ALERT_SHIFT;
        
        // Store packed data
        _noticeData[noticeId] = packedData;
        _ipfsHashes[noticeId] = ipfsHash;
        _contentHashes[noticeId] = contentHash;
        
        // Store alert (pack owner and noticeId)
        _alertData[alertId] = uint256(uint160(recipient)) | (noticeId << 160);
        _alertPreviews[alertId] = previewImage;
        
        // Update user arrays
        _userNotices[msg.sender].push(noticeId);
        _userAlerts[recipient].push(alertId);
        
        // Mint NFT to server
        _balances[msg.sender]++;
        _owners[noticeId] = msg.sender;
        
        emit Transfer(address(0), msg.sender, noticeId);
        emit LegalNoticeCreated(noticeId, alertId, recipient);
    }
    
    /**
     * @dev Accept notice - ultra lightweight
     */
    function acceptNotice(uint256 noticeId) external {
        uint256 data = _noticeData[noticeId];
        address recipient = address(uint160(data & RECIPIENT_MASK));
        require(recipient == msg.sender, "Not recipient");
        require((data >> STATUS_SHIFT) & 0xFF == 0, "Already accepted");
        
        // Set status bit to 1
        _noticeData[noticeId] = data | (uint256(1) << STATUS_SHIFT);
        emit NoticeAccepted(noticeId);
    }
    
    /**
     * @dev Get notice details (unpacked)
     */
    function notices(uint256 noticeId) external view returns (
        address recipient,
        address server,
        string memory ipfsHash,
        bytes32 contentHash,
        uint128 timestamp,
        uint64 caseNumberHash,
        uint32 alertTokenId,
        uint16 jurisdictionIndex,
        uint8 documentType,
        uint8 status
    ) {
        uint256 data = _noticeData[noticeId];
        recipient = address(uint160(data & RECIPIENT_MASK));
        server = address(uint160((data >> SERVER_SHIFT) & RECIPIENT_MASK));
        timestamp = uint128((data >> TIMESTAMP_SHIFT) & 0xFFFFFFFFFFFFFFFF);
        status = uint8((data >> STATUS_SHIFT) & 0xFF);
        documentType = uint8((data >> DOCTYPE_SHIFT) & 0xFF);
        jurisdictionIndex = uint16((data >> JURISDICTION_SHIFT) & 0xFFFF);
        alertTokenId = uint32((data >> ALERT_SHIFT) & 0xFFFFFFFF);
        ipfsHash = _ipfsHashes[noticeId];
        contentHash = _contentHashes[noticeId];
        caseNumberHash = 0; // Not stored to save gas
    }
    
    /**
     * @dev Get alert details
     */
    function alerts(uint256 alertId) external view returns (
        address owner,
        uint256 noticeId,
        string memory previewImage
    ) {
        uint256 data = _alertData[alertId];
        owner = address(uint160(data & RECIPIENT_MASK));
        noticeId = data >> 160;
        previewImage = _alertPreviews[alertId];
    }
    
    /**
     * @dev Batch read user notices (gas efficient)
     */
    function getUserNotices(address user) external view returns (uint256[] memory) {
        return _userNotices[user];
    }
    
    /**
     * @dev Batch read user alerts
     */
    function getUserAlerts(address user) external view returns (uint256[] memory) {
        return _userAlerts[user];
    }
    
    // Admin functions
    function grantRole(bytes32 role, address account) external onlyAdmin {
        if (role == keccak256("ADMIN_ROLE")) {
            admins[account] = true;
        } else if (role == keccak256("SERVER_ROLE")) {
            servers[account] = true;
        }
    }
    
    function revokeRole(bytes32 role, address account) external onlyAdmin {
        if (role == keccak256("ADMIN_ROLE")) {
            admins[account] = false;
        } else if (role == keccak256("SERVER_ROLE")) {
            servers[account] = false;
        }
    }
    
    function hasRole(bytes32 role, address account) external view returns (bool) {
        if (role == keccak256("ADMIN_ROLE")) {
            return admins[account];
        } else if (role == keccak256("SERVER_ROLE")) {
            return servers[account];
        }
        return false;
    }
    
    function updateFee(uint256 newFee) external onlyAdmin {
        creationFee = newFee;
    }
    
    function updateFeeCollector(address payable newCollector) external onlyAdmin {
        require(newCollector != address(0), "Invalid collector");
        feeCollector = newCollector;
    }
    
    function setFeeExemption(address user, bool exempt) external onlyAdmin {
        feeExempt[user] = exempt;
    }
    
    function depositForFees() external payable {
        // Accept deposits for fee sponsorship
    }
    
    function withdrawTRX(uint256 amount) external onlyAdmin {
        payable(msg.sender).transfer(amount);
    }
    
    // TRC-721 Required Functions
    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "Invalid address");
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }
    
    function approve(address to, uint256 tokenId) external {
        address owner = _owners[tokenId];
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }
    
    function getApproved(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "Not token owner");
        require(to != address(0), "Invalid recipient");
        require(
            msg.sender == from || 
            _tokenApprovals[tokenId] == msg.sender ||
            _operatorApprovals[from][msg.sender],
            "Not authorized"
        );
        
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        _tokenApprovals[tokenId] = address(0);
        
        emit Transfer(from, to, tokenId);
    }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return string(abi.encodePacked("ipfs://", _ipfsHashes[tokenId]));
    }
    
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x01ffc9a7;   // ERC165
    }
    
    function setResourceSponsorship(bool) external onlyAdmin {
        // Placeholder for TRON resource sponsorship
    }
}