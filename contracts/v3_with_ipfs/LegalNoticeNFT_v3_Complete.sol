// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract LegalNoticeNFT_v3_Complete {
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
    
    // Main function with IPFS metadata support
    function serveNotice(
        address recipient,
        string calldata encryptedIPFS,
        string calldata encryptionKey,
        string calldata issuingAgency,
        string calldata noticeType,
        string calldata caseNumber,
        string calldata caseDetails,
        string calldata legalRights,
        bool sponsorFees,
        string calldata metadataURI  // IPFS metadata URI
    ) external payable whenNotPaused onlyAuthorized returns (uint256 alertId, uint256 documentId) {
        require(recipient != address(0), "Invalid recipient");
        
        // Calculate fees
        uint256 totalFee = calculateFee(msg.sender);
        if (sponsorFees) {
            totalFee += sponsorshipFee;
        }
        require(msg.value >= totalFee, "Insufficient fee");
        
        // Create notice IDs
        uint256 noticeId = totalNotices++;
        alertId = _currentTokenId++;
        documentId = _currentTokenId++;
        
        // Store alert notice
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
        
        // Store document notice
        if (bytes(encryptedIPFS).length > 0) {
            documentNotices[documentId] = DocumentNotice({
                encryptedIPFS: encryptedIPFS,
                decryptionKey: encryptionKey,
                authorizedViewer: recipient,
                alertId: alertId,
                isRestricted: true
            });
        }
        
        // Store main notice
        notices[noticeId] = Notice({
            alertId: alertId,
            documentId: documentId,
            server: msg.sender,
            recipient: recipient,
            timestamp: block.timestamp,
            acknowledged: false,
            noticeType: noticeType,
            caseNumber: caseNumber
        });
        
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
        serverNotices[msg.sender].push(noticeId);
        userNotices[recipient].push(noticeId);
        
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
        emit LegalNoticeCreated(noticeId, msg.sender, recipient, block.timestamp);
        
        return (alertId, documentId);
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
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("Transfer to non ERC721Receiver");
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

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}