// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract LegalNoticeNFT_v5_Enumerable {
    // Token tracking
    uint256 private _currentTokenId = 1;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Enumerable mappings for wallet visibility
    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;
    uint256[] private _allTokens;
    mapping(uint256 => uint256) private _allTokensIndex;
    
    // IPFS metadata storage
    mapping(uint256 => string) private _tokenURIs;
    
    // Notice types
    enum NoticeType { ALERT, DOCUMENT }
    
    // Notice data structures
    struct AlertNotice {
        address recipient;
        address sender;
        uint256 documentId;
        uint256 timestamp;
        bool acknowledged;
        string issuingAgency;
        string noticeType;
        string caseNumber;
        string caseDetails;
        string legalRights;
        uint256 responseDeadline;
        string previewImage;
    }
    
    struct DocumentNotice {
        string encryptedIPFS;
        string decryptionKey;
        address authorizedViewer;
        uint256 alertId;
        bool isRestricted;
    }
    
    struct Notice {
        uint256 alertId;
        uint256 documentId;
        address server;
        address recipient;
        uint256 timestamp;
        bool acknowledged;
        string noticeType;
        string caseNumber;
    }
    
    // Storage mappings
    mapping(uint256 => AlertNotice) public alertNotices;
    mapping(uint256 => DocumentNotice) public documentNotices;
    mapping(uint256 => Notice) public notices;
    mapping(uint256 => NoticeType) public tokenTypes;
    
    // Access control with member tracking
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    mapping(bytes32 => mapping(address => bool)) private _roles;
    mapping(bytes32 => address[]) private _roleMembers;
    mapping(bytes32 => mapping(address => uint256)) private _roleMemberIndex;
    
    // Tracking
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public serverNotices;
    mapping(address => uint256[]) private userNotices;
    uint256 public totalNotices;
    
    // Process Server ID system
    mapping(address => uint256) public serverIds;
    mapping(uint256 => address) public serverById;
    uint256 private _nextServerId = 1000;
    
    // Service attempt tracking
    mapping(uint256 => uint256) public serviceAttempts;
    mapping(uint256 => string) public lastAttemptNote;
    
    // Fees (updatable) - ADDED MAX LIMITS
    uint256 public serviceFee = 20e6; // 20 TRX
    uint256 public creationFee = 5e6; // 5 TRX
    uint256 public sponsorshipFee = 2e6; // 2 TRX
    uint256 constant MAX_FEE = 100e6; // 100 TRX max for any fee
    address public feeCollector;
    mapping(address => bool) public serviceFeeExemptions;
    mapping(address => bool) public fullFeeExemptions;
    
    // Pausability & Reentrancy
    bool public paused;
    bool private _entered;
    
    // Resource sponsorship
    bool public resourceSponsorshipEnabled;
    mapping(address => uint256) public sponsoredEnergy;
    
    // Events
    event NoticeServed(uint256 alertId, uint256 documentId, address recipient);
    event NoticeAcknowledged(uint256 alertId, address recipient);
    event DocumentAccessed(uint256 documentId, address viewer);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Paused(address account);
    event Unpaused(address account);
    event ProcessServerRegistered(address server, uint256 serverId);
    event ResourceSponsored(address recipient, uint256 energy, uint256 trx);
    event LegalNoticeCreated(uint256 noticeId, address server, address recipient, uint256 timestamp);
    event ServiceAttemptRecorded(uint256 noticeId, uint256 attemptNumber, string note);
    event FeeUpdated(string feeType, uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    // CRITICAL: Reentrancy guard
    modifier nonReentrant() {
        require(!_entered, "RE");
        _entered = true;
        _;
        _entered = false;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "!Admin");
        _;
    }
    
    modifier onlyAuthorized() {
        require(hasRole(PROCESS_SERVER_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "!Auth");
        _;
    }
    
    constructor() {
        feeCollector = msg.sender;
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PROCESS_SERVER_ROLE, msg.sender);
    }
    
    // Batch notice structure
    struct BatchNotice {
        address recipient;
        string encryptedIPFS;
        string encryptionKey;
        string issuingAgency;
        string noticeType;
        string caseNumber;
        string caseDetails;
        string legalRights;
        uint256 responseDeadline;
        string previewImage;
        bool sponsorFees;
    }
    
    // Main serve function WITH REENTRANCY PROTECTION
    function serveNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory encryptionKey,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory caseDetails,
        string memory legalRights,
        uint256 responseDeadline,
        string memory previewImage,
        bool sponsorFees
    ) external payable whenNotPaused onlyAuthorized nonReentrant returns (uint256, uint256) {
        require(recipient != address(0), "!Rcpt");
        
        // Calculate and validate fees inline
        require(msg.value >= calculateFee(msg.sender) + (sponsorFees ? sponsorshipFee : 0), "!Fee");
        
        // Create notice IDs
        uint256 alertId = _currentTokenId++;
        uint256 documentId = _currentTokenId++;
        
        // Store alert notice directly without local struct
        alertNotices[alertId].recipient = recipient;
        alertNotices[alertId].sender = msg.sender;
        alertNotices[alertId].documentId = documentId;
        alertNotices[alertId].timestamp = block.timestamp;
        alertNotices[alertId].acknowledged = false;
        alertNotices[alertId].issuingAgency = issuingAgency;
        alertNotices[alertId].noticeType = noticeType;
        alertNotices[alertId].caseNumber = caseNumber;
        alertNotices[alertId].caseDetails = caseDetails;
        alertNotices[alertId].legalRights = legalRights;
        alertNotices[alertId].responseDeadline = responseDeadline;
        alertNotices[alertId].previewImage = previewImage;
        
        // Store document notice directly
        documentNotices[documentId].encryptedIPFS = encryptedIPFS;
        documentNotices[documentId].decryptionKey = encryptionKey;
        documentNotices[documentId].authorizedViewer = recipient;
        documentNotices[documentId].alertId = alertId;
        documentNotices[documentId].isRestricted = true;
        
        // Store general notice
        notices[totalNotices].alertId = alertId;
        notices[totalNotices].documentId = documentId;
        notices[totalNotices].server = msg.sender;
        notices[totalNotices].recipient = recipient;
        notices[totalNotices].timestamp = block.timestamp;
        notices[totalNotices].acknowledged = false;
        notices[totalNotices].noticeType = noticeType;
        notices[totalNotices].caseNumber = caseNumber;
        
        // Mint tokens
        _mint(recipient, alertId);
        _mint(address(this), documentId);
        
        // Set metadata URIs
        _setTokenURI(alertId, string(abi.encodePacked("ipfs://", previewImage)));
        _setTokenURI(documentId, string(abi.encodePacked("ipfs://", encryptedIPFS)));
        
        // Assign server ID if needed
        if (serverIds[msg.sender] == 0) {
            serverIds[msg.sender] = _nextServerId;
            serverById[_nextServerId] = msg.sender;
            emit ProcessServerRegistered(msg.sender, _nextServerId++);
        }
        
        // Track
        recipientAlerts[recipient].push(alertId);
        serverNotices[msg.sender].push(totalNotices);
        userNotices[recipient].push(totalNotices++);
        
        // FIXED: Send sponsorship AFTER state changes
        uint256 sponsorAmount = sponsorFees ? sponsorshipFee : 0;
        uint256 feeAmount = msg.value - sponsorAmount;
        
        // Send fees to collector first (safer)
        if (feeAmount > 0) {
            (bool sent,) = payable(feeCollector).call{value: feeAmount}("");
            require(sent, "!Fee");
        }
        
        // Then send sponsorship
        if (sponsorAmount > 0) {
            (bool sent,) = payable(recipient).call{value: sponsorAmount}("");
            if (sent) {
                emit ResourceSponsored(recipient, 0, sponsorAmount);
            }
            // Don't revert if sponsorship fails - notice still served
        }
        
        emit NoticeServed(alertId, documentId, recipient);
        emit LegalNoticeCreated(totalNotices - 1, msg.sender, recipient, block.timestamp);
        
        return (alertId, documentId);
    }
    
    // Batch serve function - REMOVED TO SAVE SPACE
    // Users can call serveNotice multiple times instead
    
    // Set token URI for IPFS metadata
    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        _tokenURIs[tokenId] = uri;
    }
    
    // Token functions
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "!URI");
        return _tokenURIs[tokenId];
    }
    
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f;
    }
    
    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "!0Addr");
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "!TkOwn");
        return owner;
    }
    
    function name() public pure returns (string memory) {
        return "Legal Notice NFT";
    }
    
    function symbol() public pure returns (string memory) {
        return "NOTICE";
    }
    
    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(to != owner, "!Self");
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "!Auth");
        
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }
    
    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "!AprvQry");
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) public {
        require(operator != msg.sender, "!Caller");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "!Auth");
        _transfer(from, to, tokenId);
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        safeTransferFrom(from, to, tokenId, "");
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "!Auth");
        _safeTransfer(from, to, tokenId, _data);
    }
    
    // Access control functions with member tracking
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }
    
    function grantRole(bytes32 role, address account) external onlyAdmin {
        _grantRole(role, account);
    }
    
    function revokeRole(bytes32 role, address account) external onlyAdmin {
        _revokeRole(role, account);
    }
    
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _roles[role][account] = true;
            _roleMembers[role].push(account);
            _roleMemberIndex[role][account] = _roleMembers[role].length - 1;
            emit RoleGranted(role, account, msg.sender);
        }
    }
    
    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            _roles[role][account] = false;
            
            uint256 index = _roleMemberIndex[role][account];
            uint256 lastIndex = _roleMembers[role].length - 1;
            address lastMember = _roleMembers[role][lastIndex];
            
            _roleMembers[role][index] = lastMember;
            _roleMemberIndex[role][lastMember] = index;
            
            _roleMembers[role].pop();
            delete _roleMemberIndex[role][account];
            
            emit RoleRevoked(role, account, msg.sender);
        }
    }
    
    function getRoleMemberCount(bytes32 role) external view returns (uint256) {
        return _roleMembers[role].length;
    }
    
    function getRoleMember(bytes32 role, uint256 index) external view returns (address) {
        return _roleMembers[role][index];
    }
    
    // Fee functions WITH LIMITS
    function updateServiceFee(uint256 newFee) external onlyAdmin {
        require(newFee <= MAX_FEE, "!Max");
        uint256 oldFee = serviceFee;
        serviceFee = newFee;
        emit FeeUpdated("service", oldFee, newFee);
    }
    
    function updateCreationFee(uint256 newFee) external onlyAdmin {
        require(newFee <= MAX_FEE, "!Max");
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit FeeUpdated("creation", oldFee, newFee);
    }
    
    function updateSponsorshipFee(uint256 newFee) external onlyAdmin {
        require(newFee <= MAX_FEE, "!Max");
        uint256 oldFee = sponsorshipFee;
        sponsorshipFee = newFee;
        emit FeeUpdated("sponsorship", oldFee, newFee);
    }
    
    function updateFeeCollector(address newCollector) external onlyAdmin {
        require(newCollector != address(0), "!Collector");
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }
    
    // Notice functions
    function acceptNotice(uint256 alertId) external {
        AlertNotice storage alert = alertNotices[alertId];
        require(alert.recipient == msg.sender, "!NotRcpt");
        require(!alert.acknowledged, "Ack");
        
        alert.acknowledged = true;
        emit NoticeAcknowledged(alertId, msg.sender);
    }
    
    function getRecipientAlerts(address recipient) external view returns (uint256[] memory) {
        return recipientAlerts[recipient];
    }
    
    function getServerNotices(address server) external view returns (uint256[] memory) {
        return serverNotices[server];
    }
    
    function getRecipientNoticeIds(address recipient) external view returns (uint256[] memory) {
        return userNotices[recipient];
    }
    
    function calculateFee(address sender) public view returns (uint256) {
        if (fullFeeExemptions[sender]) return 0;
        if (serviceFeeExemptions[sender]) return creationFee;
        return serviceFee + creationFee;
    }
    
    // Record service attempt
    function recordServiceAttempt(uint256 noticeId, string memory note) external onlyAuthorized {
        require(notices[noticeId].server == msg.sender || hasRole(ADMIN_ROLE, msg.sender), "!Yours");
        require(!notices[noticeId].acknowledged, "Ack");
        
        serviceAttempts[noticeId]++;
        lastAttemptNote[noticeId] = note;
        
        emit ServiceAttemptRecorded(noticeId, serviceAttempts[noticeId], note);
    }
    
    // Exemption functions
    function setServiceFeeExemption(address account, bool exempt) external onlyAdmin {
        serviceFeeExemptions[account] = exempt;
    }
    
    function setFullFeeExemption(address account, bool exempt) external onlyAdmin {
        fullFeeExemptions[account] = exempt;
    }
    
    // View functions
    function alerts(uint256 alertId) external view returns (
        address recipient,
        address sender,
        uint256 documentId,
        uint256 timestamp,
        bool acknowledged,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory caseDetails,
        string memory legalRights,
        uint256 responseDeadline,
        string memory previewImage
    ) {
        AlertNotice memory alert = alertNotices[alertId];
        return (
            alert.recipient,
            alert.sender,
            alert.documentId,
            alert.timestamp,
            alert.acknowledged,
            alert.issuingAgency,
            alert.noticeType,
            alert.caseNumber,
            alert.caseDetails,
            alert.legalRights,
            alert.responseDeadline,
            alert.previewImage
        );
    }
    
    function getAlertDetails(uint256 alertId) external view returns (
        address recipient,
        address sender,
        uint256 documentId,
        uint256 timestamp,
        bool acknowledged,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory caseDetails,
        string memory legalRights,
        uint256 responseDeadline,
        string memory previewImage
    ) {
        AlertNotice memory alert = alertNotices[alertId];
        return (
            alert.recipient,
            alert.sender,
            alert.documentId,
            alert.timestamp,
            alert.acknowledged,
            alert.issuingAgency,
            alert.noticeType,
            alert.caseNumber,
            alert.caseDetails,
            alert.legalRights,
            alert.responseDeadline,
            alert.previewImage
        );
    }
    
    function documents(uint256 documentId) external view returns (
        string memory encryptedIPFS,
        string memory decryptionKey
    ) {
        DocumentNotice memory doc = documentNotices[documentId];
        require(doc.authorizedViewer == msg.sender || hasRole(ADMIN_ROLE, msg.sender), "!Auth");
        return (doc.encryptedIPFS, doc.decryptionKey);
    }
    
    // Emergency functions
    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    function withdrawTRX(uint256 amount) external onlyAdmin {
        require(amount <= address(this).balance, "!Balance");
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        require(sent, "!Sent");
    }
    
    function withdraw() external onlyAdmin {
        (bool sent,) = payable(msg.sender).call{value: address(this).balance}("");
        require(sent, "!Sent");
    }
    
    // Resource sponsorship
    function setResourceSponsorship(bool enabled) external onlyAdmin {
        resourceSponsorshipEnabled = enabled;
    }
    
    // Internal functions
    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "!0Mint");
        require(_owners[tokenId] == address(0), "!Mint2x");
        
        _balances[to]++;
        _owners[tokenId] = to;
        
        // Add to owner enumeration
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
        
        // Add to all tokens enumeration
        _allTokensIndex[tokenId] = _allTokens.length;
        _allTokens.push(tokenId);
        
        emit Transfer(address(0), to, tokenId);
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "!From");
        require(to != address(0), "!To0");
        
        // Clear approvals
        _tokenApprovals[tokenId] = address(0);
        
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        
        // Remove from sender enumeration
        uint256 lastTokenIndex = _ownedTokens[from].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];
        
        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];
            _ownedTokens[from][tokenIndex] = lastTokenId;
            _ownedTokensIndex[lastTokenId] = tokenIndex;
        }
        
        _ownedTokens[from].pop();
        delete _ownedTokensIndex[tokenId];
        
        // Add to receiver enumeration
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
        
        emit Transfer(from, to, tokenId);
    }
    
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory _data) internal {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "!ERC721Receiver");
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        require(_owners[tokenId] != address(0), "!OpToken");
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
    
    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory _data) private returns (bool) {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("!ERC721Receiver");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }
    
    // Enumerable functions
    function totalSupply() public view returns (uint256) {
        return _allTokens.length;
    }
    
    function tokenByIndex(uint256 index) public view returns (uint256) {
        require(index < totalSupply(), "!Idx");
        return _allTokens[index];
    }
    
    function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256) {
        require(index < balanceOf(owner), "!Idx");
        return _ownedTokens[owner][index];
    }
    
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }
    
    function getServerId(address server) external view returns (uint256) {
        return serverIds[server];
    }
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}