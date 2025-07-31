// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

/**
 * @title LegalNoticeNFT_v5_Optimized
 * @dev Optimized TRC721 contract for legal notices with enumerable support
 * Size optimizations implemented to fit within 24KB limit
 */

interface ITRC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface ITRC721 is ITRC165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function setApprovalForAll(address operator, bool _approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
}

contract LegalNoticeNFT_v5 is ITRC721 {
    // Token ownership
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // Enumerable support (CRITICAL FOR WALLET VISIBILITY)
    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;
    uint256[] private _allTokens;
    mapping(uint256 => uint256) private _allTokensIndex;
    
    // IPFS metadata
    mapping(uint256 => string) private _tokenURIs;
    
    // Notice types
    enum NoticeType { ALERT, DOCUMENT }
    
    // Optimized notice structure (removed duplicates)
    struct AlertNotice {
        address recipient;
        address sender;
        uint256 documentId;
        uint256 timestamp;
        bool acknowledged;
        string encryptedIPFS;
        string encryptionKey;
        string noticeType;
        string caseNumber;
    }
    
    // Role management
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    
    mapping(bytes32 => mapping(address => bool)) private _roles;
    
    // Fee management (using uint128 to save space)
    uint128 public creationFeeDocument = 150e6;
    uint128 public creationFeeAlert = 25e6;
    uint128 public acceptanceFee = 50e6;
    uint128 public emergencyRevokeFee = 300e6;
    mapping(address => bool) public feeExempt;
    
    // Server management (starting at 1 instead of 1000)
    mapping(address => uint16) public serverIds;
    mapping(uint16 => address) public serverAddresses;
    uint16 private _nextServerId = 1;
    
    // Notice tracking
    mapping(uint256 => AlertNotice) public alertNotices;
    mapping(uint256 => NoticeType) public tokenTypes;
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public serverNotices;
    mapping(address => uint256[]) public userNotices;
    
    // Service attempts
    mapping(uint256 => string[]) public serviceAttempts;
    
    // Contract state
    uint256 private _currentTokenId = 1;
    uint256 public totalNotices;
    string public name = "Legal Notice NFT";
    string public symbol = "LEGAL";
    
    // Events
    event NoticeServed(uint256 indexed alertId, uint256 indexed documentId, address indexed recipient);
    event LegalNoticeCreated(uint256 indexed noticeId, address indexed server, address indexed recipient, uint256 timestamp);
    event NoticeAccepted(uint256 indexed alertId, address indexed recipient, uint256 timestamp);
    event ServiceAttemptRecorded(uint256 indexed noticeId, string attemptNote, uint256 timestamp);
    
    // Modifiers
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "!A");
        _;
    }
    
    modifier onlyProcessServer() {
        require(hasRole(PROCESS_SERVER_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "!PS");
        _;
    }
    
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        serverIds[msg.sender] = _nextServerId++;
        serverAddresses[1] = msg.sender;
    }
    
    // Optimized single notice serving (removed duplicate code)
    function serveNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory encryptionKey,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory caseDetails,
        string memory legalRights,
        bool sponsorFees,
        string memory metadataURI
    ) external payable onlyProcessServer returns (uint256) {
        return _createNotice(
            recipient,
            encryptedIPFS,
            encryptionKey,
            issuingAgency,
            noticeType,
            caseNumber,
            caseDetails,
            legalRights,
            sponsorFees,
            metadataURI
        );
    }
    
    // Batch notice serving (using internal function)
    function serveNoticeBatch(Notice[] memory notices) external payable onlyProcessServer {
        uint256 totalFee = creationFeeDocument * notices.length;
        require(msg.value >= totalFee, "$");
        
        for (uint256 i = 0; i < notices.length; i++) {
            _createNotice(
                notices[i].recipient,
                notices[i].encryptedIPFS,
                notices[i].encryptionKey,
                notices[i].issuingAgency,
                notices[i].noticeType,
                notices[i].caseNumber,
                notices[i].caseDetails,
                notices[i].legalRights,
                notices[i].sponsorFees,
                notices[i].metadataURI
            );
        }
    }
    
    // Internal notice creation (eliminates duplication)
    function _createNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory encryptionKey,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory caseDetails,
        string memory legalRights,
        bool sponsorFees,
        string memory metadataURI
    ) internal returns (uint256) {
        require(recipient != address(0), "0");
        
        uint256 fee = bytes(encryptedIPFS).length > 0 ? creationFeeDocument : creationFeeAlert;
        if (!feeExempt[msg.sender]) {
            require(msg.value >= fee, "$");
        }
        
        uint256 alertId = _currentTokenId++;
        uint256 documentId = _currentTokenId++;
        uint256 noticeId = totalNotices++;
        
        // Store notice data
        alertNotices[alertId] = AlertNotice({
            recipient: recipient,
            sender: msg.sender,
            documentId: documentId,
            timestamp: block.timestamp,
            acknowledged: false,
            encryptedIPFS: encryptedIPFS,
            encryptionKey: encryptionKey,
            noticeType: noticeType,
            caseNumber: caseNumber
        });
        
        // Mint NFTs with enumerable support
        _mintWithEnumerable(recipient, alertId);
        _mintWithEnumerable(address(this), documentId);
        
        // Set metadata
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[alertId] = metadataURI;
        }
        
        // Set token types
        tokenTypes[alertId] = NoticeType.ALERT;
        tokenTypes[documentId] = NoticeType.DOCUMENT;
        
        // Track
        recipientAlerts[recipient].push(alertId);
        serverNotices[msg.sender].push(noticeId);
        userNotices[recipient].push(noticeId);
        
        // Sponsor fees
        if (sponsorFees && msg.value > fee) {
            payable(recipient).transfer(2e6);
        }
        
        // Events
        emit NoticeServed(alertId, documentId, recipient);
        emit LegalNoticeCreated(noticeId, msg.sender, recipient, block.timestamp);
        
        return alertId;
    }
    
    // Accept notice
    function acceptNotice(uint256 alertId) external returns (string memory) {
        AlertNotice storage alert = alertNotices[alertId];
        require(msg.sender == alert.recipient, "!R");
        require(!alert.acknowledged, "ACK");
        
        alert.acknowledged = true;
        
        if (alert.documentId != 0) {
            _transfer(address(this), msg.sender, alert.documentId);
        }
        
        emit NoticeAccepted(alertId, msg.sender, block.timestamp);
        return alert.encryptionKey;
    }
    
    // Role management
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }
    
    function grantRole(bytes32 role, address account) external onlyAdmin {
        _roles[role][account] = true;
        
        if (role == PROCESS_SERVER_ROLE && serverIds[account] == 0) {
            serverIds[account] = _nextServerId++;
            serverAddresses[serverIds[account]] = account;
        }
    }
    
    function _setupRole(bytes32 role, address account) internal {
        _roles[role][account] = true;
    }
    
    // Service attempts
    function recordServiceAttempt(uint256 noticeId, string memory attemptNote) external onlyProcessServer {
        serviceAttempts[noticeId].push(attemptNote);
        emit ServiceAttemptRecorded(noticeId, attemptNote, block.timestamp);
    }
    
    // TRC721 Implementation
    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "0");
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "!E");
        return owner;
    }
    
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "!A");
        _transfer(from, to, tokenId);
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "!A");
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "!R");
    }
    
    function approve(address to, uint256 tokenId) external {
        address owner = _owners[tokenId];
        require(to != owner, "=");
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "!A");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }
    
    function getApproved(uint256 tokenId) external view returns (address) {
        require(_owners[tokenId] != address(0), "!E");
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) external {
        require(operator != msg.sender, "=");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    // Mint with enumerable support
    function _mintWithEnumerable(address to, uint256 tokenId) internal {
        require(to != address(0), "0");
        require(_owners[tokenId] == address(0), "E");
        
        _balances[to]++;
        _owners[tokenId] = to;
        
        // Add enumerable tracking
        _addTokenToOwnerEnumeration(to, tokenId);
        _addTokenToAllTokensEnumeration(tokenId);
        
        emit Transfer(address(0), to, tokenId);
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        require(_owners[tokenId] == from, "!O");
        require(to != address(0), "0");
        
        _tokenApprovals[tokenId] = address(0);
        
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        
        // Update enumerable tracking
        _removeTokenFromOwnerEnumeration(from, tokenId);
        _addTokenToOwnerEnumeration(to, tokenId);
        
        emit Transfer(from, to, tokenId);
    }
    
    // Enumerable functions for wallet visibility
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256) {
        require(index < _balances[owner], "OOB");
        return _ownedTokens[owner][index];
    }
    
    function totalSupply() external view returns (uint256) {
        return _allTokens.length;
    }
    
    function tokenByIndex(uint256 index) external view returns (uint256) {
        require(index < _allTokens.length, "OOB");
        return _allTokens[index];
    }
    
    // Get all tokens owned by address (useful for wallets)
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }
    
    // Enumerable helpers
    function _addTokenToOwnerEnumeration(address to, uint256 tokenId) private {
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
    }
    
    function _addTokenToAllTokensEnumeration(uint256 tokenId) private {
        _allTokensIndex[tokenId] = _allTokens.length;
        _allTokens.push(tokenId);
    }
    
    function _removeTokenFromOwnerEnumeration(address from, uint256 tokenId) private {
        uint256 lastTokenIndex = _ownedTokens[from].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];
        
        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];
            _ownedTokens[from][tokenIndex] = lastTokenId;
            _ownedTokensIndex[lastTokenId] = tokenIndex;
        }
        
        _ownedTokens[from].pop();
        delete _ownedTokensIndex[tokenId];
    }
    
    // Metadata
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "!E");
        return _tokenURIs[tokenId]; // Return stored URI or empty string
    }
    
    // Helpers
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        require(_owners[tokenId] != address(0), "!E");
        address owner = _owners[tokenId];
        return (spender == owner || _tokenApprovals[tokenId] == spender || isApprovedForAll(owner, spender));
    }
    
    function _checkOnERC721Received(address, address, uint256, bytes memory) private pure returns (bool) {
        return true; // Simplified
    }
    
    // Interface support
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd || // TRC721
               interfaceId == 0x5b5e139f || // TRC721Metadata
               interfaceId == 0x780e9d63 || // TRC721Enumerable
               interfaceId == 0x01ffc9a7;   // TRC165
    }
    
    // Notice struct for batch operations
    struct Notice {
        address recipient;
        string encryptedIPFS;
        string encryptionKey;
        string issuingAgency;
        string noticeType;
        string caseNumber;
        string caseDetails;
        string legalRights;
        bool sponsorFees;
        string metadataURI;
    }
    
    // Owner functions
    function withdraw(uint256 amount) external onlyAdmin {
        require(amount <= address(this).balance, "$");
        payable(msg.sender).transfer(amount);
    }
    
    function setFees(uint128 _doc, uint128 _alert, uint128 _accept, uint128 _revoke) external {
        require(hasRole(FEE_MANAGER_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "!FM");
        creationFeeDocument = _doc;
        creationFeeAlert = _alert;
        acceptanceFee = _accept;
        emergencyRevokeFee = _revoke;
    }
    
    function setFeeExemption(address account, bool exempt) external onlyAdmin {
        feeExempt[account] = exempt;
    }
}