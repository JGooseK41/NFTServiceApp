// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalNoticeNFT for Unhosted Wallets
 * @dev Optimized for serving unknown wallet owners where NFT is the only notification
 */
contract LegalNoticeNFT {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event LegalNoticeCreated(uint256 indexed noticeId, address indexed recipient, uint8 noticeType);
    
    struct Notice {
        address server;
        address recipient;
        bytes32 documentCID;      // IPFS CID as bytes32 (not string)
        uint64 timestamp;
        uint32 caseNumberHash;    // Hash of case number
        uint16 jurisdiction;
        uint8 documentType;
        uint8 noticeType;         // 1=Text, 2=Visual, 3=Both
        bool accepted;
    }
    
    // Visual notice data stored separately (only if needed)
    mapping(uint256 => string) private _visualNotices;
    
    // Text-based notice for wallet display
    mapping(uint256 => string) private _textNotices;
    
    mapping(uint256 => Notice) public notices;
    mapping(address => uint256[]) public userNotices;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _owners;
    
    uint256 private _noticeCounter;
    uint256 public baseFee = 5 * 10**6;      // 5 TRX base
    uint256 public visualFee = 50 * 10**6;   // 50 TRX for visual
    uint256 public textFee = 10 * 10**6;     // 10 TRX for text
    
    address public admin;
    address payable public feeCollector;
    
    constructor(address payable _feeCollector) {
        admin = msg.sender;
        feeCollector = _feeCollector;
    }
    
    /**
     * @dev Create text-based notice (CHEAPEST - Best for unhosted wallets)
     */
    function createTextNotice(
        address recipient,
        bytes32 documentCID,
        string calldata textNotice,  // Short text like "Legal Notice: Case #12345"
        bytes32 caseNumberHash,
        uint16 jurisdiction,
        uint8 documentType
    ) external payable returns (uint256 noticeId) {
        require(msg.value >= baseFee + textFee, "Insufficient fee");
        require(bytes(textNotice).length <= 100, "Text too long");
        
        feeCollector.transfer(msg.value);
        
        noticeId = ++_noticeCounter;
        
        notices[noticeId] = Notice({
            server: msg.sender,
            recipient: recipient,
            documentCID: documentCID,
            timestamp: uint64(block.timestamp),
            caseNumberHash: uint32(uint256(caseNumberHash)),
            jurisdiction: jurisdiction,
            documentType: documentType,
            noticeType: 1,
            accepted: false
        });
        
        _textNotices[noticeId] = textNotice;
        _mint(recipient, noticeId);
        
        emit LegalNoticeCreated(noticeId, recipient, 1);
    }
    
    /**
     * @dev Create visual notice with SVG (MEDIUM COST - Better than base64)
     */
    function createSVGNotice(
        address recipient,
        bytes32 documentCID,
        string calldata svgImage,    // SVG is more efficient than base64
        bytes32 caseNumberHash,
        uint16 jurisdiction,
        uint8 documentType
    ) external payable returns (uint256 noticeId) {
        require(msg.value >= baseFee + visualFee, "Insufficient fee");
        
        feeCollector.transfer(msg.value);
        
        noticeId = ++_noticeCounter;
        
        notices[noticeId] = Notice({
            server: msg.sender,
            recipient: recipient,
            documentCID: documentCID,
            timestamp: uint64(block.timestamp),
            caseNumberHash: uint32(uint256(caseNumberHash)),
            jurisdiction: jurisdiction,
            documentType: documentType,
            noticeType: 2,
            accepted: false
        });
        
        _visualNotices[noticeId] = svgImage;
        _mint(recipient, noticeId);
        
        emit LegalNoticeCreated(noticeId, recipient, 2);
    }
    
    /**
     * @dev Create reference notice (CHEAPEST - Just points to IPFS)
     */
    function createReferenceNotice(
        address recipient,
        bytes32 documentCID,
        bytes32 caseNumberHash,
        uint16 jurisdiction,
        uint8 documentType
    ) external payable returns (uint256 noticeId) {
        require(msg.value >= baseFee, "Insufficient fee");
        
        feeCollector.transfer(msg.value);
        
        noticeId = ++_noticeCounter;
        
        notices[noticeId] = Notice({
            server: msg.sender,
            recipient: recipient,
            documentCID: documentCID,
            timestamp: uint64(block.timestamp),
            caseNumberHash: uint32(uint256(caseNumberHash)),
            jurisdiction: jurisdiction,
            documentType: documentType,
            noticeType: 0,
            accepted: false
        });
        
        _mint(recipient, noticeId);
        
        emit LegalNoticeCreated(noticeId, recipient, 0);
    }
    
    /**
     * @dev Get notice display data
     */
    function getNoticeDisplay(uint256 noticeId) external view returns (
        string memory displayType,
        string memory displayData,
        string memory ipfsUrl
    ) {
        Notice memory notice = notices[noticeId];
        
        if (notice.noticeType == 1) {
            displayType = "text";
            displayData = _textNotices[noticeId];
        } else if (notice.noticeType == 2) {
            displayType = "svg";
            displayData = _visualNotices[noticeId];
        } else {
            displayType = "reference";
            displayData = "";
        }
        
        // Convert CID bytes32 back to string
        ipfsUrl = string(abi.encodePacked("ipfs://", _bytes32ToString(notice.documentCID)));
    }
    
    /**
     * @dev Enhanced tokenURI for wallet display
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        Notice memory notice = notices[tokenId];
        
        if (notice.noticeType == 1) {
            // Return JSON with text notice
            return string(abi.encodePacked(
                'data:application/json;utf8,{"name":"Legal Notice #',
                _toString(tokenId),
                '","description":"',
                _textNotices[tokenId],
                '","external_url":"https://ipfs.io/ipfs/',
                _bytes32ToString(notice.documentCID),
                '"}'
            ));
        } else if (notice.noticeType == 2) {
            // Return JSON with SVG image
            return string(abi.encodePacked(
                'data:application/json;utf8,{"name":"Legal Notice #',
                _toString(tokenId),
                '","image":"data:image/svg+xml;utf8,',
                _visualNotices[tokenId],
                '","external_url":"https://ipfs.io/ipfs/',
                _bytes32ToString(notice.documentCID),
                '"}'
            ));
        } else {
            // Minimal reference
            return string(abi.encodePacked(
                'data:application/json;utf8,{"name":"Legal Notice #',
                _toString(tokenId),
                '","description":"Legal document served on ',
                _toString(notice.timestamp),
                '","external_url":"https://ipfs.io/ipfs/',
                _bytes32ToString(notice.documentCID),
                '"}'
            ));
        }
    }
    
    function _mint(address to, uint256 tokenId) private {
        _balances[to]++;
        _owners[tokenId] = to;
        userNotices[to].push(tokenId);
        emit Transfer(address(0), to, tokenId);
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
    
    function _bytes32ToString(bytes32 _bytes32) private pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
    
    // Standard ERC-721 functions
    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }
}

/**
 * BEST PRACTICES FOR UNHOSTED WALLETS:
 * 
 * 1. TEXT NOTICES (Cheapest)
 *    - Simple text: "Legal Notice: Case #CV-2024-001234"
 *    - Shows in wallet as NFT description
 *    - ~15 TRX total cost
 * 
 * 2. SVG GRAPHICS (Better than base64)
 *    - Vector graphics are smaller
 *    - Can include QR code to document
 *    - ~55 TRX total cost
 * 
 * 3. REFERENCE ONLY (Absolute minimum)
 *    - Just IPFS hash stored
 *    - ~5 TRX total cost
 *    - Relies on wallet supporting IPFS
 * 
 * 4. ENHANCED METADATA
 *    - Use tokenURI to provide rich data
 *    - Wallets will display this info
 *    - No extra storage cost
 */