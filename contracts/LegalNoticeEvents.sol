// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

/**
 * @title LegalNoticeEvents
 * @dev Minimal contract that emits events and tracks acceptance
 * All complex logic handled off-chain
 */
contract LegalNoticeEvents {
    // Events contain all the data we need
    event NoticeServed(
        uint256 indexed noticeId,
        address indexed recipient,
        address indexed server,
        string metadataURI,  // IPFS hash containing encrypted notice + metadata
        uint256 timestamp,
        uint256 serviceFee,
        bool feesSponsored
    );
    
    event NoticeAccepted(
        uint256 indexed noticeId,
        address indexed recipient,
        uint256 timestamp,
        bytes signature  // Recipient's signature for proof
    );
    
    event NoticeViewed(
        uint256 indexed noticeId,
        address indexed viewer,
        uint256 timestamp
    );
    
    // Minimal state - just what we need for verification
    struct Notice {
        address server;
        address recipient;
        string metadataURI;
        uint256 servedTime;
        uint256 acceptedTime;
        bool feesSponsored;
    }
    
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public recipientNotices;
    mapping(address => uint256[]) public serverNotices;
    
    uint256 public noticeCounter;
    uint256 public serviceFee = 20000000; // 20 TRX
    address public feeCollector;
    
    constructor() {
        feeCollector = msg.sender;
    }
    
    /**
     * @dev Serve a notice - just emit event and store minimal data
     */
    function serveNotice(
        address recipient,
        string calldata metadataURI,
        bool sponsorFees
    ) external payable returns (uint256 noticeId) {
        uint256 totalFee = serviceFee;
        if (sponsorFees) totalFee += 2000000; // Sponsor recipient's acceptance fee
        
        require(msg.value >= totalFee, "Insufficient fee");
        require(recipient != address(0), "Invalid recipient");
        
        noticeId = ++noticeCounter;
        
        notices[noticeId] = Notice({
            server: msg.sender,
            recipient: recipient,
            metadataURI: metadataURI,
            servedTime: block.timestamp,
            acceptedTime: 0,
            feesSponsored: sponsorFees
        });
        
        recipientNotices[recipient].push(noticeId);
        serverNotices[msg.sender].push(noticeId);
        
        emit NoticeServed(
            noticeId,
            recipient,
            msg.sender,
            metadataURI,
            block.timestamp,
            msg.value,
            sponsorFees
        );
        
        // Transfer fee to collector
        if (msg.value > 0) {
            (bool success, ) = feeCollector.call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }
    }
    
    /**
     * @dev Accept a notice - recipient acknowledges receipt
     */
    function acceptNotice(uint256 noticeId, bytes calldata signature) external {
        Notice storage notice = notices[noticeId];
        require(notice.recipient == msg.sender, "Not recipient");
        require(notice.acceptedTime == 0, "Already accepted");
        
        notice.acceptedTime = block.timestamp;
        
        emit NoticeAccepted(noticeId, msg.sender, block.timestamp, signature);
    }
    
    /**
     * @dev Log that someone viewed a notice (called by backend after Lit Protocol access)
     */
    function logView(uint256 noticeId) external {
        Notice storage notice = notices[noticeId];
        require(notice.server != address(0), "Notice not found");
        
        emit NoticeViewed(noticeId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Get all notices for a recipient
     */
    function getRecipientNotices(address recipient) external view returns (uint256[] memory) {
        return recipientNotices[recipient];
    }
    
    /**
     * @dev Get all notices from a server
     */
    function getServerNotices(address server) external view returns (uint256[] memory) {
        return serverNotices[server];
    }
    
    /**
     * @dev Check if user needs to pay for acceptance
     */
    function acceptanceFeeRequired(uint256 noticeId, address user) external view returns (bool) {
        Notice storage notice = notices[noticeId];
        return notice.recipient == user && !notice.feesSponsored;
    }
    
    // Admin functions
    function updateServiceFee(uint256 newFee) external {
        require(msg.sender == feeCollector, "Not authorized");
        serviceFee = newFee;
    }
    
    function updateFeeCollector(address newCollector) external {
        require(msg.sender == feeCollector, "Not authorized");
        feeCollector = newCollector;
    }
}