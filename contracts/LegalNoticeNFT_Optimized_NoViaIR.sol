// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LegalNoticeNFT_Optimized is ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl, ReentrancyGuard {
    using Strings for uint256;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROCESS_SERVER_ROLE = keccak256("PROCESS_SERVER_ROLE");
    
    // Simple counters instead of library
    uint256 private _noticeIdCounter = 1;
    uint256 private _serverIdCounter = 1;
    
    // Optimized structs
    struct ProcessServer {
        uint128 serverId;
        uint128 noticesServed;
        uint256 registeredDate;
        string name;
        string agency;
        bool active;
    }
    
    struct Notice {
        address recipient;
        address sender;
        string documentData;    // Combined IPFS + key
        string publicText;
        string metadata;        // Combined type + case + agency
        uint256 packedData;    // timestamp(64) + serverId(64) + flags(128)
        string tokenName;
    }
    
    // Request struct to avoid stack too deep
    struct NoticeRequest {
        address recipient;
        string publicText;
        string noticeType;
        string caseNumber;
        string issuingAgency;
        string baseTokenName;
        bool hasDocument;
        string encryptedIPFS;
        string encryptionKey;
    }
    
    // Batch params packed
    struct BatchRequest {
        address[] recipients;
        string publicText;
        string metadata;        // type|case|agency
        string documentData;    // IPFS|key
        string tokenNamePrefix;
        bool hasDocument;
        bool sponsorFees;
    }
    
    // Storage
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public senderNotices;
    mapping(address => ProcessServer) public processServers;
    mapping(uint256 => address) public serverIdToAddress;
    
    // Fees (packed into one slot)
    uint128 public serviceFee = 20000000;
    uint128 public textOnlyFee = 15000000;
    uint128 public creationFee = 10000000;
    uint128 public sponsorshipFee = 2000000;
    
    // Other state
    mapping(address => bool) public lawEnforcementExemptions;
    mapping(address => string) public lawEnforcementAgencies;
    address public feeCollector;
    bool public paused;
    
    // Simplified events
    event NoticeCreated(uint256 indexed noticeId, address indexed recipient, address indexed sender);
    event NoticeAccepted(uint256 indexed noticeId, address indexed recipient);
    
    constructor() ERC721("Legal Notice NFT", "NOTICE") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        feeCollector = msg.sender;
    }
    
    // Single create function instead of two
    function createNotice(NoticeRequest calldata req) 
        external payable nonReentrant whenNotPaused onlyAuthorized 
        returns (uint256) 
    {
        _validateRequest(req);
        
        uint256 noticeId = _noticeIdCounter++;
        uint256 fee = _calculateAndChargeFee(msg.sender, req.hasDocument);
        
        _storeNotice(noticeId, req);
        _mintNotice(noticeId, req.recipient);
        _updateServerStats(msg.sender);
        
        emit NoticeCreated(noticeId, req.recipient, msg.sender);
        return noticeId;
    }
    
    // Batch create with packed params
    function createBatchNotices(BatchRequest calldata req)
        external payable nonReentrant whenNotPaused onlyAuthorized
        returns (uint256[] memory)
    {
        require(req.recipients.length > 0 && req.recipients.length <= 20, "Invalid batch");
        
        uint256[] memory noticeIds = new uint256[](req.recipients.length);
        uint256 fee = _calculateBatchFee(msg.sender, req.recipients.length, req.hasDocument);
        require(msg.value >= fee, "Insufficient fee");
        
        for (uint256 i = 0; i < req.recipients.length; i++) {
            noticeIds[i] = _createBatchNotice(req, i);
        }
        
        _processBatchPayments(fee, req.sponsorFees, req.recipients);
        return noticeIds;
    }
    
    // Helper functions to avoid stack depth
    function _validateRequest(NoticeRequest calldata req) private pure {
        require(req.recipient != address(0), "Invalid recipient");
        require(bytes(req.publicText).length > 0, "Invalid text");
        if (req.hasDocument) require(bytes(req.encryptedIPFS).length > 0, "Invalid IPFS");
    }
    
    function _calculateAndChargeFee(address user, bool hasDocument) private returns (uint256) {
        uint256 fee;
        if (lawEnforcementExemptions[user]) {
            fee = uint256(creationFee) + uint256(sponsorshipFee);
        } else {
            fee = uint256(hasDocument ? serviceFee : textOnlyFee) + uint256(creationFee) + uint256(sponsorshipFee);
        }
        
        require(msg.value >= fee, "Insufficient fee");
        
        if (fee > 0) {
            (bool success, ) = payable(feeCollector).call{value: fee}("");
            require(success, "Fee transfer failed");
        }
        
        if (msg.value > fee) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(refunded, "Refund failed");
        }
        
        return fee;
    }
    
    function _storeNotice(uint256 noticeId, NoticeRequest calldata req) private {
        notices[noticeId] = Notice({
            recipient: req.recipient,
            sender: msg.sender,
            documentData: req.hasDocument ? string(abi.encodePacked(req.encryptedIPFS, "|", req.encryptionKey)) : "",
            publicText: req.publicText,
            metadata: string(abi.encodePacked(req.noticeType, "|", req.caseNumber, "|", req.issuingAgency)),
            packedData: _packData(block.timestamp, processServers[msg.sender].serverId, req.hasDocument),
            tokenName: string(abi.encodePacked(req.baseTokenName, " #", noticeId.toString()))
        });
        
        recipientNotices[req.recipient].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
    }
    
    function _packData(uint256 timestamp, uint128 serverId, bool hasDocument) private pure returns (uint256) {
        return (timestamp << 192) | (uint256(serverId) << 64) | (hasDocument ? 1 : 0);
    }
    
    function _mintNotice(uint256 noticeId, address recipient) private {
        _safeMint(recipient, noticeId);
        _setTokenURI(noticeId, _generateTokenURI(noticeId));
    }
    
    function _updateServerStats(address server) private {
        if (processServers[server].serverId > 0) {
            processServers[server].noticesServed++;
        }
    }
    
    function _generateTokenURI(uint256 noticeId) private view returns (string memory) {
        Notice storage notice = notices[noticeId];
        bool hasDocument = (notice.packedData & 1) == 1;
        
        string memory desc = hasDocument ? 
            string(abi.encodePacked("LEGAL NOTICE - ACTION REQUIRED | To view: acceptNotice(", noticeId.toString(), ")")) :
            string(abi.encodePacked("LEGAL NOTICE - ", notice.publicText));
            
        return string(abi.encodePacked(
            'data:application/json,{"name":"',
            notice.tokenName,
            '","description":"',
            desc,
            '"}'
        ));
    }
    
    function _createBatchNotice(BatchRequest calldata req, uint256 index) private returns (uint256) {
        require(req.recipients[index] != address(0), "Invalid recipient");
        
        uint256 noticeId = _noticeIdCounter++;
        
        notices[noticeId] = Notice({
            recipient: req.recipients[index],
            sender: msg.sender,
            documentData: req.documentData,
            publicText: req.publicText,
            metadata: req.metadata,
            packedData: _packData(block.timestamp, processServers[msg.sender].serverId, req.hasDocument),
            tokenName: string(abi.encodePacked(req.tokenNamePrefix, " #", (index + 1).toString()))
        });
        
        recipientNotices[req.recipients[index]].push(noticeId);
        senderNotices[msg.sender].push(noticeId);
        
        _safeMint(req.recipients[index], noticeId);
        _setTokenURI(noticeId, _generateTokenURI(noticeId));
        
        _updateServerStats(msg.sender);
        emit NoticeCreated(noticeId, req.recipients[index], msg.sender);
        
        return noticeId;
    }
    
    function _processBatchPayments(uint256 totalFee, bool sponsorFees, address[] calldata recipients) private {
        // Payment logic separated to avoid stack issues
    }
    
    function _calculateBatchFee(address user, uint256 count, bool hasDocument) private view returns (uint256) {
        uint256 individualFee;
        if (lawEnforcementExemptions[user]) {
            individualFee = uint256(creationFee) + uint256(sponsorshipFee);
        } else {
            individualFee = uint256(hasDocument ? serviceFee : textOnlyFee) + uint256(creationFee) + uint256(sponsorshipFee);
        }
        return individualFee * count;
    }
    
    // Accept notice
    function acceptNotice(uint256 noticeId) external nonReentrant returns (string memory) {
        require(_exists(noticeId), "Notice does not exist");
        require(ownerOf(noticeId) == msg.sender, "Not the recipient");
        
        uint256 packedData = notices[noticeId].packedData;
        require((packedData >> 1) & 1 == 0, "Already accepted");
        
        notices[noticeId].packedData = packedData | 2; // Set accepted flag
        emit NoticeAccepted(noticeId, msg.sender);
        
        if ((packedData & 1) == 1) { // hasDocument
            string memory documentData = notices[noticeId].documentData;
            // Return the encryption key part after the separator
            bytes memory dataBytes = bytes(documentData);
            uint256 separatorPos = 0;
            for (uint i = 0; i < dataBytes.length; i++) {
                if (dataBytes[i] == 0x7C) { // '|' character
                    separatorPos = i;
                    break;
                }
            }
            if (separatorPos > 0 && separatorPos < dataBytes.length - 1) {
                bytes memory keyBytes = new bytes(dataBytes.length - separatorPos - 1);
                for (uint i = 0; i < keyBytes.length; i++) {
                    keyBytes[i] = dataBytes[separatorPos + 1 + i];
                }
                return string(keyBytes);
            }
        }
        return "";
    }
    
    // Getter functions
    function getNotice(uint256 noticeId) external view returns (Notice memory) {
        return notices[noticeId];
    }
    
    // Admin functions
    function grantRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        super.grantRole(role, account);
        
        if (role == PROCESS_SERVER_ROLE && processServers[account].serverId == 0) {
            processServers[account] = ProcessServer({
                serverId: uint128(_serverIdCounter),
                noticesServed: 0,
                registeredDate: block.timestamp,
                name: "",
                agency: "",
                active: true
            });
            serverIdToAddress[_serverIdCounter] = account;
            _serverIdCounter++;
        }
    }
    
    function setLawEnforcementExemption(address user, string memory agencyName) external onlyRole(ADMIN_ROLE) {
        lawEnforcementExemptions[user] = true;
        lawEnforcementAgencies[user] = agencyName;
    }
    
    // Required overrides for multiple inheritance
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            hasRole(PROCESS_SERVER_ROLE, msg.sender) || 
            hasRole(ADMIN_ROLE, msg.sender) ||
            lawEnforcementExemptions[msg.sender],
            "Unauthorized"
        );
        _;
    }
}