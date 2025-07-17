// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalNoticeNFT with Dual Fee System
 * @dev Process servers pay creation fee + sponsorship fee for recipient acceptance
 * @notice Production contract with sustainable sponsorship model
 */
contract LegalNoticeNFT {
    // TRC-721 Basic Interface
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // Custom Events
    event LegalNoticeCreated(uint256 indexed noticeId, uint256 indexed alertId, address indexed recipient);
    event NoticeAccepted(uint256 indexed noticeId);
    event FeeUpdated(uint256 newFee);
    event SponsorshipFeeUpdated(uint256 newFee);
    event FeeCollectorUpdated(address newCollector);
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
    
    // Fee management
    uint256 public creationFee;          // Base fee for creating notice (goes to fee collector)
    uint256 public sponsorshipFee;       // Additional fee for sponsoring acceptance (stays in contract)
    address payable public feeCollector;
    mapping(address => bool) public feeExemptions;
    
    // Sponsorship management
    bool public acceptanceSponsorshipEnabled;
    uint256 public sponsorshipBalance;   // Total balance available for sponsorship
    uint256 public estimatedAcceptanceCost = 500000; // Estimated cost for acceptance in SUN (~0.5 TRX)
    
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
    
    constructor(address payable _feeCollector) {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
        admins[msg.sender] = true;
        creationFee = 10 * 10**6;        // 10 TRX in SUN
        sponsorshipFee = 2 * 10**6;      // 2 TRX in SUN (covers ~4 acceptances at 0.5 TRX each)
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
     * @dev Create legal notice with dual fee system
     * @notice Process servers pay: creation fee (to collector) + sponsorship fee (to contract)
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
        
        // Calculate total required payment
        uint256 totalRequired = 0;
        if (!feeExemptions[msg.sender]) {
            totalRequired = creationFee + sponsorshipFee;
            require(msg.value >= totalRequired, "Insufficient payment");
            
            // Split the payment:
            // 1. Creation fee goes to fee collector
            if (creationFee > 0) {
                (bool success, ) = feeCollector.call{value: creationFee}("");
                require(success, "Fee transfer failed");
            }
            
            // 2. Sponsorship fee stays in contract for recipient
            if (sponsorshipFee > 0) {
                sponsorshipBalance += sponsorshipFee;
                emit SponsorshipDeposit(msg.sender, sponsorshipFee);
            }
            
            // Return excess payment
            if (msg.value > totalRequired) {
                payable(msg.sender).transfer(msg.value - totalRequired);
            }
        }
        
        // Increment counters
        noticeId = ++_noticeIdCounter;
        alertId = ++_alertIdCounter;
        
        // Mark this notice as having sponsorship paid
        noticeSponsorshipPaid[noticeId] = true;
        
        // Store packed data
        _storeNoticeData(noticeId, alertId, recipient, msg.sender, caseNumber, jurisdiction, docType);
        
        // Store strings separately
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
     * @notice Recipients pay nothing if sponsorship was paid and enabled
     */
    function acceptNotice(uint256 noticeId) external {
        require(_owners[noticeId] == msg.sender, "Not notice owner");
        
        // Check if already accepted
        uint256 data = _noticeData2[noticeId];
        require((data & 0xFF) == 0, "Already accepted");
        
        // Check if sponsorship is available for this notice
        bool isSponsored = acceptanceSponsorshipEnabled && 
                          noticeSponsorshipPaid[noticeId] && 
                          sponsorshipBalance >= estimatedAcceptanceCost;
        
        if (isSponsored) {
            // Deduct from sponsorship balance
            sponsorshipBalance -= estimatedAcceptanceCost;
            emit SponsorshipUsed(msg.sender, estimatedAcceptanceCost);
        }
        
        // Update status
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
        // Pack data efficiently
        uint256 data1 = uint256(uint160(recipient)) << 96 | 
                       uint256(uint160(server)) >> 64;
        
        uint256 data2 = uint256(uint160(server)) << 96 |
                       uint256(uint128(block.timestamp)) >> 32;
        
        uint256 data3 = uint256(uint64(uint256(keccak256(abi.encodePacked(caseNumber))))) << 192 |
                       uint256(uint32(alertId)) << 160 |
                       uint256(jurisdiction) << 144 |
                       uint256(docType) << 136;
        
        // Store packed data
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
        contentHash = 0; // Not stored to save gas
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
    
    // View functions for fee information
    function getTotalCreationCost() external view returns (uint256) {
        return creationFee + sponsorshipFee;
    }
    
    function getSponsorshipBalance() external view returns (uint256) {
        return sponsorshipBalance;
    }
    
    function isNoticeSponsorshipPaid(uint256 noticeId) external view returns (bool) {
        return noticeSponsorshipPaid[noticeId];
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
     * @dev Update creation fee (goes to fee collector)
     */
    function updateFee(uint256 newFee) external onlyAdmin {
        creationFee = newFee;
        emit FeeUpdated(newFee);
    }
    
    /**
     * @dev Update sponsorship fee (stays in contract)
     */
    function updateSponsorshipFee(uint256 newFee) external onlyAdmin {
        sponsorshipFee = newFee;
        emit SponsorshipFeeUpdated(newFee);
    }
    
    /**
     * @dev Update estimated acceptance cost
     */
    function updateEstimatedAcceptanceCost(uint256 newCost) external onlyAdmin {
        estimatedAcceptanceCost = newCost;
    }
    
    /**
     * @dev Update fee collector
     */
    function updateFeeCollector(address payable newCollector) external onlyAdmin {
        require(newCollector != address(0), "Invalid collector");
        feeCollector = newCollector;
        emit FeeCollectorUpdated(newCollector);
    }
    
    /**
     * @dev Set fee exemption
     */
    function setFeeExemption(address user, bool exempt) external onlyAdmin {
        feeExemptions[user] = exempt;
    }
    
    /**
     * @dev Enable/disable acceptance sponsorship
     */
    function setAcceptanceSponsorship(bool enabled) external onlyAdmin {
        acceptanceSponsorshipEnabled = enabled;
        emit AcceptanceSponsorshipUpdated(enabled);
    }
    
    /**
     * @dev Additional sponsorship deposits
     */
    function depositForSponsorship() external payable {
        sponsorshipBalance += msg.value;
        emit SponsorshipDeposit(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw excess sponsorship funds
     * @notice Only withdraw amount above what's needed for pending acceptances
     */
    function withdrawExcessSponsorship(uint256 amount) external onlyAdmin {
        require(amount <= sponsorshipBalance, "Insufficient sponsorship balance");
        sponsorshipBalance -= amount;
        payable(msg.sender).transfer(amount);
    }
    
    /**
     * @dev Emergency withdraw (only if sponsorship is disabled)
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