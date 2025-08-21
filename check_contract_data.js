// Check what we're sending vs what contract expects

const contractExpects = {
    recipient: "address",      // TRON address
    encryptedIPFS: "string",   // IPFS hash
    encryptionKey: "string",   // Encryption key
    issuingAgency: "string",   // Agency name
    noticeType: "string",      // Type of notice
    caseNumber: "string",      // Case number
    caseDetails: "string",     // Details
    legalRights: "string",     // Rights text
    sponsorFees: "bool",       // Boolean for fees
    metadataURI: "string"      // Metadata URI
};

const weAreSending = {
    recipient: "recipientAddress - OK",
    encryptedIPFS: "ipfsHash || data.diskUrl || 'none' - POTENTIAL ISSUE",
    encryptionKey: "encryptionKey || 'none' - POTENTIAL ISSUE", 
    issuingAgency: "data.agency || 'Legal Services' - OK",
    noticeType: "'alert' - HARDCODED - POTENTIAL ISSUE",
    caseNumber: "data.caseNumber || '' - OK",
    caseDetails: "data.noticeText || default - OK",
    legalRights: "data.legalRights || default - OK",
    sponsorFees: "Boolean(data.sponsorFees) - OK",
    metadataURI: "metadataUri || '' - POTENTIAL ISSUE"
};

console.log("=== POTENTIAL ISSUES ===\n");

console.log("1. encryptedIPFS:");
console.log("   - Contract expects: Valid IPFS hash string");
console.log("   - We send: Could be 'none' or disk URL");
console.log("   - ISSUE: 'none' might not be valid, empty string '' might be better\n");

console.log("2. encryptionKey:");
console.log("   - Contract expects: Valid encryption key");
console.log("   - We send: Could be 'none'");
console.log("   - ISSUE: 'none' might not be valid, empty string '' might be better\n");

console.log("3. noticeType:");
console.log("   - Contract expects: string");
console.log("   - We send: Always 'alert' (hardcoded)");
console.log("   - ISSUE: Should this be dynamic? 'legal_notice'?\n");

console.log("4. metadataURI:");
console.log("   - Contract expects: Valid URI string");
console.log("   - We send: Could be empty string");
console.log("   - ISSUE: Empty string might cause issues\n");

console.log("5. Missing IPFS data:");
console.log("   - With Pinata now configured, we should have real IPFS hashes");
console.log("   - But if IPFS upload fails, we're sending disk URLs or 'none'");
console.log("   - Contract might reject non-IPFS format strings");
