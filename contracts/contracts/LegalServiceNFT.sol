// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LegalServiceNFT V2
 * @dev Dual NFT system for legal document service
 * - Service NFT: Contains preview image, sent to recipient's wallet
 * - Document NFT: Full document access, requires acceptance
 */
contract LegalServiceNFT {
    // Events
    event ServiceIssued(
        uint256 indexed serviceId,
        uint256 indexed documentId,
        address indexed recipient,
        address server,
        string caseNumber
    );
    
    event DocumentAccepted(
        uint256 indexed documentId,
        uint256 indexed serviceId,
        address indexed recipient,
        uint256 timestamp
    );
    
    event ServiceDeliveryConfirmed(
        uint256 indexed serviceId,
        address indexed server,
        address recipient
    );
    
    // Token types
    enum TokenType { SERVICE, DOCUMENT }
    
    // Service NFT - Sent to recipient's wallet
    struct ServiceToken {
        address recipient;
        address server;
        string previewImage;      // Base64 encoded preview
        string caseNumber;
        string documentType;      // "Summons", "Subpoena", etc.
        uint256 documentTokenId;  // Reference to full document
        uint256 issuedAt;
        bool acknowledged;        // True when document is accepted
    }
    
    // Document NFT - Contains full document
    struct DocumentToken {
        address server;          // Who uploaded it
        string ipfsHash;         // Full document on IPFS
        bytes32 documentHash;    // SHA256 of document for verification
        uint256 serviceTokenId;  // Reference to service token
        bool accepted;           // Acceptance status
        uint256 acceptedAt;      // Timestamp of acceptance
        string metadata;         // JSON metadata (jurisdiction, court, etc.)
    }
    
    // State variables
    mapping(uint256 => ServiceToken) public serviceTokens;
    mapping(uint256 => DocumentToken) public documentTokens;
    mapping(uint256 => address) private _tokenOwners;
    mapping(address => uint256[]) private _recipientServices;
    mapping(address => uint256[]) private _serverServices;
    mapping(uint256 => TokenType) private _tokenTypes;
    
    // Counters
    uint256 private _serviceCounter;
    uint256 private _documentCounter;
    
    // Access control
    mapping(address => bool) public authorizedServers;
    mapping(address => bool) public admins;
    
    // Fee management
    uint256 public serviceFee = 10_000_000; // 10 TRX in SUN
    address payable public feeCollector;
    mapping(address => bool) public feeExempt;
    
    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }
    
    modifier onlyAuthorized() {
        require(authorizedServers[msg.sender] || admins[msg.sender], "Not authorized");
        _;
    }
    
    constructor(address payable _feeCollector) {
        feeCollector = _feeCollector;
        admins[msg.sender] = true;
    }
    
    /**
     * @dev Issue legal service with dual NFT system
     * @param recipient Address to receive the service NFT
     * @param previewImage Base64 encoded preview image
     * @param ipfsHash IPFS hash of full document
     * @param documentHash SHA256 hash of document
     * @param caseNumber Case reference number
     * @param documentType Type of legal document
     * @param metadata Additional metadata (JSON string)
     */
    function issueService(
        address recipient,
        string calldata previewImage,
        string calldata ipfsHash,
        bytes32 documentHash,
        string calldata caseNumber,
        string calldata documentType,
        string calldata metadata
    ) external payable onlyAuthorized returns (uint256 serviceId, uint256 documentId) {
        // Handle fee
        if (!feeExempt[msg.sender] && msg.value > 0) {
            (bool sent,) = feeCollector.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }
        
        // Create service token ID
        serviceId = ++_serviceCounter;
        documentId = ++_documentCounter;
        
        // Create Document NFT (held by contract initially)
        documentTokens[documentId] = DocumentToken({
            server: msg.sender,
            ipfsHash: ipfsHash,
            documentHash: documentHash,
            serviceTokenId: serviceId,
            accepted: false,
            acceptedAt: 0,
            metadata: metadata
        });
        _tokenTypes[documentId] = TokenType.DOCUMENT;
        _tokenOwners[documentId] = address(this); // Contract holds document NFT
        
        // Create Service NFT and send to recipient
        serviceTokens[serviceId] = ServiceToken({
            recipient: recipient,
            server: msg.sender,
            previewImage: previewImage,
            caseNumber: caseNumber,
            documentType: documentType,
            documentTokenId: documentId,
            issuedAt: block.timestamp,
            acknowledged: false
        });
        _tokenTypes[serviceId] = TokenType.SERVICE;
        _tokenOwners[serviceId] = recipient; // Service NFT goes to recipient
        
        // Update mappings
        _recipientServices[recipient].push(serviceId);
        _serverServices[msg.sender].push(serviceId);
        
        emit ServiceIssued(serviceId, documentId, recipient, msg.sender, caseNumber);
        emit Transfer(address(0), recipient, serviceId);
        emit Transfer(address(0), address(this), documentId);
    }
    
    /**
     * @dev Accept document and receive full document NFT
     * @param serviceId The service token ID in recipient's wallet
     */
    function acceptDocument(uint256 serviceId) external {
        ServiceToken storage service = serviceTokens[serviceId];
        require(_tokenOwners[serviceId] == msg.sender, "Not service token owner");
        require(!service.acknowledged, "Already acknowledged");
        
        uint256 documentId = service.documentTokenId;
        DocumentToken storage document = documentTokens[documentId];
        require(!document.accepted, "Already accepted");
        
        // Update acceptance status
        document.accepted = true;
        document.acceptedAt = block.timestamp;
        service.acknowledged = true;
        
        // Transfer document NFT to recipient
        _tokenOwners[documentId] = msg.sender;
        
        emit DocumentAccepted(documentId, serviceId, msg.sender, block.timestamp);
        emit Transfer(address(this), msg.sender, documentId);
        
        // Notify server of acceptance
        emit ServiceDeliveryConfirmed(serviceId, service.server, msg.sender);
    }
    
    /**
     * @dev Get service preview image (for wallet display)
     */
    function getServicePreview(uint256 serviceId) external view returns (string memory) {
        require(_tokenTypes[serviceId] == TokenType.SERVICE, "Not a service token");
        return serviceTokens[serviceId].previewImage;
    }
    
    /**
     * @dev Get full document IPFS hash (only accessible after acceptance)
     */
    function getDocumentIPFS(uint256 documentId) external view returns (string memory) {
        require(_tokenTypes[documentId] == TokenType.DOCUMENT, "Not a document token");
        require(_tokenOwners[documentId] == msg.sender, "Not document owner");
        return documentTokens[documentId].ipfsHash;
    }
    
    /**
     * @dev Get all services for a recipient
     */
    function getRecipientServices(address recipient) external view returns (uint256[] memory) {
        return _recipientServices[recipient];
    }
    
    /**
     * @dev Get all services issued by a server
     */
    function getServerServices(address server) external view returns (uint256[] memory) {
        return _serverServices[server];
    }
    
    /**
     * @dev Check if a service has been acknowledged
     */
    function isServiceAcknowledged(uint256 serviceId) external view returns (bool) {
        return serviceTokens[serviceId].acknowledged;
    }
    
    /**
     * @dev Get service details with acceptance status
     */
    function getServiceStatus(uint256 serviceId) external view returns (
        address recipient,
        address server,
        string memory caseNumber,
        string memory documentType,
        uint256 issuedAt,
        bool acknowledged,
        uint256 acceptedAt
    ) {
        ServiceToken memory service = serviceTokens[serviceId];
        DocumentToken memory document = documentTokens[service.documentTokenId];
        
        return (
            service.recipient,
            service.server,
            service.caseNumber,
            service.documentType,
            service.issuedAt,
            service.acknowledged,
            document.acceptedAt
        );
    }
    
    // Admin functions
    function authorizeServer(address server, bool authorized) external onlyAdmin {
        authorizedServers[server] = authorized;
    }
    
    function setAdmin(address admin, bool isAdmin) external onlyAdmin {
        admins[admin] = isAdmin;
    }
    
    function updateFee(uint256 newFee) external onlyAdmin {
        serviceFee = newFee;
    }
    
    function setFeeExemption(address user, bool exempt) external onlyAdmin {
        feeExempt[user] = exempt;
    }
    
    // ERC721 Basic Implementation
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _tokenOwners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }
    
    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "Invalid address");
        uint256 balance = 0;
        
        // Count service tokens
        for (uint256 i = 1; i <= _serviceCounter; i++) {
            if (_tokenOwners[i] == owner && _tokenTypes[i] == TokenType.SERVICE) {
                balance++;
            }
        }
        
        // Count document tokens
        for (uint256 i = 1; i <= _documentCounter; i++) {
            if (_tokenOwners[i] == owner && _tokenTypes[i] == TokenType.DOCUMENT) {
                balance++;
            }
        }
        
        return balance;
    }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_tokenOwners[tokenId] != address(0), "Token does not exist");
        
        if (_tokenTypes[tokenId] == TokenType.SERVICE) {
            // Return data URI with preview image for wallet display
            ServiceToken memory service = serviceTokens[tokenId];
            return string(abi.encodePacked(
                "data:application/json;base64,",
                _encodeServiceMetadata(tokenId, service)
            ));
        } else {
            // Return IPFS URI for document
            DocumentToken memory document = documentTokens[tokenId];
            return string(abi.encodePacked("ipfs://", document.ipfsHash));
        }
    }
    
    function _encodeServiceMetadata(uint256 tokenId, ServiceToken memory service) 
        private 
        pure 
        returns (string memory) 
    {
        // This would encode the service data as base64 JSON
        // Including the preview image for wallet display
        // Implementation depends on base64 library
        return "";
    }
    
    // Minimal transfer functions (service tokens are non-transferable)
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_tokenTypes[tokenId] == TokenType.DOCUMENT, "Service tokens are non-transferable");
        require(ownerOf(tokenId) == from, "Not token owner");
        require(msg.sender == from || _tokenApprovals[tokenId] == msg.sender || 
                _operatorApprovals[from][msg.sender], "Not authorized");
        
        _tokenOwners[tokenId] = to;
        _tokenApprovals[tokenId] = address(0);
        
        emit Transfer(from, to, tokenId);
    }
    
    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }
    
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
}