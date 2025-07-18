// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalNoticeNFT Event-Based Delivery
 * @dev Immediate notification via events, zero-cost claiming for recipients
 */
contract LegalNoticeNFT {
    event LegalNoticeServed(
        uint256 indexed noticeId,
        address indexed recipient,
        address indexed server,
        string ipfsHash,
        string previewUrl,
        uint256 timestamp
    );
    
    event NoticeClaimed(uint256 indexed noticeId, uint256 tokenId);
    event NoticeAccepted(uint256 indexed noticeId);
    
    struct Notice {
        address server;
        address recipient;
        string ipfsHash;
        string previewUrl;
        uint256 timestamp;
        bool claimed;
        bool accepted;
    }
    
    mapping(uint256 => Notice) public notices;
    mapping(uint256 => address) private _tokenOwners;
    mapping(address => uint256[]) public recipientNotices;
    
    uint256 private _noticeCounter;
    uint256 private _tokenCounter;
    uint256 public serviceFee = 10 * 10**6; // 10 TRX
    
    address public admin;
    address payable public feeCollector;
    
    // Pre-funded claim pool for recipients
    uint256 public claimPool;
    uint256 public claimCost = 2 * 10**6; // 2 TRX per claim
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    constructor(address payable _feeCollector) {
        admin = msg.sender;
        feeCollector = _feeCollector;
    }
    
    /**
     * @dev Serve notice - emits event for immediate notification
     * Process server pays service fee + claim sponsorship
     */
    function serveNotice(
        address recipient,
        string calldata ipfsHash,
        string calldata previewUrl
    ) external payable returns (uint256 noticeId) {
        require(msg.value >= serviceFee + claimCost, "Insufficient payment");
        
        // Service fee to collector
        feeCollector.transfer(serviceFee);
        
        // Claim cost to pool
        claimPool += claimCost;
        
        noticeId = ++_noticeCounter;
        
        notices[noticeId] = Notice({
            server: msg.sender,
            recipient: recipient,
            ipfsHash: ipfsHash,
            previewUrl: previewUrl,
            timestamp: block.timestamp,
            claimed: false,
            accepted: false
        });
        
        recipientNotices[recipient].push(noticeId);
        
        // EMIT EVENT FOR IMMEDIATE NOTIFICATION
        emit LegalNoticeServed(
            noticeId,
            recipient,
            msg.sender,
            ipfsHash,
            previewUrl,
            block.timestamp
        );
    }
    
    /**
     * @dev Claim NFT - FREE for recipients (sponsored from pool)
     */
    function claimNotice(uint256 noticeId) external returns (uint256 tokenId) {
        Notice storage notice = notices[noticeId];
        require(msg.sender == notice.recipient, "Not recipient");
        require(!notice.claimed, "Already claimed");
        require(claimPool >= claimCost, "Claim pool empty");
        
        notice.claimed = true;
        claimPool -= claimCost;
        
        tokenId = ++_tokenCounter;
        _tokenOwners[tokenId] = msg.sender;
        
        emit NoticeClaimed(noticeId, tokenId);
        emit Transfer(address(0), msg.sender, tokenId);
    }
    
    /**
     * @dev Accept notice - can be done without claiming NFT
     */
    function acceptNotice(uint256 noticeId) external {
        Notice storage notice = notices[noticeId];
        require(msg.sender == notice.recipient, "Not recipient");
        require(!notice.accepted, "Already accepted");
        
        notice.accepted = true;
        emit NoticeAccepted(noticeId);
    }
    
    /**
     * @dev Get unclaimed notices for recipient
     */
    function getUnclaimedNotices(address recipient) external view 
        returns (uint256[] memory noticeIds, Notice[] memory noticeData) 
    {
        uint256[] memory allNotices = recipientNotices[recipient];
        uint256 unclaimedCount = 0;
        
        // Count unclaimed
        for (uint i = 0; i < allNotices.length; i++) {
            if (!notices[allNotices[i]].claimed) {
                unclaimedCount++;
            }
        }
        
        // Populate arrays
        noticeIds = new uint256[](unclaimedCount);
        noticeData = new Notice[](unclaimedCount);
        uint256 index = 0;
        
        for (uint i = 0; i < allNotices.length; i++) {
            if (!notices[allNotices[i]].claimed) {
                noticeIds[index] = allNotices[i];
                noticeData[index] = notices[allNotices[i]];
                index++;
            }
        }
    }
    
    // Minimal ERC-721 compliance
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _tokenOwners[tokenId];
    }
    
    function balanceOf(address owner) external view returns (uint256) {
        return recipientNotices[owner].length;
    }
}

/**
 * FRONTEND IMPLEMENTATION:
 * 
 * 1. MONITOR EVENTS IN REAL-TIME:
 * contract.events.LegalNoticeServed({
 *     filter: { recipient: userAddress },
 *     fromBlock: 'latest'
 * }).on('data', (event) => {
 *     // Show browser notification
 *     showNotification('New Legal Notice!', {
 *         body: 'You have received a legal notice',
 *         icon: event.returnValues.previewUrl,
 *         data: { noticeId: event.returnValues.noticeId }
 *     });
 * });
 * 
 * 2. PUSH NOTIFICATION SERVICE:
 * - Use web3.js to monitor events
 * - Send push notifications via:
 *   - Browser notifications
 *   - Email (via SendGrid)
 *   - SMS (via Twilio)
 *   - Telegram bot
 * 
 * 3. NO WALLET REQUIRED TO VIEW:
 * - Public gateway shows notice details
 * - QR code for mobile access
 * - No crypto knowledge needed
 */