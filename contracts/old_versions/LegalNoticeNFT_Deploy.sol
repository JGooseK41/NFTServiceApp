// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LegalNoticeNFT_Deploy {
    // Token tracking
    uint256 private _currentTokenId = 1;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
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
    }
    
    struct DocumentNotice {
        string encryptedIPFS;
        string decryptionKey;
        address authorizedViewer;
        uint256 alertId;
        bool isRestricted;
    }
    
    // Storage mappings
    mapping(uint256 => NoticeType) public tokenTypes;
    mapping(uint256 => AlertNotice) public alertNotices;
    mapping(uint256 => DocumentNotice) public documentNotices;
    mapping(address => uint256[]) public recipientAlerts;
    
    // Fee management
    uint256 public constant SERVICE_FEE = 22 * 10**6; // 22 TRX in SUN
    mapping(address => bool) public serviceFeeExemptions;
    mapping(address => bool) public fullFeeExemptions;
    
    // Role management
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    mapping(bytes32 => mapping(address => bool)) private _roles;
    
    // Resource sponsorship
    mapping(address => uint256) public sponsoredEnergy;
    mapping(address => uint256) public sponsoredBandwidth;
    
    // Events - TRC721
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // Events - Legal Notice
    event NoticeServed(uint256 indexed alertId, uint256 indexed documentId, address indexed recipient);
    event NoticeAcknowledged(uint256 indexed alertId, address indexed recipient);
    event ResourceSponsored(address indexed recipient, uint256 energy, uint256 bandwidth);
    event RoleGranted(bytes32 indexed role, address indexed account);
    event FeeExemptionSet(address indexed user, bool serviceFeeExempt, bool fullFeeExempt);
    
    // Constructor
    constructor() {
        _roles[ADMIN_ROLE][msg.sender] = true;
        emit RoleGranted(ADMIN_ROLE, msg.sender);
    }
    
    // Main function: Serve notice with view-gating
    function serveNotice(
        address recipient,
        string memory encryptedIPFS,
        string memory decryptionKey,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory caseDetails,
        string memory legalRights,
        bool sponsorFees
    ) public payable returns (uint256 alertId, uint256 documentId) {
        // Calculate required fee
        uint256 requiredFee = calculateFee(msg.sender);
        require(msg.value >= requiredFee, "Insufficient fee");
        
        // Create alert NFT
        alertId = _currentTokenId++;
        _mint(recipient, alertId);
        tokenTypes[alertId] = NoticeType.ALERT;
        
        // Create document NFT
        documentId = _currentTokenId++;
        _mint(address(this), documentId);
        tokenTypes[documentId] = NoticeType.DOCUMENT;
        
        // Store alert data
        alertNotices[alertId] = AlertNotice({
            recipient: recipient,
            sender: msg.sender,
            documentId: documentId,
            timestamp: block.timestamp,
            acknowledged: false,
            issuingAgency: issuingAgency,
            noticeType: noticeType,
            caseNumber: caseNumber,
            caseDetails: caseDetails,
            legalRights: legalRights,
            responseDeadline: block.timestamp + 30 days
        });
        
        // Store document data
        documentNotices[documentId] = DocumentNotice({
            encryptedIPFS: encryptedIPFS,
            decryptionKey: decryptionKey,
            authorizedViewer: recipient,
            alertId: alertId,
            isRestricted: true
        });
        
        // Track recipient alerts
        recipientAlerts[recipient].push(alertId);
        
        // Handle resource sponsorship
        if (sponsorFees && msg.value > requiredFee) {
            uint256 sponsorAmount = msg.value - requiredFee;
            sponsoredEnergy[recipient] += sponsorAmount / 2;
            sponsoredBandwidth[recipient] += sponsorAmount / 2;
            emit ResourceSponsored(recipient, sponsorAmount / 2, sponsorAmount / 2);
        }
        
        emit NoticeServed(alertId, documentId, recipient);
        
        // Refund excess
        if (msg.value > requiredFee && !sponsorFees) {
            payable(msg.sender).transfer(msg.value - requiredFee);
        }
    }
    
    // Accept/acknowledge notice
    function acceptNotice(uint256 alertId) public {
        AlertNotice storage alert = alertNotices[alertId];
        require(alert.recipient == msg.sender, "Not the recipient");
        require(!alert.acknowledged, "Already acknowledged");
        
        alert.acknowledged = true;
        
        // Transfer document NFT to recipient
        _transfer(address(this), msg.sender, alert.documentId);
        
        emit NoticeAcknowledged(alertId, msg.sender);
    }
    
    // View document (requires ownership)
    function viewDocument(uint256 documentId) public view returns (
        string memory encryptedIPFS,
        string memory decryptionKey
    ) {
        require(ownerOf(documentId) == msg.sender, "Not authorized");
        DocumentNotice memory doc = documentNotices[documentId];
        return (doc.encryptedIPFS, doc.decryptionKey);
    }
    
    // Get alert details
    function getAlertDetails(uint256 alertId) public view returns (
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
        uint256 responseDeadline
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
            alert.responseDeadline
        );
    }
    
    // Fee calculation
    function calculateFee(address user) public view returns (uint256) {
        if (fullFeeExemptions[user]) {
            return 0;
        } else if (serviceFeeExemptions[user]) {
            return SERVICE_FEE / 2;
        }
        return SERVICE_FEE;
    }
    
    // Admin functions
    function setFeeExemption(address user, bool serviceFeeExempt, bool fullFeeExempt) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        serviceFeeExemptions[user] = serviceFeeExempt;
        fullFeeExemptions[user] = fullFeeExempt;
        emit FeeExemptionSet(user, serviceFeeExempt, fullFeeExempt);
    }
    
    function grantRole(bytes32 role, address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        _roles[role][account] = true;
        emit RoleGranted(role, account);
    }
    
    function revokeRole(bytes32 role, address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        _roles[role][account] = false;
    }
    
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }
    
    // Withdraw fees
    function withdraw() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        payable(msg.sender).transfer(address(this).balance);
    }
    
    // Get recipient's alerts
    function getRecipientAlerts(address recipient) public view returns (uint256[] memory) {
        return recipientAlerts[recipient];
    }
    
    // TRC-721 Implementation
    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "Invalid address");
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }
    
    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(to != owner, "Approval to current owner");
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "Not authorized");
        
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }
    
    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) public {
        require(operator != msg.sender, "Approve to caller");
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
        safeTransferFrom(from, to, tokenId, "");
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public {
        transferFrom(from, to, tokenId);
        require(_checkOnTRC721Received(from, to, tokenId, _data), "Transfer to non TRC721Receiver");
    }
    
    // TRC-721 Metadata
    function name() public pure returns (string memory) {
        return "Legal Notice NFT";
    }
    
    function symbol() public pure returns (string memory) {
        return "LEGAL";
    }
    
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        
        if (tokenTypes[tokenId] == NoticeType.ALERT) {
            return string(abi.encodePacked("data:application/json;base64,", 
                _encodeBase64(abi.encodePacked(
                    '{"name":"Legal Notice Alert #', _toString(tokenId), 
                    '","description":"Alert for legal notice delivery",',
                    '"attributes":[{"trait_type":"Type","value":"Alert"}]}'
                ))
            ));
        } else {
            return string(abi.encodePacked("data:application/json;base64,", 
                _encodeBase64(abi.encodePacked(
                    '{"name":"Legal Document #', _toString(tokenId), 
                    '","description":"View-gated legal document",',
                    '"attributes":[{"trait_type":"Type","value":"Document"}]}'
                ))
            ));
        }
    }
    
    // TRC-165 Support
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        // TRC721: 0x80ac58cd
        // TRC721Metadata: 0x5b5e139f
        // TRC165: 0x01ffc9a7
        return interfaceId == 0x80ac58cd || 
               interfaceId == 0x5b5e139f ||
               interfaceId == 0x01ffc9a7;
    }
    
    // Internal functions
    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Mint to zero address");
        require(_owners[tokenId] == address(0), "Token already exists");
        
        _balances[to]++;
        _owners[tokenId] = to;
        
        emit Transfer(address(0), to, tokenId);
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "Transfer of token that is not own");
        require(to != address(0), "Transfer to zero address");
        
        // Clear approvals
        _tokenApprovals[tokenId] = address(0);
        
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        
        emit Transfer(from, to, tokenId);
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
    
    function _checkOnTRC721Received(address from, address to, uint256 tokenId, bytes memory _data) 
        private pure returns (bool) {
        // Simplified check - in production would call onTRC721Received
        return true;
    }
    
    // Helper functions
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    function _encodeBase64(bytes memory data) internal pure returns (string memory) {
        // Simplified base64 encoding - in production use proper library
        return string(data);
    }
}