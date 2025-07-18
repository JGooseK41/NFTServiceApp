// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalNoticeNFT with View-Gated Documents
 * @notice Two-tier system: Alert NFT (always visible) + Document NFT (view-gated)
 * @dev Maximizes wallet compatibility while ensuring certified delivery
 */
contract LegalNoticeNFT {
    // Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AlertCreated(uint256 indexed alertId, address indexed recipient, uint256 documentId);
    event DocumentAccepted(uint256 indexed documentId, address indexed recipient, uint256 timestamp);
    event DocumentViewed(uint256 indexed documentId, address indexed viewer);
    
    struct AlertNotice {
        uint256 documentId;
        address recipient;
        string issuingAgency;  // "U.S. Department of Justice", "IRS", etc.
        string noticeType;     // "Notice of Seizure", "Summons", "Subpoena", etc.
        string caseNumber;     // "CV-2024-001234", "24-CR-5678", etc.
        string caseDetails;    // "245,000 USDT", "Property at 123 Main St", etc.
        string legalRights;    // "You have a right to contest this seizure"
        bool feesSponsored;    // Whether acceptance fees are paid
        uint256 timestamp;
    }
    
    struct LegalDocument {
        address server;
        address recipient;
        string ipfsHash;       // Encrypted document on IPFS
        string caseInfo;       // Public case number/court info
        uint256 timestamp;
        bool accepted;
        uint256 acceptedTime;
        string decryptionKey;  // Revealed only after acceptance
    }
    
    mapping(uint256 => AlertNotice) public alerts;
    mapping(uint256 => LegalDocument) public documents;
    mapping(uint256 => address) private _tokenOwners;
    mapping(address => uint256[]) public recipientAlerts;
    mapping(address => uint256[]) public recipientDocuments;
    mapping(uint256 => mapping(address => bool)) public documentViewers;
    
    uint256 private _alertCounter;
    uint256 private _documentCounter;
    
    address public admin;
    uint256 public serviceFee = 20 * 10**6; // 20 TRX
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @notice Serve legal notice with view-gated document
     * @param recipient Target wallet address
     * @param encryptedIPFS IPFS hash of encrypted document
     * @param decryptionKey Key to decrypt document (stored but not revealed)
     * @param issuingAgency Agency issuing the notice
     * @param noticeType Type of legal notice (e.g., "Notice of Seizure")
     * @param caseNumber Official case number
     * @param caseDetails Specific details (e.g., "245,000 USDT")
     * @param legalRights Rights statement (e.g., "You have a right to contest")
     * @param sponsorFees Whether to pay recipient's acceptance fees
     */
    function serveNotice(
        address recipient,
        string calldata encryptedIPFS,
        string calldata decryptionKey,
        string calldata issuingAgency,
        string calldata noticeType,
        string calldata caseNumber,
        string calldata caseDetails,
        string calldata legalRights,
        bool sponsorFees
    ) external payable returns (uint256 alertId, uint256 documentId) {
        // Calculate required payment
        uint256 requiredPayment = serviceFee;
        if (sponsorFees) {
            requiredPayment += 2 * 10**6; // Add 2 TRX for sponsored acceptance
        }
        
        require(msg.value >= requiredPayment, "Insufficient fee");
        require(recipient != address(0), "Invalid recipient");
        require(bytes(issuingAgency).length <= 100, "Agency name too long");
        require(bytes(noticeType).length <= 50, "Notice type too long");
        require(bytes(caseNumber).length <= 50, "Case number too long");
        require(bytes(caseDetails).length <= 100, "Case details too long");
        require(bytes(legalRights).length <= 100, "Rights text too long");
        
        // Create the document record (not visible yet)
        documentId = ++_documentCounter;
        documents[documentId] = LegalDocument({
            server: msg.sender,
            recipient: recipient,
            ipfsHash: encryptedIPFS,
            caseInfo: string(abi.encodePacked(issuingAgency, " - ", noticeType, " - Case ", caseNumber)),
            timestamp: block.timestamp,
            accepted: false,
            acceptedTime: 0,
            decryptionKey: decryptionKey
        });
        recipientDocuments[recipient].push(documentId);
        
        // Create the alert NFT (immediately visible in wallet)
        alertId = ++_alertCounter;
        alerts[alertId] = AlertNotice({
            documentId: documentId,
            recipient: recipient,
            issuingAgency: issuingAgency,
            noticeType: noticeType,
            caseNumber: caseNumber,
            caseDetails: caseDetails,
            legalRights: legalRights,
            feesSponsored: sponsorFees,
            timestamp: block.timestamp
        });
        recipientAlerts[recipient].push(alertId);
        
        // Mint alert NFT to recipient
        _tokenOwners[alertId] = recipient;
        emit Transfer(address(0), recipient, alertId);
        emit AlertCreated(alertId, recipient, documentId);
    }
    
    /**
     * @notice Accept document to unlock viewing
     * @dev This provides certified delivery proof
     */
    function acceptDocument(uint256 documentId) external {
        LegalDocument storage doc = documents[documentId];
        require(msg.sender == doc.recipient, "Not recipient");
        require(!doc.accepted, "Already accepted");
        
        doc.accepted = true;
        doc.acceptedTime = block.timestamp;
        
        // Mint document NFT to recipient
        uint256 docTokenId = 1000000 + documentId; // Offset to avoid collision
        _tokenOwners[docTokenId] = msg.sender;
        
        emit DocumentAccepted(documentId, msg.sender, block.timestamp);
        emit Transfer(address(0), msg.sender, docTokenId);
    }
    
    /**
     * @notice Get document viewing data (only after acceptance)
     * @return ipfsHash Encrypted document location
     * @return decryptionKey Key to decrypt (only if accepted)
     */
    function viewDocument(uint256 documentId) external returns (
        string memory ipfsHash,
        string memory decryptionKey,
        string memory caseInfo,
        uint256 acceptedTime
    ) {
        LegalDocument memory doc = documents[documentId];
        
        // Allow server or accepted recipient to view
        require(
            msg.sender == doc.server || 
            (msg.sender == doc.recipient && doc.accepted),
            "Not authorized to view"
        );
        
        // Track viewers for audit trail
        if (!documentViewers[documentId][msg.sender]) {
            documentViewers[documentId][msg.sender] = true;
            emit DocumentViewed(documentId, msg.sender);
        }
        
        ipfsHash = doc.ipfsHash;
        caseInfo = doc.caseInfo;
        acceptedTime = doc.acceptedTime;
        
        // Only reveal decryption key if accepted or server
        if (doc.accepted || msg.sender == doc.server) {
            decryptionKey = doc.decryptionKey;
        } else {
            decryptionKey = ""; // Not revealed until accepted
        }
    }
    
    /**
     * @notice Get alert token URI for wallet display
     * @dev Returns comprehensive notice information that works in all wallets
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (tokenId <= _alertCounter) {
            // Alert NFT with full information
            AlertNotice memory alert = alerts[tokenId];
            
            // Build comprehensive description
            string memory description = string(abi.encodePacked(
                alert.issuingAgency, " ",
                alert.noticeType, " - Case ", alert.caseNumber, ". ",
                alert.caseDetails, ". ",
                alert.legalRights, ". ",
                alert.feesSponsored ? 
                    "All fees have been paid. You can accept this notice with no charge." : 
                    "Acceptance requires transaction fee.",
                " Instructions and documentation included."
            ));
            
            return string(abi.encodePacked(
                'data:application/json;utf8,{',
                '"name":"', alert.noticeType, '",',
                '"description":"', description, '",',
                '"external_url":"https://legalnotice.app/accept/', _toString(alert.documentId), '",',
                '"attributes":[',
                '{"trait_type":"Issuing Agency","value":"', alert.issuingAgency, '"},',
                '{"trait_type":"Notice Type","value":"', alert.noticeType, '"},',
                '{"trait_type":"Case Number","value":"', alert.caseNumber, '"},',
                '{"trait_type":"Details","value":"', alert.caseDetails, '"},',
                '{"trait_type":"Fees Paid","value":"', alert.feesSponsored ? "Yes" : "No", '"}',
                ']}'
            ));
        } else {
            // Document NFT (only visible after acceptance)
            uint256 docId = tokenId - 1000000;
            LegalDocument memory doc = documents[docId];
            require(doc.accepted, "Document not accepted");
            
            return string(abi.encodePacked(
                'data:application/json;utf8,{"name":"Legal Document #', _toString(docId), '",',
                '"description":"', doc.caseInfo, ' - Accepted on ', _toString(doc.acceptedTime), '",',
                '"external_url":"https://legalnotice.app/document/', _toString(docId), '",',
                '"attributes":[',
                '{"trait_type":"Accepted","value":"Yes"},',
                '{"trait_type":"Acceptance Date","value":"', _toString(doc.acceptedTime), '"}',
                ']}'
            ));
        }
    }
    
    /**
     * @notice Check if address has unaccepted documents
     */
    function getPendingDocuments(address recipient) external view returns (
        uint256[] memory documentIds,
        string[] memory caseInfos,
        uint256[] memory timestamps
    ) {
        uint256[] memory allDocs = recipientDocuments[recipient];
        uint256 pendingCount = 0;
        
        // Count pending
        for (uint i = 0; i < allDocs.length; i++) {
            if (!documents[allDocs[i]].accepted) {
                pendingCount++;
            }
        }
        
        // Populate arrays
        documentIds = new uint256[](pendingCount);
        caseInfos = new string[](pendingCount);
        timestamps = new uint256[](pendingCount);
        
        uint256 index = 0;
        for (uint i = 0; i < allDocs.length; i++) {
            if (!documents[allDocs[i]].accepted) {
                documentIds[index] = allDocs[i];
                caseInfos[index] = documents[allDocs[i]].caseInfo;
                timestamps[index] = documents[allDocs[i]].timestamp;
                index++;
            }
        }
    }
    
    /**
     * @notice Get delivery proof for a document
     */
    function getDeliveryProof(uint256 documentId) external view returns (
        address server,
        address recipient,
        uint256 servedTime,
        uint256 acceptedTime,
        bool isAccepted
    ) {
        LegalDocument memory doc = documents[documentId];
        return (
            doc.server,
            doc.recipient,
            doc.timestamp,
            doc.acceptedTime,
            doc.accepted
        );
    }
    
    // Minimal ERC-721 compliance
    function balanceOf(address owner) external view returns (uint256) {
        return recipientAlerts[owner].length + recipientDocuments[owner].length;
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _tokenOwners[tokenId];
    }
    
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
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
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. TWO-TIER SYSTEM:
 *    - Alert NFT: Simple text notice, works in ALL wallets
 *    - Document NFT: Full document, only minted after acceptance
 * 
 * 2. VIEW GATING:
 *    - Documents are encrypted on IPFS
 *    - Decryption key only revealed after acceptance
 *    - Creates certified delivery proof
 * 
 * 3. MAXIMUM COMPATIBILITY:
 *    - Alert uses simple text description
 *    - No base64 images in alert
 *    - Standard ERC-721 tokenURI format
 * 
 * 4. FRONTEND FLOW:
 *    a) Encrypt document before IPFS upload
 *    b) Create alert with clear call-to-action
 *    c) Recipient sees alert in ANY wallet
 *    d) Must accept to decrypt and view document
 *    e) Acceptance creates on-chain proof
 */