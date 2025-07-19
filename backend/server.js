const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { create } = require('ipfs-http-client');
const LitJsSdk = require('@lit-protocol/lit-node-client');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
const ipfs = create({ url: 'https://ipfs.infura.io:5001/api/v0' });
const litNodeClient = new LitJsSdk.LitNodeClient({ alertWhenUnauthorized: false });

// Contract configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const CONTRACT_ABI = [
  "event NoticeServed(uint256 indexed noticeId, address indexed recipient, address indexed server, string metadataURI, uint256 timestamp, uint256 serviceFee, bool feesSponsored)",
  "event NoticeAccepted(uint256 indexed noticeId, address indexed recipient, uint256 timestamp, bytes signature)",
  "function serveNotice(address recipient, string calldata metadataURI, bool sponsorFees) external payable returns (uint256)",
  "function acceptNotice(uint256 noticeId, bytes calldata signature) external",
  "function notices(uint256) external view returns (address server, address recipient, string metadataURI, uint256 servedTime, uint256 acceptedTime, bool feesSponsored)"
];

// Initialize provider and contract
const provider = new ethers.providers.JsonRpcProvider(process.env.TRON_RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// In-memory database (use PostgreSQL/MongoDB in production)
const noticesDB = new Map();
const viewsDB = new Map();

/**
 * Upload document to IPFS with encryption
 */
app.post('/api/upload-document', async (req, res) => {
  try {
    const { 
      document, 
      recipient,
      issuingAgency,
      noticeType,
      caseNumber,
      caseDetails,
      legalRights,
      documentType 
    } = req.body;

    // Create metadata object
    const metadata = {
      issuingAgency,
      noticeType,
      caseNumber,
      caseDetails,
      legalRights,
      documentType,
      timestamp: Date.now()
    };

    // Encrypt document with Lit Protocol
    await litNodeClient.connect();
    
    const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain: 'tron' });
    
    // Define access control conditions - recipient must sign to decrypt
    const accessControlConditions = [
      {
        contractAddress: '',
        standardContractType: '',
        chain: 'tron',
        method: '',
        parameters: [':userAddress'],
        returnValueTest: {
          comparator: '=',
          value: recipient.toLowerCase()
        }
      }
    ];

    // Encrypt the document
    const { encryptedString, symmetricKey } = await LitJsSdk.encryptString(document);

    // Save encryption key to Lit Protocol
    const encryptedSymmetricKey = await litNodeClient.saveEncryptionKey({
      accessControlConditions,
      symmetricKey,
      authSig,
      chain: 'tron'
    });

    // Create combined object for IPFS
    const ipfsData = {
      metadata,
      encryptedDocument: await blobToBase64(encryptedString),
      encryptedSymmetricKey: LitJsSdk.uint8arrayToString(encryptedSymmetricKey, 'base16'),
      accessControlConditions
    };

    // Upload to IPFS
    const added = await ipfs.add(JSON.stringify(ipfsData));
    const ipfsHash = added.path;

    res.json({ 
      success: true, 
      ipfsHash,
      metadataURI: `ipfs://${ipfsHash}`
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Serve a notice (calls smart contract)
 */
app.post('/api/serve-notice', async (req, res) => {
  try {
    const { recipient, ipfsHash, sponsorFees, privateKey } = req.body;
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const contractWithSigner = contract.connect(wallet);
    
    const tx = await contractWithSigner.serveNotice(
      recipient,
      `ipfs://${ipfsHash}`,
      sponsorFees,
      {
        value: ethers.utils.parseEther(sponsorFees ? "22" : "20") // TRX
      }
    );
    
    const receipt = await tx.wait();
    const noticeId = receipt.events[0].args.noticeId.toString();
    
    // Store in local database
    noticesDB.set(noticeId, {
      recipient,
      server: wallet.address,
      ipfsHash,
      servedTime: Date.now(),
      sponsorFees
    });
    
    res.json({ 
      success: true, 
      noticeId,
      txHash: receipt.transactionHash
    });
    
  } catch (error) {
    console.error('Serve notice error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * View a notice (with Lit Protocol decryption)
 */
app.post('/api/view-notice', async (req, res) => {
  try {
    const { noticeId, authSig } = req.body;
    
    // Get notice from contract
    const notice = await contract.notices(noticeId);
    const ipfsHash = notice.metadataURI.replace('ipfs://', '');
    
    // Fetch from IPFS
    const chunks = [];
    for await (const chunk of ipfs.cat(ipfsHash)) {
      chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString());
    
    // Try to decrypt with Lit Protocol
    await litNodeClient.connect();
    
    try {
      const symmetricKey = await litNodeClient.getEncryptionKey({
        accessControlConditions: data.accessControlConditions,
        toDecrypt: data.encryptedSymmetricKey,
        chain: 'tron',
        authSig
      });
      
      const decryptedString = await LitJsSdk.decryptString(
        base64ToBlob(data.encryptedDocument),
        symmetricKey
      );
      
      // Log view
      viewsDB.set(`${noticeId}-${authSig.address}`, Date.now());
      
      res.json({
        success: true,
        metadata: data.metadata,
        document: decryptedString,
        decrypted: true
      });
      
    } catch (decryptError) {
      // User doesn't have access - return only metadata
      res.json({
        success: true,
        metadata: data.metadata,
        document: null,
        decrypted: false,
        error: 'Access denied - you must be the recipient to view this document'
      });
    }
    
  } catch (error) {
    console.error('View notice error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Accept a notice
 */
app.post('/api/accept-notice', async (req, res) => {
  try {
    const { noticeId, privateKey } = req.body;
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const contractWithSigner = contract.connect(wallet);
    
    // Create signature
    const message = `I acknowledge receipt of legal notice ${noticeId}`;
    const signature = await wallet.signMessage(message);
    
    const tx = await contractWithSigner.acceptNotice(noticeId, signature);
    const receipt = await tx.wait();
    
    res.json({ 
      success: true,
      txHash: receipt.transactionHash,
      signature
    });
    
  } catch (error) {
    console.error('Accept notice error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get notices for a recipient
 */
app.get('/api/notices/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Query events
    const filter = contract.filters.NoticeServed(null, address);
    const events = await contract.queryFilter(filter);
    
    const notices = await Promise.all(events.map(async (event) => {
      const notice = await contract.notices(event.args.noticeId);
      return {
        noticeId: event.args.noticeId.toString(),
        server: notice.server,
        metadataURI: notice.metadataURI,
        servedTime: notice.servedTime.toString(),
        acceptedTime: notice.acceptedTime.toString(),
        feesSponsored: notice.feesSponsored
      };
    }));
    
    res.json({ notices });
    
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray]);
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Legal Notice Backend running on port ${PORT}`);
  
  // Start listening to contract events
  contract.on('NoticeServed', (noticeId, recipient, server, metadataURI, timestamp, serviceFee, feesSponsored) => {
    console.log('New notice served:', {
      noticeId: noticeId.toString(),
      recipient,
      server,
      metadataURI
    });
  });
  
  contract.on('NoticeAccepted', (noticeId, recipient, timestamp, signature) => {
    console.log('Notice accepted:', {
      noticeId: noticeId.toString(),
      recipient,
      timestamp: new Date(timestamp * 1000)
    });
  });
});

module.exports = app;