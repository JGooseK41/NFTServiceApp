// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalNoticeNFT V6 - Enhanced Events for TronScan Visibility
 * @notice Enhanced version with detailed events that display all data directly in TronScan
 */
contract LegalNoticeNFT_v6_Enhanced is TRC721Enumerable {
    
    // Enhanced events with all data visible in TronScan
    event LegalNoticeServed(
        uint256 indexed noticeId,
        address indexed recipient,
        address indexed server,
        string caseNumber,
        string issuingAgency,
        string noticeType,
        string caseDetails,
        string legalRights,
        string ipfsHash,
        string metadataURI,
        uint256 alertTokenId,
        uint256 documentTokenId,
        uint256 timestamp
    );
    
    event NoticeMetadataStored(
        uint256 indexed tokenId,
        string caseNumber,
        string issuingAgency,
        string documentLocation,
        string accessInstructions
    );
    
    // ... rest of contract code ...
    
    function serveNoticeBatch(Notice[] memory notices) external payable whenNotPaused nonReentrant {
        require(hasRole(PROCESS_SERVER_ROLE, msg.sender), "Not authorized server");
        require(notices.length > 0 && notices.length <= 10, "Invalid batch size");
        
        uint256 totalFeeRequired = calculateBatchFee(msg.sender, notices.length);
        require(msg.value >= totalFeeRequired, "Insufficient fee");
        
        for (uint256 i = 0; i < notices.length; i++) {
            Notice memory notice = notices[i];
            require(notice.recipient != address(0), "Invalid recipient");
            
            uint256 noticeId = totalNotices++;
            uint256 alertId = _nextTokenId++;
            uint256 documentId = _nextTokenId++;
            
            // Store the notice data
            _notices[noticeId] = notice;
            alertMetadata[alertId] = AlertMetadata({
                issuingAgency: notice.issuingAgency,
                noticeType: notice.noticeType,
                caseNumber: notice.caseNumber,
                caseDetails: notice.caseDetails,
                legalRights: notice.legalRights,
                metadataURI: notice.metadataURI
            });
            
            // Mint NFTs
            _mint(notice.recipient, alertId);
            _mint(address(this), documentId);
            
            documentNFTs[alertId] = documentId;
            
            // Emit comprehensive event with ALL data visible in TronScan
            emit LegalNoticeServed(
                noticeId,
                notice.recipient,
                msg.sender,
                notice.caseNumber,
                notice.issuingAgency,
                notice.noticeType,
                notice.caseDetails,
                notice.legalRights,
                notice.encryptedIPFS,
                notice.metadataURI,
                alertId,
                documentId,
                block.timestamp
            );
            
            // Additional metadata event for better visibility
            emit NoticeMetadataStored(
                alertId,
                notice.caseNumber,
                notice.issuingAgency,
                "BlockServed.com",
                "Connect wallet at BlockServed.com to view full document"
            );
        }
    }
}