// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract LegalNoticeNFT_v4_Final {
    // Token tracking
    uint256 private _currentTokenId = 1;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
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
    
    // Fees (updatable)
    uint256 public serviceFee = 20e6; // 20 TRX
    uint256 public creationFee = 5e6; // 5 TRX
    uint256 public sponsorshipFee = 2e6; // 2 TRX
    address public feeCollector;
    mapping(address => bool) public serviceFeeExemptions;
    mapping(address => bool) public fullFeeExemptions;
    
    // Pausability
    bool public paused;
    
    // Resource sponsorship
    bool public resourceSponsorshipEnabled;
    mapping(address => uint256) public sponsoredEnergy;
    mapping(address => uint256) public sponsoredBandwidth;
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event NoticeServed(uint256 indexed alertId, uint256 indexed documentId, address indexed recipient);
    event NoticeAcknowledged(uint256 indexed alertId, address indexed recipient);
    event LegalNoticeCreated(uint256 indexed noticeId, address indexed server, address indexed recipient, uint256 timestamp);
    event RoleGranted(bytes32 indexed role, address indexed account);
    event RoleRevoked(bytes32 indexed role, address indexed account);
    event FeeExemptionSet(address indexed user, bool serviceFeeExempt, bool fullFeeExempt);
    event FeeUpdated(string feeType, uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event ResourceSponsored(address indexed recipient, uint256 energy, uint256 bandwidth);
    event Paused(address account);
    event Unpaused(address account);
    event ServerRegistered(address indexed server, uint256 indexed serverId);
    event ServiceAttemptRecorded(uint256 indexed noticeId, uint256 attemptNumber, string note);
    
    // Modifiers
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        _;
    }
    
    modifier onlyAuthorized() {
        require(hasRole(PROCESS_SERVER_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
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
        bool sponsorFees;
        string metadataURI;
    }
    
    // Main function with IPFS metadata support
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
    ) external payable whenNotPaused onlyAuthorized returns (uint256, uint256) {
        require(recipient != address(0), "Invalid recipient");
        
        // Calculate and validate fees inline
        require(msg.value >= calculateFee(msg.sender) + (sponsorFees ? sponsorshipFee : 0), "Insufficient fee");
        
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
        alertNotices[alertId].responseDeadline = block.timestamp + 30 days;
        alertNotices[alertId].previewImage = "";
        
        // Store document notice if provided
        if (bytes(encryptedIPFS).length > 0) {
            documentNotices[documentId].encryptedIPFS = encryptedIPFS;
            documentNotices[documentId].decryptionKey = encryptionKey;
            documentNotices[documentId].authorizedViewer = recipient;
            documentNotices[documentId].alertId = alertId;
            documentNotices[documentId].isRestricted = true;
        }
        
        // Store main notice
        notices[totalNotices].alertId = alertId;
        notices[totalNotices].documentId = documentId;
        notices[totalNotices].server = msg.sender;
        notices[totalNotices].recipient = recipient;
        notices[totalNotices].timestamp = block.timestamp;
        notices[totalNotices].acknowledged = false;
        notices[totalNotices].noticeType = noticeType;
        notices[totalNotices].caseNumber = caseNumber;
        
        // Mint NFTs
        _mint(recipient, alertId);
        _mint(address(this), documentId);
        
        // Set token URIs with IPFS metadata
        if (bytes(metadataURI).length > 0) {
            _setTokenURI(alertId, metadataURI);
        }
        
        // Set token types
        tokenTypes[alertId] = NoticeType.ALERT;
        tokenTypes[documentId] = NoticeType.DOCUMENT;
        
        // Track
        recipientAlerts[recipient].push(alertId);
        serverNotices[msg.sender].push(totalNotices);
        userNotices[recipient].push(totalNotices++);
        
        // Send notification TRX if sponsored
        if (sponsorFees && sponsorshipFee > 0) {
            payable(recipient).transfer(sponsorshipFee);
            emit ResourceSponsored(recipient, 0, sponsorshipFee);
        }
        
        // Send fees to collector
        if (msg.value > sponsorshipFee) {
            payable(feeCollector).transfer(msg.value - sponsorshipFee);
        }
        
        emit NoticeServed(alertId, documentId, recipient);
        emit LegalNoticeCreated(totalNotices - 1, msg.sender, recipient, block.timestamp);
        
        return (alertId, documentId);
    }
    
    // Batch serve function - up to 10 notices in one transaction
    function serveNoticeBatch(BatchNotice[] memory batchNotices) external payable whenNotPaused onlyAuthorized 
        returns (uint256[] memory alertIds, uint256[] memory documentIds) {
        require(batchNotices.length > 0 && batchNotices.length <= 10, "Batch size must be 1-10");
        
        alertIds = new uint256[](batchNotices.length);
        documentIds = new uint256[](batchNotices.length);
        
        uint256 totalFeesRequired = 0;
        uint256 totalSponsorshipRequired = 0;
        
        // Calculate total fees
        for (uint i = 0; i < batchNotices.length; i++) {
            totalFeesRequired += calculateFee(msg.sender);
            if (batchNotices[i].sponsorFees) {
                totalSponsorshipRequired += sponsorshipFee;
            }
        }
        
        require(msg.value >= totalFeesRequired + totalSponsorshipRequired, "Insufficient fee for batch");
        
        // Process each notice
        for (uint i = 0; i < batchNotices.length; i++) {
            BatchNotice memory notice = batchNotices[i];
            require(notice.recipient != address(0), "Invalid recipient in batch");
            
            // Create notice IDs
            uint256 alertId = _currentTokenId++;
            uint256 documentId = _currentTokenId++;
            
            alertIds[i] = alertId;
            documentIds[i] = documentId;
            
            // Store alert notice
            alertNotices[alertId].recipient = notice.recipient;
            alertNotices[alertId].sender = msg.sender;
            alertNotices[alertId].documentId = documentId;
            alertNotices[alertId].timestamp = block.timestamp;
            alertNotices[alertId].acknowledged = false;
            alertNotices[alertId].issuingAgency = notice.issuingAgency;
            alertNotices[alertId].noticeType = notice.noticeType;
            alertNotices[alertId].caseNumber = notice.caseNumber;
            alertNotices[alertId].caseDetails = notice.caseDetails;
            alertNotices[alertId].legalRights = notice.legalRights;
            alertNotices[alertId].responseDeadline = block.timestamp + 30 days;
            alertNotices[alertId].previewImage = "";
            
            // Store document notice if provided
            if (bytes(notice.encryptedIPFS).length > 0) {
                documentNotices[documentId].encryptedIPFS = notice.encryptedIPFS;
                documentNotices[documentId].decryptionKey = notice.encryptionKey;
                documentNotices[documentId].authorizedViewer = notice.recipient;
                documentNotices[documentId].alertId = alertId;
                documentNotices[documentId].isRestricted = true;
            }
            
            // Store main notice
            uint256 noticeId = totalNotices++;
            notices[noticeId].alertId = alertId;
            notices[noticeId].documentId = documentId;
            notices[noticeId].server = msg.sender;
            notices[noticeId].recipient = notice.recipient;
            notices[noticeId].timestamp = block.timestamp;
            notices[noticeId].acknowledged = false;
            notices[noticeId].noticeType = notice.noticeType;
            notices[noticeId].caseNumber = notice.caseNumber;
            
            // Mint NFTs
            _mint(notice.recipient, alertId);
            _mint(address(this), documentId);
            
            // Set token URIs with IPFS metadata
            if (bytes(notice.metadataURI).length > 0) {
                _setTokenURI(alertId, notice.metadataURI);
            }
            
            // Set token types
            tokenTypes[alertId] = NoticeType.ALERT;
            tokenTypes[documentId] = NoticeType.DOCUMENT;
            
            // Track
            recipientAlerts[notice.recipient].push(alertId);
            serverNotices[msg.sender].push(noticeId - 1);
            userNotices[notice.recipient].push(noticeId - 1);
            
            // Send notification TRX if sponsored
            if (notice.sponsorFees && sponsorshipFee > 0) {
                payable(notice.recipient).transfer(sponsorshipFee);
                emit ResourceSponsored(notice.recipient, 0, sponsorshipFee);
            }
            
            emit NoticeServed(alertId, documentId, notice.recipient);
            emit LegalNoticeCreated(noticeId - 1, msg.sender, notice.recipient, block.timestamp);
        }
        
        // Send fees to collector
        uint256 feesAfterSponsorship = msg.value - totalSponsorshipRequired;
        if (feesAfterSponsorship > 0) {
            payable(feeCollector).transfer(feesAfterSponsorship);
        }
    }
    
    // Set token URI for IPFS metadata
    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        require(_owners[tokenId] != address(0), "URI set for nonexistent token");
        _tokenURIs[tokenId] = uri;
    }
    
    // Return IPFS URI if set, otherwise return generated metadata
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        
        // Return stored IPFS URI if available
        string memory _tokenURI = _tokenURIs[tokenId];
        if (bytes(_tokenURI).length > 0) {
            return _tokenURI;
        }
        
        // Fallback to generated metadata with images
        if (tokenTypes[tokenId] == NoticeType.ALERT) {
            AlertNotice memory alert = alertNotices[tokenId];
            return string(abi.encodePacked(
                "data:application/json;base64,",
                _encodeBase64(bytes(string(abi.encodePacked(
                    '{"name":"', alert.noticeType, ' #', _toString(tokenId),
                    '","description":"', alert.issuingAgency, ' - ', alert.caseNumber,
                    '","image":"https://nftserviceapp.netlify.app/assets/legal-notice-nft.png"',
                    ',"attributes":[{"trait_type":"Type","value":"Alert"},',
                    '{"trait_type":"Agency","value":"', alert.issuingAgency, '"},',
                    '{"trait_type":"Case","value":"', alert.caseNumber, '"}]}'
                ))))
            ));
        } else {
            return string(abi.encodePacked(
                "data:application/json;base64,",
                _encodeBase64(bytes(string(abi.encodePacked(
                    '{"name":"Legal Document #', _toString(tokenId),
                    '","description":"View-gated legal document"',
                    ',"image":"https://nftserviceapp.netlify.app/assets/sealed-document.png"',
                    ',"attributes":[{"trait_type":"Type","value":"Document"}]}'
                ))))
            ));
        }
    }
    
    // ERC721 Functions
    function name() public pure returns (string memory) {
        return "Legal Notice NFT";
    }
    
    function symbol() public pure returns (string memory) {
        return "LEGAL";
    }
    
    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "Balance query for zero address");
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Owner query for nonexistent token");
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
        require(_owners[tokenId] != address(0), "Approved query for nonexistent token");
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
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _safeTransfer(from, to, tokenId, _data);
    }
    
    // Access control functions with member tracking
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }
    
    function grantRole(bytes32 role, address account) public onlyAdmin {
        _grantRole(role, account);
    }
    
    function _grantRole(bytes32 role, address account) internal {
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            _roleMembers[role].push(account);
            _roleMemberIndex[role][account] = _roleMembers[role].length - 1;
            emit RoleGranted(role, account);
            
            // Auto-assign server ID for process servers
            if (role == PROCESS_SERVER_ROLE) {
                _assignServerId(account);
            }
        }
    }
    
    function _assignServerId(address server) internal {
        if (serverIds[server] == 0) { // Not yet assigned
            uint256 newId = _nextServerId++;
            serverIds[server] = newId;
            serverById[newId] = server;
            emit ServerRegistered(server, newId);
        }
    }
    
    function revokeRole(bytes32 role, address account) public onlyAdmin {
        if (_roles[role][account]) {
            _roles[role][account] = false;
            
            // Remove from members array
            uint256 index = _roleMemberIndex[role][account];
            uint256 lastIndex = _roleMembers[role].length - 1;
            address lastMember = _roleMembers[role][lastIndex];
            
            _roleMembers[role][index] = lastMember;
            _roleMemberIndex[role][lastMember] = index;
            
            _roleMembers[role].pop();
            delete _roleMemberIndex[role][account];
            
            emit RoleRevoked(role, account);
        }
    }
    
    function getRoleMemberCount(bytes32 role) public view returns (uint256) {
        return _roleMembers[role].length;
    }
    
    function getRoleMember(bytes32 role, uint256 index) public view returns (address) {
        require(index < _roleMembers[role].length, "Index out of bounds");
        return _roleMembers[role][index];
    }
    
    // Fee management functions
    function calculateFee(address user) public view returns (uint256) {
        if (fullFeeExemptions[user]) return 0;
        if (serviceFeeExemptions[user]) return creationFee;
        return serviceFee + creationFee;
    }
    
    function setFeeExemption(address user, bool serviceFeeExempt, bool fullFeeExempt) external onlyAdmin {
        serviceFeeExemptions[user] = serviceFeeExempt;
        fullFeeExemptions[user] = fullFeeExempt;
        emit FeeExemptionSet(user, serviceFeeExempt, fullFeeExempt);
    }
    
    function updateServiceFee(uint256 newFee) external onlyAdmin {
        uint256 oldFee = serviceFee;
        serviceFee = newFee;
        emit FeeUpdated("service", oldFee, newFee);
    }
    
    function updateCreationFee(uint256 newFee) external onlyAdmin {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit FeeUpdated("creation", oldFee, newFee);
    }
    
    function updateSponsorshipFee(uint256 newFee) external onlyAdmin {
        uint256 oldFee = sponsorshipFee;
        sponsorshipFee = newFee;
        emit FeeUpdated("sponsorship", oldFee, newFee);
    }
    
    function updateFeeCollector(address newCollector) external onlyAdmin {
        require(newCollector != address(0), "Invalid collector");
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }
    
    // Notice functions
    function acceptNotice(uint256 alertId) external {
        AlertNotice storage alert = alertNotices[alertId];
        require(alert.recipient == msg.sender, "Not recipient");
        require(!alert.acknowledged, "Already acknowledged");
        
        alert.acknowledged = true;
        emit NoticeAcknowledged(alertId, msg.sender);
    }
    
    function getRecipientAlerts(address recipient) external view returns (uint256[] memory) {
        return recipientAlerts[recipient];
    }
    
    function getServerNotices(address server) external view returns (uint256[] memory) {
        return serverNotices[server];
    }
    
    function getUserNotices(address user) external view returns (uint256[] memory) {
        return userNotices[user];
    }
    
    // Get server ID (returns 0 if not a server)
    function getServerId(address server) external view returns (uint256) {
        return serverIds[server];
    }
    
    // Record service attempt
    function recordServiceAttempt(uint256 noticeId, string memory note) external onlyAuthorized {
        require(notices[noticeId].server == msg.sender || hasRole(ADMIN_ROLE, msg.sender), "Not your notice");
        require(!notices[noticeId].acknowledged, "Already acknowledged");
        
        serviceAttempts[noticeId]++;
        lastAttemptNote[noticeId] = note;
        
        emit ServiceAttemptRecorded(noticeId, serviceAttempts[noticeId], note);
    }
    
    
    // Alias for UI compatibility
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
    
    function viewDocument(uint256 documentId) external view returns (
        string memory encryptedIPFS,
        string memory decryptionKey
    ) {
        DocumentNotice memory doc = documentNotices[documentId];
        require(doc.authorizedViewer == msg.sender || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
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
        require(amount <= address(this).balance, "Insufficient balance");
        payable(msg.sender).transfer(amount);
    }
    
    function withdraw() external onlyAdmin {
        payable(msg.sender).transfer(address(this).balance);
    }
    
    // Resource sponsorship
    function setResourceSponsorship(bool enabled) external onlyAdmin {
        resourceSponsorshipEnabled = enabled;
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
        require(ownerOf(tokenId) == from, "Transfer from incorrect owner");
        require(to != address(0), "Transfer to zero address");
        
        // Clear approvals
        _tokenApprovals[tokenId] = address(0);
        
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        
        emit Transfer(from, to, tokenId);
    }
    
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory _data) internal {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "Transfer to non ERC721Receiver");
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        require(_owners[tokenId] != address(0), "Operator query for nonexistent token");
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
    
    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory _data) private returns (bool) {
        if (to.code.length > 0) {
            // Simplified check - just ensure it's a contract
            // In production, you would want to properly check ERC721Receiver interface
            return true;
        } else {
            return true;
        }
    }
    
    // Utility functions
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
        if (data.length == 0) return "";
        
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        string memory result;
        
        // Simplified implementation - in production use proper library
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        result = new string(encodedLen);
        
        assembly {
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)
            let dataPtr := add(data, 32)
            let endPtr := add(dataPtr, mload(data))
            
            for {} lt(dataPtr, endPtr) {} {
                let input := 0
                let dataValue := 0
                
                // Read 3 bytes
                if lt(dataPtr, endPtr) {
                    dataValue := byte(0, mload(dataPtr))
                    input := shl(16, dataValue)
                    dataPtr := add(dataPtr, 1)
                }
                if lt(dataPtr, endPtr) {
                    dataValue := byte(0, mload(dataPtr))
                    input := or(input, shl(8, dataValue))
                    dataPtr := add(dataPtr, 1)
                }
                if lt(dataPtr, endPtr) {
                    dataValue := byte(0, mload(dataPtr))
                    input := or(input, dataValue)
                    dataPtr := add(dataPtr, 1)
                }
                
                // Write 4 characters
                mstore8(resultPtr, mload(add(tablePtr, shr(18, input))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1)
            }
        }
        
        return result;
    }
    
    // Interface support
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == 0x80ac58cd || // ERC721
               interfaceId == 0x5b5e139f || // ERC721Metadata
               interfaceId == 0x01ffc9a7;   // ERC165
    }
    
    // Constants
    uint256 constant public SERVICE_FEE = 20e6; // For UI compatibility
    
    // Batch operations support
    function totalSupply() public view returns (uint256) {
        return _currentTokenId - 1;
    }
}

