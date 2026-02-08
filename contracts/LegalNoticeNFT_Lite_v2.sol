// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

/**
 * @title LegalNoticeNFT Lite v2
 * @notice Gas-optimized legal notice NFT with recipient sponsorship
 * @dev Single Alert NFT per serve, includes TRX funding for recipients
 */
contract LegalNoticeNFT_Lite_v2 {

    // ============ State Variables ============

    string public name = "Legal Notice";
    string public symbol = "NOTICE";

    uint256 private _currentTokenId = 1;
    uint256 public totalNotices;

    // ERC721 core storage
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // Enumeration for wallet display
    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;

    // Notice tracking - minimal storage
    struct Notice {
        address recipient;
        address server;
        uint48 servedAt;
        uint48 acknowledgedAt;
        bool acknowledged;
    }
    mapping(uint256 => Notice) public notices;

    // Track notices by address
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public serverNotices;

    // Access control
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isServer;
    address[] private _servers;
    mapping(address => uint256) private _serverIndex;

    // Fees
    uint256 public serviceFee;           // Fee that goes to platform (feeCollector)
    uint256 public recipientFunding;     // TRX sent to recipient for gas
    address public feeCollector;
    mapping(address => bool) public feeExempt;

    // ============ Events ============

    // ERC721 standard
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // Legal notice events
    event NoticeServed(
        uint256 indexed alertId,
        address indexed recipient,
        address indexed server,
        string metadataURI,
        uint256 timestamp
    );
    event NoticeAcknowledged(uint256 indexed alertId, address indexed recipient, uint256 timestamp);
    event RecipientFunded(uint256 indexed alertId, address indexed recipient, uint256 amount);

    // Admin events
    event ServerUpdated(address indexed server, bool authorized);
    event AdminUpdated(address indexed admin, bool authorized);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event RecipientFundingUpdated(uint256 oldAmount, uint256 newAmount);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FeeExemptUpdated(address indexed user, bool exempt);

    // ============ Constructor ============

    constructor(uint256 _serviceFee, uint256 _recipientFunding) {
        feeCollector = msg.sender;
        serviceFee = _serviceFee;
        recipientFunding = _recipientFunding;
        isAdmin[msg.sender] = true;
        isServer[msg.sender] = true;
        _servers.push(msg.sender);
        _serverIndex[msg.sender] = 0;
    }

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not admin");
        _;
    }

    modifier onlyAuthorized() {
        require(isServer[msg.sender] || isAdmin[msg.sender], "Not authorized");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Get the total required payment for serving a notice
     * @return Total TRX required (serviceFee + recipientFunding)
     */
    function getRequiredPayment() public view returns (uint256) {
        return serviceFee + recipientFunding;
    }

    /**
     * @notice Get the total required payment for batch serving
     * @param count Number of recipients
     * @return Total TRX required
     */
    function getRequiredPaymentBatch(uint256 count) public view returns (uint256) {
        return (serviceFee + recipientFunding) * count;
    }

    /**
     * @notice Serve a legal notice to a recipient
     * @param recipient Address to receive the notice NFT
     * @param metadataURI URI pointing to notice metadata JSON
     * @return alertId The token ID of the minted alert NFT
     */
    function serveNotice(
        address recipient,
        string calldata metadataURI
    ) external payable onlyAuthorized returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(bytes(metadataURI).length > 0, "Empty metadata URI");

        uint256 totalRequired = serviceFee + recipientFunding;

        // Check fee (exempt users don't pay serviceFee but still fund recipient)
        if (feeExempt[msg.sender]) {
            require(msg.value >= recipientFunding, "Insufficient recipient funding");
        } else {
            require(msg.value >= totalRequired, "Insufficient payment");
        }

        uint256 alertId = _currentTokenId++;

        // Store notice - minimal data
        notices[alertId] = Notice({
            recipient: recipient,
            server: msg.sender,
            servedAt: uint48(block.timestamp),
            acknowledgedAt: 0,
            acknowledged: false
        });

        // Track by addresses
        recipientNotices[recipient].push(alertId);
        serverNotices[msg.sender].push(alertId);
        totalNotices++;

        // Mint NFT
        _mint(recipient, alertId);
        _tokenURIs[alertId] = metadataURI;

        emit NoticeServed(alertId, recipient, msg.sender, metadataURI, block.timestamp);

        // Send recipient funding (gas money for signing)
        if (recipientFunding > 0) {
            payable(recipient).transfer(recipientFunding);
            emit RecipientFunded(alertId, recipient, recipientFunding);
        }

        // Transfer service fee to collector
        uint256 collectorAmount = feeExempt[msg.sender] ? 0 : serviceFee;
        if (collectorAmount > 0 && feeCollector != address(0)) {
            payable(feeCollector).transfer(collectorAmount);
        }

        // Refund any excess payment
        uint256 totalUsed = collectorAmount + recipientFunding;
        if (msg.value > totalUsed) {
            payable(msg.sender).transfer(msg.value - totalUsed);
        }

        return alertId;
    }

    /**
     * @notice Batch serve notices - more gas efficient for multiple serves
     * @param recipients Array of recipient addresses
     * @param metadataURIs Array of metadata URIs
     * @return alertIds Array of minted token IDs
     */
    function serveNoticeBatch(
        address[] calldata recipients,
        string[] calldata metadataURIs
    ) external payable onlyAuthorized returns (uint256[] memory) {
        uint256 count = recipients.length;
        require(count == metadataURIs.length, "Array length mismatch");
        require(count > 0 && count <= 10, "Batch size 1-10");

        uint256 perNotice = serviceFee + recipientFunding;
        uint256 totalRequired = perNotice * count;

        // Check total fee
        if (feeExempt[msg.sender]) {
            require(msg.value >= recipientFunding * count, "Insufficient recipient funding");
        } else {
            require(msg.value >= totalRequired, "Insufficient payment");
        }

        uint256[] memory alertIds = new uint256[](count);
        uint256 totalRecipientFunding = 0;

        for (uint256 i = 0; i < count; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(bytes(metadataURIs[i]).length > 0, "Empty metadata URI");

            uint256 alertId = _currentTokenId++;
            alertIds[i] = alertId;

            notices[alertId] = Notice({
                recipient: recipients[i],
                server: msg.sender,
                servedAt: uint48(block.timestamp),
                acknowledgedAt: 0,
                acknowledged: false
            });

            recipientNotices[recipients[i]].push(alertId);
            serverNotices[msg.sender].push(alertId);
            totalNotices++;

            _mint(recipients[i], alertId);
            _tokenURIs[alertId] = metadataURIs[i];

            emit NoticeServed(alertId, recipients[i], msg.sender, metadataURIs[i], block.timestamp);

            // Send recipient funding
            if (recipientFunding > 0) {
                payable(recipients[i]).transfer(recipientFunding);
                emit RecipientFunded(alertId, recipients[i], recipientFunding);
                totalRecipientFunding += recipientFunding;
            }
        }

        // Transfer total service fee to collector
        uint256 totalCollectorFee = feeExempt[msg.sender] ? 0 : serviceFee * count;
        if (totalCollectorFee > 0 && feeCollector != address(0)) {
            payable(feeCollector).transfer(totalCollectorFee);
        }

        // Refund any excess payment
        uint256 totalUsed = totalCollectorFee + totalRecipientFunding;
        if (msg.value > totalUsed) {
            payable(msg.sender).transfer(msg.value - totalUsed);
        }

        return alertIds;
    }

    /**
     * @notice Recipient acknowledges/signs the notice
     * @param alertId The token ID to acknowledge
     */
    function acknowledgeNotice(uint256 alertId) external {
        Notice storage notice = notices[alertId];
        require(notice.recipient == msg.sender, "Not recipient");
        require(!notice.acknowledged, "Already acknowledged");

        notice.acknowledged = true;
        notice.acknowledgedAt = uint48(block.timestamp);

        emit NoticeAcknowledged(alertId, msg.sender, block.timestamp);
    }

    // ============ ERC721 Implementation ============

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "Invalid address");
        return _balances[owner];
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenURIs[tokenId];
    }

    function totalSupply() public view returns (uint256) {
        return _currentTokenId - 1;
    }

    function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256) {
        require(index < _ownedTokens[owner].length, "Index out of bounds");
        return _ownedTokens[owner][index];
    }

    function tokensOfOwner(address owner) public view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }

    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        require(operator != msg.sender, "Cannot approve self");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory) public {
        transferFrom(from, to, tokenId);
    }

    function _mint(address to, uint256 tokenId) internal {
        _owners[tokenId] = to;
        _balances[to]++;

        uint256 index = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
        _ownedTokensIndex[tokenId] = index;

        emit Transfer(address(0), to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "Not owner");
        require(to != address(0), "Invalid recipient");

        // Clear approval
        delete _tokenApprovals[tokenId];

        // Update balances
        _balances[from]--;
        _balances[to]++;

        // Update enumeration - remove from sender
        uint256 lastIndex = _ownedTokens[from].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];
        if (tokenIndex != lastIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastIndex];
            _ownedTokens[from][tokenIndex] = lastTokenId;
            _ownedTokensIndex[lastTokenId] = tokenIndex;
        }
        _ownedTokens[from].pop();

        // Add to receiver
        _ownedTokens[to].push(tokenId);
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length - 1;

        // Update owner
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    // ============ Admin Functions ============

    function setServer(address server, bool authorized) external onlyAdmin {
        require(server != address(0), "Invalid address");

        if (authorized && !isServer[server]) {
            isServer[server] = true;
            _serverIndex[server] = _servers.length;
            _servers.push(server);
        } else if (!authorized && isServer[server]) {
            isServer[server] = false;
            // Remove from array
            uint256 index = _serverIndex[server];
            uint256 lastIndex = _servers.length - 1;
            if (index != lastIndex) {
                address lastServer = _servers[lastIndex];
                _servers[index] = lastServer;
                _serverIndex[lastServer] = index;
            }
            _servers.pop();
            delete _serverIndex[server];
        }

        emit ServerUpdated(server, authorized);
    }

    function setAdmin(address admin, bool authorized) external onlyAdmin {
        require(admin != address(0), "Invalid address");
        require(admin != msg.sender || authorized, "Cannot remove self");
        isAdmin[admin] = authorized;
        emit AdminUpdated(admin, authorized);
    }

    function setFee(uint256 newFee) external onlyAdmin {
        uint256 oldFee = serviceFee;
        serviceFee = newFee;
        emit FeeUpdated(oldFee, newFee);
    }

    function setRecipientFunding(uint256 newAmount) external onlyAdmin {
        uint256 oldAmount = recipientFunding;
        recipientFunding = newAmount;
        emit RecipientFundingUpdated(oldAmount, newAmount);
    }

    function setFeeCollector(address newCollector) external onlyAdmin {
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    function setFeeExempt(address user, bool exempt) external onlyAdmin {
        feeExempt[user] = exempt;
        emit FeeExemptUpdated(user, exempt);
    }

    // ============ View Functions ============

    function getNotice(uint256 alertId) external view returns (
        address recipient,
        address server,
        uint256 servedAt,
        uint256 acknowledgedAt,
        bool acknowledged
    ) {
        Notice storage n = notices[alertId];
        return (n.recipient, n.server, n.servedAt, n.acknowledgedAt, n.acknowledged);
    }

    function getServers() external view returns (address[] memory) {
        return _servers;
    }

    function getServerCount() external view returns (uint256) {
        return _servers.length;
    }

    function getRecipientNotices(address recipient) external view returns (uint256[] memory) {
        return recipientNotices[recipient];
    }

    function getServerNotices(address server) external view returns (uint256[] memory) {
        return serverNotices[server];
    }

    /**
     * @notice Get current fee configuration
     * @return _serviceFee Platform fee per notice
     * @return _recipientFunding TRX sent to each recipient
     * @return _totalPerNotice Total required per notice
     */
    function getFeeConfig() external view returns (
        uint256 _serviceFee,
        uint256 _recipientFunding,
        uint256 _totalPerNotice
    ) {
        return (serviceFee, recipientFunding, serviceFee + recipientFunding);
    }

    // ============ ERC165 Interface Support ============

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f;   // ERC721Metadata
    }
}
