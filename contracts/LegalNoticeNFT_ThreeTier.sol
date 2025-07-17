// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalNoticeNFT with Three-Tier Fee System
 * @dev Service fee (profit) + Creation fee (operations) + Sponsorship fee (recipient acceptance)
 * @notice Production contract with sustainable revenue and sponsorship model
 */
contract LegalNoticeNFT {
    // TRC-721 Basic Interface
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // Custom Events
    event LegalNoticeCreated(uint256 indexed noticeId, uint256 indexed alertId, address indexed recipient);
    event NoticeAccepted(uint256 indexed noticeId);
    event ServiceFeeUpdated(uint256 newFee);
    event CreationFeeUpdated(uint256 newFee);
    event SponsorshipFeeUpdated(uint256 newFee);
    event FeeCollectorUpdated(address newCollector);
    event ServiceFeeCollectorUpdated(address newCollector);
    event AcceptanceSponsorshipUpdated(bool enabled);
    event SponsorshipDeposit(address indexed depositor, uint256 amount);
    event SponsorshipUsed(address indexed recipient, uint256 amount);
    
    // State variables
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Roles
    mapping(address => bool) public admins;
    mapping(address => bool) public servers;
    
    // Three-tier fee management
    uint256 public serviceFee;           // App profit fee (can be waived for law enforcement)
    uint256 public creationFee;          // Operational fee (goes to fee collector)
    uint256 public sponsorshipFee;       // Sponsorship fee (stays in contract)
    
    // Fee collectors
    address payable public serviceFeeCollector;  // Receives service fees (profit)
    address payable public feeCollector;         // Receives creation fees (operations)
    
    // Fee exemptions
    mapping(address => bool) public serviceFeeExemptions;  // Law enforcement exemption
    mapping(address => bool) public fullFeeExemptions;     // Complete exemption (admin use)
    
    // Sponsorship management
    bool public acceptanceSponsorshipEnabled;
    uint256 public sponsorshipBalance;
    uint256 public estimatedAcceptanceCost = 500000; // ~0.5 TRX in SUN
    
    // Track sponsorship credits per notice
    mapping(uint256 => bool) public noticeSponsorshipPaid;
    
    // Optimized notice storage
    mapping(uint256 => uint256) private _noticeData;
    mapping(uint256 => uint256) private _noticeData2;
    mapping(uint256 => string) private _ipfsHashes;
    mapping(uint256 => string) private _alertPreviews;
    
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
        
        // Default fee structure
        serviceFee = 20 * 10**6;         // 20 TRX - App profit
        creationFee = 10 * 10**6;        // 10 TRX - Operations
        sponsorshipFee = 2 * 10**6;      // 2 TRX - Recipient sponsorship
        
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
     * @dev Create legal notice with three-tier fee system
     * @notice Fees: service (profit) + creation (operations) + sponsorship (recipient)
     */
    function createLegalNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewImage,
        bytes32, // contentHash - not used in optimized version
        string calldata caseNumber,
        uint16 jurisdiction,
        uint8 docType
    ) external payable onlyAuthorized returns (uint256 noticeId, uint256 alertId) {
        require(recipient != address(0), "Invalid recipient");
        
        // Calculate fees based on exemptions
        uint256 requiredServiceFee = 0;
        uint256 requiredCreationFee = 0;
        uint256 requiredSponsorshipFee = 0;
        
        if (!fullFeeExemptions[msg.sender]) {
            // Check service fee exemption (for law enforcement)
            if (!serviceFeeExemptions[msg.sender]) {
                requiredServiceFee = serviceFee;
            }
            requiredCreationFee = creationFee;
            requiredSponsorshipFee = sponsorshipFee;
        }
        
        uint256 totalRequired = requiredServiceFee + requiredCreationFee + requiredSponsorshipFee;
        require(msg.value >= totalRequired, "Insufficient payment");
        
        // Distribute fees
        if (requiredServiceFee > 0) {
            (bool success1, ) = serviceFeeCollector.call{value: requiredServiceFee}("");
            require(success1, "Service fee transfer failed");
        }
        
        if (requiredCreationFee > 0) {
            (bool success2, ) = feeCollector.call{value: requiredCreationFee}("");
            require(success2, "Creation fee transfer failed");
        }
        
        if (requiredSponsorshipFee > 0) {
            sponsorshipBalance += requiredSponsorshipFee;
            emit SponsorshipDeposit(msg.sender, requiredSponsorshipFee);
        }
        
        // Return excess payment
        if (msg.value > totalRequired) {
            payable(msg.sender).transfer(msg.value - totalRequired);
        }
        
        // Increment counters
        noticeId = ++_noticeIdCounter;
        alertId = ++_alertIdCounter;
        
        // Mark sponsorship as paid if fee was collected
        if (requiredSponsorshipFee > 0) {
            noticeSponsorshipPaid[noticeId] = true;
        }
        
        // Store packed data
        _storeNoticeData(noticeId, alertId, recipient, msg.sender, caseNumber, jurisdiction, docType);
        
        // Store strings
        _ipfsHashes[noticeId] = ipfsHash;
        _alertPreviews[alertId] = previewImage;
        
        // Update user mappings
        _userNotices[recipient].push(noticeId);
        _userAlerts[recipient].push(alertId);
        
        // Mint tokens
        _mint(recipient, noticeId);
        _mint(recipient, alertId);
        
        emit LegalNoticeCreated(noticeId, alertId, recipient);
    }
    
    /**
     * @dev Accept notice - FREE for recipients (sponsored)
     */
    function acceptNotice(uint256 noticeId) external {
        require(_owners[noticeId] == msg.sender, "Not notice owner");
        
        uint256 data = _noticeData2[noticeId];
        require((data & 0xFF) == 0, "Already accepted");
        
        // Check sponsorship availability
        bool isSponsored = acceptanceSponsorshipEnabled && 
                          noticeSponsorshipPaid[noticeId] && 
                          sponsorshipBalance >= estimatedAcceptanceCost;
        
        if (isSponsored) {
            sponsorshipBalance -= estimatedAcceptanceCost;
            emit SponsorshipUsed(msg.sender, estimatedAcceptanceCost);
        }
        
        _noticeData2[noticeId] = data | 1;
        emit NoticeAccepted(noticeId);
    }
    
    function _storeNoticeData(
        uint256 noticeId,
        uint256 alertId,
        address recipient,
        address server,
        string calldata caseNumber,
        uint16 jurisdiction,
        uint8 docType
    ) private {
        uint256 data1 = uint256(uint160(recipient)) << 96 | 
                       uint256(uint160(server)) >> 64;
        
        uint256 data2 = uint256(uint160(server)) << 96 |
                       uint256(uint128(block.timestamp)) >> 32;
        
        uint256 data3 = uint256(uint64(uint256(keccak256(abi.encodePacked(caseNumber))))) << 192 |
                       uint256(uint32(alertId)) << 160 |
                       uint256(jurisdiction) << 144 |
                       uint256(docType) << 136;
        
        _noticeData[noticeId] = data1;
        _noticeData2[noticeId] = (data2 & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000000000000000000000000000) | 
                                (data3 >> 128);
    }
    
    // Read functions
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
        uint256 data1 = _noticeData[noticeId];
        uint256 data2 = _noticeData2[noticeId];
        
        recipient = address(uint160(data1 >> 96));
        server = address(uint160(((data1 << 160) | (data2 >> 96)) >> 96));
        timestamp = uint128(data2 >> 32);
        
        uint256 data3 = data2 << 128;
        caseNumberHash = uint64(data3 >> 192);
        alertTokenId = uint32((data3 << 64) >> 224);
        jurisdictionIndex = uint16((data3 << 96) >> 240);
        documentType = uint8((data3 << 112) >> 248);
        status = uint8(data2 & 0xFF);
        
        ipfsHash = _ipfsHashes[noticeId];
        contentHash = 0;
    }
    
    function alerts(uint256 alertId) external view returns (
        address owner,
        uint256 noticeId,
        string memory previewImage
    ) {
        owner = _owners[alertId];
        
        uint256 data = _noticeData2[alertId - 1];
        uint256 data3 = data << 128;
        noticeId = uint256(uint32((data3 << 64) >> 224)) - 1;
        previewImage = _alertPreviews[alertId];
    }
    
    function getUserNotices(address user) external view returns (uint256[] memory) {
        return _userNotices[user];
    }
    
    function getUserAlerts(address user) external view returns (uint256[] memory) {
        return _userAlerts[user];
    }
    
    // Fee calculation helpers
    function getTotalCreationCost(address user) external view returns (
        uint256 total,
        uint256 service,
        uint256 creation,
        uint256 sponsorship
    ) {
        if (fullFeeExemptions[user]) {
            return (0, 0, 0, 0);
        }
        
        service = serviceFeeExemptions[user] ? 0 : serviceFee;
        creation = creationFee;
        sponsorship = sponsorshipFee;
        total = service + creation + sponsorship;
    }
    
    function getSponsorshipBalance() external view returns (uint256) {
        return sponsorshipBalance;
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
    
    /**
     * @dev Update service fee (profit)
     */
    function updateServiceFee(uint256 newFee) external onlyAdmin {
        serviceFee = newFee;
        emit ServiceFeeUpdated(newFee);
    }
    
    /**
     * @dev Update creation fee (operations)
     */
    function updateCreationFee(uint256 newFee) external onlyAdmin {
        creationFee = newFee;
        emit CreationFeeUpdated(newFee);
    }
    
    /**
     * @dev Update sponsorship fee
     */
    function updateSponsorshipFee(uint256 newFee) external onlyAdmin {
        sponsorshipFee = newFee;
        emit SponsorshipFeeUpdated(newFee);
    }
    
    /**
     * @dev Update service fee collector (profit recipient)
     */
    function updateServiceFeeCollector(address payable newCollector) external onlyAdmin {
        require(newCollector != address(0), "Invalid collector");
        serviceFeeCollector = newCollector;
        emit ServiceFeeCollectorUpdated(newCollector);
    }
    
    /**
     * @dev Update fee collector (operations)
     */
    function updateFeeCollector(address payable newCollector) external onlyAdmin {
        require(newCollector != address(0), "Invalid collector");
        feeCollector = newCollector;
        emit FeeCollectorUpdated(newCollector);
    }
    
    /**
     * @dev Set service fee exemption (for law enforcement)
     */
    function setServiceFeeExemption(address user, bool exempt) external onlyAdmin {
        serviceFeeExemptions[user] = exempt;
    }
    
    /**
     * @dev Set full fee exemption (admin use)
     */
    function setFullFeeExemption(address user, bool exempt) external onlyAdmin {
        fullFeeExemptions[user] = exempt;
    }
    
    /**
     * @dev Enable/disable acceptance sponsorship
     */
    function setAcceptanceSponsorship(bool enabled) external onlyAdmin {
        acceptanceSponsorshipEnabled = enabled;
        emit AcceptanceSponsorshipUpdated(enabled);
    }
    
    /**
     * @dev Update estimated acceptance cost
     */
    function updateEstimatedAcceptanceCost(uint256 newCost) external onlyAdmin {
        estimatedAcceptanceCost = newCost;
    }
    
    /**
     * @dev Deposit additional sponsorship funds
     */
    function depositForSponsorship() external payable {
        sponsorshipBalance += msg.value;
        emit SponsorshipDeposit(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw excess sponsorship (maintaining minimum reserve)
     */
    function withdrawExcessSponsorship(uint256 amount) external onlyAdmin {
        require(amount <= sponsorshipBalance, "Insufficient balance");
        
        // Ensure minimum reserve for pending notices
        uint256 minReserve = _noticeIdCounter * estimatedAcceptanceCost;
        require(sponsorshipBalance - amount >= minReserve, "Would deplete minimum reserve");
        
        sponsorshipBalance -= amount;
        payable(msg.sender).transfer(amount);
    }
    
    /**
     * @dev Emergency withdrawal (only when sponsorship disabled)
     */
    function emergencyWithdraw() external onlyAdmin {
        require(!acceptanceSponsorshipEnabled, "Disable sponsorship first");
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
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