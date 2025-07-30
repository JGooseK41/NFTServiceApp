// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract LegalNoticeNFT_v3_Complete {
    // Add struct for serveNotice parameters to avoid stack too deep
    struct NoticeParams {
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
    
    // Main function with IPFS metadata support - now accepts struct
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
        string calldata metadataURI
    ) external payable whenNotPaused onlyAuthorized returns (uint256 alertId, uint256 documentId) {
        NoticeParams memory params = NoticeParams({
            recipient: recipient,
            encryptedIPFS: encryptedIPFS,
            encryptionKey: encryptionKey,
            issuingAgency: issuingAgency,
            noticeType: noticeType,
            caseNumber: caseNumber,
            caseDetails: caseDetails,
            legalRights: legalRights,
            sponsorFees: sponsorFees,
            metadataURI: metadataURI
        });
        
        return _serveNoticeInternal(params);
    }
    
    function _serveNoticeInternal(NoticeParams memory params) internal returns (uint256 alertId, uint256 documentId) {
        require(params.recipient != address(0), "Invalid recipient");
        
        // Calculate fees
        uint256 totalFee = calculateFee(msg.sender);
        if (params.sponsorFees) {
            totalFee += sponsorshipFee;
        }
        require(msg.value >= totalFee, "Insufficient fee");
        
        // Create notice IDs
        uint256 noticeId = totalNotices++;
        alertId = _currentTokenId++;
        documentId = _currentTokenId++;
        
        // Store alert notice
        alertNotices[alertId] = AlertNotice({
            recipient: params.recipient,
            sender: msg.sender,
            documentId: documentId,
            timestamp: block.timestamp,
            acknowledged: false,
            issuingAgency: params.issuingAgency,
            noticeType: params.noticeType,
            caseNumber: params.caseNumber,
            caseDetails: params.caseDetails,
            legalRights: params.legalRights,
            responseDeadline: block.timestamp + 30 days,
            previewImage: ""
        });
        
        // Store document notice
        if (bytes(params.encryptedIPFS).length > 0) {
            documentNotices[documentId] = DocumentNotice({
                encryptedIPFS: params.encryptedIPFS,
                decryptionKey: params.encryptionKey,
                authorizedViewer: params.recipient,
                alertId: alertId,
                isRestricted: true
            });
        }
        
        // Store main notice
        notices[noticeId] = Notice({
            alertId: alertId,
            documentId: documentId,
            server: msg.sender,
            recipient: params.recipient,
            timestamp: block.timestamp,
            acknowledged: false,
            noticeType: params.noticeType,
            caseNumber: params.caseNumber
        });
        
        // Mint NFTs
        _mint(params.recipient, alertId);
        _mint(address(this), documentId);
        
        // Set token URIs with IPFS metadata
        if (bytes(params.metadataURI).length > 0) {
            _setTokenURI(alertId, params.metadataURI);
        }
        
        // Set token types
        tokenTypes[alertId] = NoticeType.ALERT;
        tokenTypes[documentId] = NoticeType.DOCUMENT;
        
        // Track
        recipientAlerts[params.recipient].push(alertId);
        serverNotices[msg.sender].push(noticeId);
        userNotices[params.recipient].push(noticeId);
        
        // Send notification TRX if sponsored
        if (params.sponsorFees && sponsorshipFee > 0) {
            payable(params.recipient).transfer(sponsorshipFee);
            emit ResourceSponsored(params.recipient, 0, sponsorshipFee);
        }
        
        // Send fees to collector
        if (msg.value > sponsorshipFee) {
            payable(feeCollector).transfer(msg.value - sponsorshipFee);
        }
        
        emit NoticeServed(alertId, documentId, params.recipient);
        emit LegalNoticeCreated(noticeId, msg.sender, params.recipient, block.timestamp);
        
        return (alertId, documentId);
    }
    
    // Rest of contract remains the same...
    // [Include all other functions from the original contract]
}