// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LegalNoticeNFT_Complete {
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
        string previewImage; // Added for UI compatibility
    }
    
    struct DocumentNotice {
        string encryptedIPFS;
        string decryptionKey;
        address authorizedViewer;
        uint256 alertId;
        bool isRestricted;
    }
    
    // Unified notice structure for easier access
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
    mapping(uint256 => NoticeType) public tokenTypes;
    mapping(uint256 => AlertNotice) public alertNotices;
    mapping(uint256 => DocumentNotice) public documentNotices;
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public serverNotices; // Track notices by server
    mapping(uint256 => Notice) public notices; // Unified notice access
    uint256 public totalNotices;
    
    // Fee management - now updatable
    uint256 public serviceFee = 20 * 10**6; // 20 TRX in SUN (updatable)
    uint256 public creationFee = 0; // Additional creation fee
    uint256 public sponsorshipFee = 2 * 10**6; // 2 TRX for sponsorship
    address public feeCollector; // Where fees go
    mapping(address => bool) public serviceFeeExemptions;
    mapping(address => bool) public fullFeeExemptions;
    
    // Role management
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    mapping(bytes32 => mapping(address => bool)) private _roles;
    
    // Resource sponsorship
    mapping(address => uint256) public sponsoredEnergy;
    mapping(address => uint256) public sponsoredBandwidth;
    bool public resourceSponsorshipEnabled = true;
    
    // Events - TRC721
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // Events - Legal Notice
    event NoticeServed(uint256 indexed alertId, uint256 indexed documentId, address indexed recipient);
    event LegalNoticeCreated(uint256 indexed noticeId, address indexed server, address indexed recipient, uint256 timestamp);
    event NoticeAcknowledged(uint256 indexed alertId, address indexed recipient);
    event ResourceSponsored(address indexed recipient, uint256 energy, uint256 bandwidth);
    event RoleGranted(bytes32 indexed role, address indexed account);
    event FeeExemptionSet(address indexed user, bool serviceFeeExempt, bool fullFeeExempt);
    event FeeUpdated(string feeType, uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    
    // Constructor
    constructor() {
        _roles[ADMIN_ROLE][msg.sender] = true;
        feeCollector = msg.sender;
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
        if (sponsorFees && resourceSponsorshipEnabled) {
            requiredFee += sponsorshipFee;
        }
        require(msg.value >= requiredFee, "Insufficient fee");
        
        // Create tokens
        alertId = _currentTokenId++;
        documentId = _currentTokenId++;
        
        // Mint NFTs
        _mint(recipient, alertId);
        _mint(address(this), documentId);
        
        // Set token types
        tokenTypes[alertId] = NoticeType.ALERT;
        tokenTypes[documentId] = NoticeType.DOCUMENT;
        
        // Store alert data
        _storeAlertData(
            alertId, 
            recipient, 
            documentId, 
            issuingAgency, 
            noticeType, 
            caseNumber, 
            caseDetails, 
            legalRights
        );
        
        // Store document data
        _storeDocumentData(documentId, encryptedIPFS, decryptionKey, recipient, alertId);
        
        // Track notices
        recipientAlerts[recipient].push(alertId);
        serverNotices[msg.sender].push(alertId);
        
        // Create unified notice
        _createUnifiedNotice(alertId, documentId, msg.sender, recipient, noticeType, caseNumber);
        
        // Handle sponsorship
        if (sponsorFees && resourceSponsorshipEnabled) {
            _handleSponsorship(recipient);
        }
        
        // Transfer fees
        if (feeCollector != address(0) && requiredFee > 0) {
            payable(feeCollector).transfer(requiredFee);
        }
        
        // Emit events
        emit NoticeServed(alertId, documentId, recipient);
        emit LegalNoticeCreated(totalNotices - 1, msg.sender, recipient, block.timestamp);
        
        // Refund excess
        if (msg.value > requiredFee) {
            payable(msg.sender).transfer(msg.value - requiredFee);
        }
        
        return (alertId, documentId);
    }
    
    // Helper function to store alert data
    function _storeAlertData(
        uint256 alertId,
        address recipient,
        uint256 documentId,
        string memory issuingAgency,
        string memory noticeType,
        string memory caseNumber,
        string memory caseDetails,
        string memory legalRights
    ) private {
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
            responseDeadline: block.timestamp + 30 days,
            previewImage: ""
        });
    }
    
    // Helper function to store document data
    function _storeDocumentData(
        uint256 documentId,
        string memory encryptedIPFS,
        string memory decryptionKey,
        address recipient,
        uint256 alertId
    ) private {
        documentNotices[documentId] = DocumentNotice({
            encryptedIPFS: encryptedIPFS,
            decryptionKey: decryptionKey,
            authorizedViewer: recipient,
            alertId: alertId,
            isRestricted: true
        });
    }
    
    // Helper function to create unified notice
    function _createUnifiedNotice(
        uint256 alertId,
        uint256 documentId,
        address server,
        address recipient,
        string memory noticeType,
        string memory caseNumber
    ) private {
        uint256 noticeId = totalNotices++;
        notices[noticeId] = Notice({
            alertId: alertId,
            documentId: documentId,
            server: server,
            recipient: recipient,
            timestamp: block.timestamp,
            acknowledged: false,
            noticeType: noticeType,
            caseNumber: caseNumber
        });
    }
    
    // Helper function to handle sponsorship
    function _handleSponsorship(address recipient) private {
        uint256 sponsorAmount = sponsorshipFee;
        sponsoredEnergy[recipient] += sponsorAmount / 2;
        sponsoredBandwidth[recipient] += sponsorAmount / 2;
        emit ResourceSponsored(recipient, sponsorAmount / 2, sponsorAmount / 2);
    }
    
    // Accept/acknowledge notice
    function acceptNotice(uint256 alertId) public {
        AlertNotice storage alert = alertNotices[alertId];
        require(alert.recipient == msg.sender, "Not the recipient");
        require(!alert.acknowledged, "Already acknowledged");
        
        alert.acknowledged = true;
        
        // Update unified notice
        for (uint256 i = 0; i < totalNotices; i++) {
            if (notices[i].alertId == alertId) {
                notices[i].acknowledged = true;
                break;
            }
        }
        
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
    
    // Get alert details (public function matching UI expectations)
    function alerts(uint256 alertId) public view returns (
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
    
    // Maintain compatibility with old function name
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
    
    // Get notices by user (recipient)
    function getUserNotices(address user) public view returns (uint256[] memory) {
        return recipientAlerts[user];
    }
    
    // Get notices by server
    function getServerNotices(address server) public view returns (uint256[] memory) {
        return serverNotices[server];
    }
    
    // Fee calculation
    function calculateFee(address user) public view returns (uint256) {
        if (fullFeeExemptions[user]) {
            return creationFee; // Only pay creation fee if fully exempt from service fee
        } else if (serviceFeeExemptions[user]) {
            return creationFee + (serviceFee / 2); // Half service fee + creation fee
        }
        return creationFee + serviceFee; // Full fees
    }
    
    // Get total fee components
    function SERVICE_FEE() public view returns (uint256) {
        return serviceFee;
    }
    
    // Admin functions
    function setFeeExemption(address user, bool serviceFeeExempt, bool fullFeeExempt) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        serviceFeeExemptions[user] = serviceFeeExempt;
        fullFeeExemptions[user] = fullFeeExempt;
        emit FeeExemptionSet(user, serviceFeeExempt, fullFeeExempt);
    }
    
    // Update fees
    function updateServiceFee(uint256 newFee) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        uint256 oldFee = serviceFee;
        serviceFee = newFee;
        emit FeeUpdated("service", oldFee, newFee);
    }
    
    function updateCreationFee(uint256 newFee) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit FeeUpdated("creation", oldFee, newFee);
    }
    
    function updateSponsorshipFee(uint256 newFee) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        uint256 oldFee = sponsorshipFee;
        sponsorshipFee = newFee;
        emit FeeUpdated("sponsorship", oldFee, newFee);
    }
    
    // Backwards compatibility
    function updateFee(uint256 newFee) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        uint256 oldFee = serviceFee;
        serviceFee = newFee;
        emit FeeUpdated("service", oldFee, newFee);
    }
    
    // Update fee collector
    function updateFeeCollector(address newCollector) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        require(newCollector != address(0), "Invalid collector");
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }
    
    // Resource sponsorship control
    function setResourceSponsorship(bool enabled) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        resourceSponsorshipEnabled = enabled;
    }
    
    // Role management
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
    
    // Withdraw functions
    function withdraw() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        payable(msg.sender).transfer(balance);
    }
    
    function withdrawTRX(uint256 amount) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        require(amount <= address(this).balance, "Insufficient balance");
        payable(msg.sender).transfer(amount);
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
            AlertNotice memory alert = alertNotices[tokenId];
            return string(abi.encodePacked("data:application/json;base64,", 
                _encodeBase64(abi.encodePacked(
                    '{"name":"', alert.noticeType, ' #', _toString(tokenId), 
                    '","description":"', alert.issuingAgency, ' - ', alert.caseNumber,
                    '","attributes":[{"trait_type":"Type","value":"Alert"},',
                    '{"trait_type":"Agency","value":"', alert.issuingAgency, '"},',
                    '{"trait_type":"Case","value":"', alert.caseNumber, '"}]}'
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
        return interfaceId == 0x80ac58cd || // TRC721
               interfaceId == 0x5b5e139f || // TRC721Metadata
               interfaceId == 0x01ffc9a7;   // TRC165
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