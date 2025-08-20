// Simplified backend for testing - no Lit Protocol yet
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory storage for testing
const documents = new Map();

// Contract configuration - UPDATE THIS!
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
const CONTRACT_ABI = [
  "event NoticeServed(uint256 indexed noticeId, address indexed recipient, address indexed server, string metadataURI, uint256 timestamp, uint256 serviceFee, bool feesSponsored)",
  "event NoticeAccepted(uint256 indexed noticeId, address indexed recipient, uint256 timestamp, bytes signature)"
];

// Test endpoint - no IPFS/Lit needed
app.post('/api/test-upload', async (req, res) => {
  try {
    const { document, metadata } = req.body;
    
    // Generate fake IPFS hash for testing
    const fakeHash = 'Qm' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store locally
    documents.set(fakeHash, {
      document,
      metadata,
      encrypted: false // Not encrypted for testing
    });
    
    res.json({ 
      success: true, 
      ipfsHash: fakeHash,
      metadataURI: `ipfs://${fakeHash}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get document (no encryption for testing)
app.get('/api/document/:hash', async (req, res) => {
  try {
    const doc = documents.get(req.params.hash);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test backend running on port ${PORT}`);
  console.log('This is a simplified version without Lit Protocol encryption');
});