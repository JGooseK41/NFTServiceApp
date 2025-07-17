// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalNoticeNFT with Flexible Delivery Options
 * @dev Users can send: full package, notice only, or alert only
 * @notice Optimized for cost savings by making preview optional
 */
contract LegalNoticeNFT {
    // TRC-721 Basic Interface
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // Custom Events
    event LegalNoticeCreated(uint256 indexed noticeId, address indexed recipient, uint8 deliveryType);
    event AlertCreated(uint256 indexed alertId, uint256 indexed noticeId, address indexed recipient);
    event NoticeAccepted(uint256 indexed noticeId);
    event ServiceFeeUpdated(uint256 newFee);
    event CreationFeeUpdated(uint256 newFee);
    event SponsorshipFeeUpdated(uint256 newFee);
    event AlertFeeUpdated(uint256 newFee);
    
    // Delivery types
    uint8 constant NOTICE_ONLY = 1;      // Just the IPFS document (cheapest)
    uint8 constant ALERT_ONLY = 2;       // Just the preview image
    uint8 constant FULL_PACKAGE = 3;     // Both notice and alert (most expensive)
    
    // State variables
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Roles
    mapping(address => bool) public admins;
    mapping(address => bool) public servers;
    
    // Fee structure
    uint256 public serviceFee;           // App profit
    uint256 public creationFee;          // Base operations fee
    uint256 public alertFee;             // Additional fee for alert/preview
    uint256 public sponsorshipFee;       // Recipient support
    
    // Fee collectors
    address payable public serviceFeeCollector;
    address payable public feeCollector;
    
    // Exemptions
    mapping(address => bool) public serviceFeeExemptions;
    mapping(address => bool) public fullFeeExemptions;
    
    // Sponsorship
    bool public acceptanceSponsorshipEnabled;
    uint256 public sponsorshipBalance;
    uint256 public estimatedAcceptanceCost = 500000; // ~0.5 TRX
    
    // Notice data (minimal storage for gas efficiency)
    mapping(uint256 => uint256) private _noticeData;
    mapping(uint256 => uint256) private _noticeData2;
    mapping(uint256 => string) private _ipfsHashes;
    
    // Alert data (separate to make optional)
    mapping(uint256 => string) private _alertPreviews;
    mapping(uint256 => uint256) private _alertToNotice; // Maps alert ID to notice ID
    
    // User mappings
    mapping(address => uint256[]) private _userNotices;
    mapping(address => uint256[]) private _userAlerts;
    
    // Counters
    uint256 private _noticeIdCounter;
    uint256 private _alertIdCounter;
    
    constructor(
        address payable _serviceFeeCollector,
        address payable _feeCollector
    ) {
        require(_serviceFeeCollector != address(0), "Invalid service fee collector");
        require(_feeCollector != address(0), "Invalid fee collector");
        
        serviceFeeCollector = _serviceFeeCollector;
        feeCollector = _feeCollector;
        admins[msg.sender] = true;
        
        // Default fees
        serviceFee = 20 * 10**6;         // 20 TRX
        creationFee = 5 * 10**6;         // 5 TRX (reduced base fee)
        alertFee = 10 * 10**6;           // 10 TRX (for preview storage)
        sponsorshipFee = 2 * 10**6;      // 2 TRX
        
        acceptanceSponsorshipEnabled = true;
    }
    
    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }
    
    modifier onlyAuthorized() {
        require(admins[msg.sender] || servers[msg.sender], "Not authorized");
        _;
    }
    
    /**
     * @dev Create legal notice with flexible delivery options
     * @param deliveryType NOTICE_ONLY (1), ALERT_ONLY (2), or FULL_PACKAGE (3)
     */
    function createLegalNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewImage,
        bytes32, // contentHash - not used
        string calldata caseNumber,
        uint16 jurisdiction,
        uint8 docType,
        uint8 deliveryType
    ) external payable onlyAuthorized returns (uint256 noticeId, uint256 alertId) {
        require(recipient != address(0), "Invalid recipient");
        require(deliveryType >= NOTICE_ONLY && deliveryType <= FULL_PACKAGE, "Invalid delivery type");
        
        // Calculate fees based on delivery type
        uint256 requiredServiceFee = 0;
        uint256 requiredCreationFee = 0;
        uint256 requiredAlertFee = 0;
        uint256 requiredSponsorshipFee = 0;
        
        if (!fullFeeExemptions[msg.sender]) {
            if (!serviceFeeExemptions[msg.sender]) {
                requiredServiceFee = serviceFee;
            }
            
            // Base creation fee always applies
            requiredCreationFee = creationFee;
            
            // Alert fee only for ALERT_ONLY or FULL_PACKAGE
            if (deliveryType == ALERT_ONLY || deliveryType == FULL_PACKAGE) {
                requiredAlertFee = alertFee;
            }
            
            // Sponsorship fee for recipient acceptance
            requiredSponsorshipFee = sponsorshipFee;
        }
        
        uint256 totalRequired = requiredServiceFee + requiredCreationFee + requiredAlertFee + requiredSponsorshipFee;
        require(msg.value >= totalRequired, "Insufficient payment");
        
        // Distribute fees
        if (requiredServiceFee > 0) {
            (bool success1, ) = serviceFeeCollector.call{value: requiredServiceFee}("");
            require(success1, "Service fee transfer failed");
        }
        
        uint256 operationalFees = requiredCreationFee + requiredAlertFee;
        if (operationalFees > 0) {
            (bool success2, ) = feeCollector.call{value: operationalFees}("");
            require(success2, "Operational fee transfer failed");
        }
        
        if (requiredSponsorshipFee > 0) {
            sponsorshipBalance += requiredSponsorshipFee;
        }
        
        // Return excess
        if (msg.value > totalRequired) {
            payable(msg.sender).transfer(msg.value - totalRequired);
        }
        
        // Create notice if not ALERT_ONLY
        if (deliveryType == NOTICE_ONLY || deliveryType == FULL_PACKAGE) {
            noticeId = ++_noticeIdCounter;
            
            _storeNoticeData(noticeId, recipient, msg.sender, caseNumber, jurisdiction, docType, deliveryType);
            _ipfsHashes[noticeId] = ipfsHash;
            _userNotices[recipient].push(noticeId);
            
            _mint(recipient, noticeId);
            emit LegalNoticeCreated(noticeId, recipient, deliveryType);
        }
        
        // Create alert if not NOTICE_ONLY
        if (deliveryType == ALERT_ONLY || deliveryType == FULL_PACKAGE) {
            alertId = ++_alertIdCounter;
            
            _alertPreviews[alertId] = previewImage;
            _userAlerts[recipient].push(alertId);
            
            // Link alert to notice if full package
            if (deliveryType == FULL_PACKAGE) {
                _alertToNotice[alertId] = noticeId;
            }
            
            _mint(recipient, alertId);
            emit AlertCreated(alertId, noticeId, recipient);
        }
    }
    
    /**
     * @dev Create standalone alert (cheaper option)
     */
    function createStandaloneAlert(
        address recipient,
        string calldata previewImage
    ) external payable onlyAuthorized returns (uint256 alertId) {
        require(recipient != address(0), "Invalid recipient");
        
        // Calculate minimal fees for alert only
        uint256 requiredFee = 0;
        if (!fullFeeExemptions[msg.sender]) {
            requiredFee = alertFee + sponsorshipFee; // No service fee for minimal alerts
        }
        
        require(msg.value >= requiredFee, "Insufficient payment");
        
        if (alertFee > 0) {
            (bool success, ) = feeCollector.call{value: alertFee}("");
            require(success, "Fee transfer failed");
        }
        
        if (sponsorshipFee > 0) {
            sponsorshipBalance += sponsorshipFee;
        }
        
        // Return excess
        if (msg.value > requiredFee) {
            payable(msg.sender).transfer(msg.value - requiredFee);
        }
        
        alertId = ++_alertIdCounter;
        _alertPreviews[alertId] = previewImage;
        _userAlerts[recipient].push(alertId);
        
        _mint(recipient, alertId);
        emit AlertCreated(alertId, 0, recipient);
    }
    
    /**
     * @dev Accept notice - sponsored for recipients
     */
    function acceptNotice(uint256 noticeId) external {
        require(_owners[noticeId] == msg.sender, "Not notice owner");
        
        uint256 data = _noticeData2[noticeId];
        require((data & 0xFF) == 0, "Already accepted");
        
        bool isSponsored = acceptanceSponsorshipEnabled && 
                          sponsorshipBalance >= estimatedAcceptanceCost;
        
        if (isSponsored) {
            sponsorshipBalance -= estimatedAcceptanceCost;
        }
        
        _noticeData2[noticeId] = data | 1;
        emit NoticeAccepted(noticeId);
    }
    
    function _storeNoticeData(
        uint256 noticeId,
        address recipient,
        address server,
        string calldata caseNumber,
        uint16 jurisdiction,
        uint8 docType,
        uint8 deliveryType
    ) private {
        uint256 data1 = uint256(uint160(recipient)) << 96 | 
                       uint256(uint160(server)) >> 64;
        
        uint256 data2 = uint256(uint160(server)) << 96 |
                       uint256(uint128(block.timestamp)) >> 32;
        
        uint256 data3 = uint256(uint64(uint256(keccak256(abi.encodePacked(caseNumber))))) << 192 |
                       uint256(jurisdiction) << 176 |
                       uint256(docType) << 168 |
                       uint256(deliveryType) << 160;
        
        _noticeData[noticeId] = data1;
        _noticeData2[noticeId] = (data2 & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000000000000000000000000000) | 
                                (data3 >> 128);
    }
    
    // Read functions
    function notices(uint256 noticeId) external view returns (
        address recipient,
        address server,
        string memory ipfsHash,
        uint128 timestamp,
        uint64 caseNumberHash,
        uint16 jurisdictionIndex,
        uint8 documentType,
        uint8 deliveryType,
        uint8 status
    ) {
        uint256 data1 = _noticeData[noticeId];
        uint256 data2 = _noticeData2[noticeId];
        
        recipient = address(uint160(data1 >> 96));
        server = address(uint160(((data1 << 160) | (data2 >> 96)) >> 96));
        timestamp = uint128(data2 >> 32);
        
        uint256 data3 = data2 << 128;
        caseNumberHash = uint64(data3 >> 192);
        jurisdictionIndex = uint16((data3 << 64) >> 240);
        documentType = uint8((data3 << 80) >> 248);
        deliveryType = uint8((data3 << 88) >> 248);
        status = uint8(data2 & 0xFF);
        
        ipfsHash = _ipfsHashes[noticeId];
    }
    
    function alerts(uint256 alertId) external view returns (
        address owner,
        uint256 linkedNoticeId,
        string memory previewImage
    ) {
        owner = _owners[alertId];
        linkedNoticeId = _alertToNotice[alertId];
        previewImage = _alertPreviews[alertId];
    }
    
    // Fee calculation helper
    function calculateFees(address user, uint8 deliveryType) external view returns (
        uint256 total,
        uint256 service,
        uint256 creation,
        uint256 alert,
        uint256 sponsorship
    ) {
        if (fullFeeExemptions[user]) {
            return (0, 0, 0, 0, 0);
        }
        
        service = serviceFeeExemptions[user] ? 0 : serviceFee;
        creation = creationFee;
        
        if (deliveryType == ALERT_ONLY || deliveryType == FULL_PACKAGE) {
            alert = alertFee;
        }
        
        sponsorship = sponsorshipFee;
        total = service + creation + alert + sponsorship;
    }
    
    function getUserNotices(address user) external view returns (uint256[] memory) {
        return _userNotices[user];
    }
    
    function getUserAlerts(address user) external view returns (uint256[] memory) {
        return _userAlerts[user];
    }
    
    // Admin functions
    function grantRole(bytes32 role, address account) external onlyAdmin {
        if (role == keccak256("ADMIN_ROLE")) {
            admins[account] = true;
        } else if (role == keccak256("SERVER_ROLE") || role == keccak256("PROCESS_SERVER_ROLE")) {
            servers[account] = true;
        }
    }
    
    function revokeRole(bytes32 role, address account) external onlyAdmin {
        if (role == keccak256("ADMIN_ROLE")) {
            admins[account] = false;
        } else if (role == keccak256("SERVER_ROLE") || role == keccak256("PROCESS_SERVER_ROLE")) {
            servers[account] = false;
        }
    }
    
    function hasRole(bytes32 role, address account) external view returns (bool) {
        if (role == keccak256("ADMIN_ROLE")) {
            return admins[account];
        } else if (role == keccak256("SERVER_ROLE") || role == keccak256("PROCESS_SERVER_ROLE")) {
            return servers[account];
        }
        return false;
    }
    
    // Fee updates
    function updateServiceFee(uint256 newFee) external onlyAdmin {
        serviceFee = newFee;
        emit ServiceFeeUpdated(newFee);
    }
    
    function updateCreationFee(uint256 newFee) external onlyAdmin {
        creationFee = newFee;
        emit CreationFeeUpdated(newFee);
    }
    
    function updateAlertFee(uint256 newFee) external onlyAdmin {
        alertFee = newFee;
        emit AlertFeeUpdated(newFee);
    }
    
    function updateSponsorshipFee(uint256 newFee) external onlyAdmin {
        sponsorshipFee = newFee;
        emit SponsorshipFeeUpdated(newFee);
    }
    
    function updateServiceFeeCollector(address payable newCollector) external onlyAdmin {
        require(newCollector != address(0), "Invalid collector");
        serviceFeeCollector = newCollector;
    }
    
    function updateFeeCollector(address payable newCollector) external onlyAdmin {
        require(newCollector != address(0), "Invalid collector");
        feeCollector = newCollector;
    }
    
    function setServiceFeeExemption(address user, bool exempt) external onlyAdmin {
        serviceFeeExemptions[user] = exempt;
    }
    
    function setFullFeeExemption(address user, bool exempt) external onlyAdmin {
        fullFeeExemptions[user] = exempt;
    }
    
    function setAcceptanceSponsorship(bool enabled) external onlyAdmin {
        acceptanceSponsorshipEnabled = enabled;
    }
    
    function depositForSponsorship() external payable {
        sponsorshipBalance += msg.value;
    }
    
    function withdrawExcessSponsorship(uint256 amount) external onlyAdmin {
        require(amount <= sponsorshipBalance, "Insufficient balance");
        sponsorshipBalance -= amount;
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
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _transfer(from, to, tokenId);
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _transfer(from, to, tokenId);
    }
    
    function tokenURI(uint256) external pure returns (string memory) {
        return "";
    }
    
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd || interfaceId == 0x01ffc9a7;
    }
    
    // Internal functions
    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Cannot mint to zero address");
        require(_owners[tokenId] == address(0), "Token already exists");
        
        _balances[to]++;
        _owners[tokenId] = to;
        
        emit Transfer(address(0), to, tokenId);
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        require(_owners[tokenId] == from, "Not token owner");
        require(to != address(0), "Cannot transfer to zero address");
        
        _tokenApprovals[tokenId] = address(0);
        
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        
        emit Transfer(from, to, tokenId);
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = _owners[tokenId];
        return (spender == owner || _tokenApprovals[tokenId] == spender || _operatorApprovals[owner][spender]);
    }
}