const fs = require('fs');
const path = require('path');

console.log('🔧 Updating UI for Optimized Contract...\n');

// Read the current index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Read the new ABI
const abiPath = path.join(__dirname, 'contracts', 'LegalNoticeNFT_Optimized.abi');
const newABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

console.log('📋 Key changes to implement:');
console.log('1. Update CONTRACT_ABI with new ABI');
console.log('2. Change createDocumentNotice/createTextNotice to single createNotice');
console.log('3. Update data parsing for combined fields');
console.log('4. Update event parsing for simplified events');
console.log('5. Update getter functions to handle struct returns\n');

// 1. Update the CONTRACT_ABI
console.log('✅ Updating CONTRACT_ABI...');
const abiRegex = /const CONTRACT_ABI = \[[\s\S]*?\];/;
const newABIString = `const CONTRACT_ABI = ${JSON.stringify(newABI, null, 4)};`;
content = content.replace(abiRegex, newABIString);

// 2. Update createLegalNotice function to use new struct format
console.log('✅ Updating createLegalNotice function...');

// Find and replace the create notice logic
const oldCreatePattern = /if \(hasDocument\) \{[\s\S]*?await contract\.createDocumentNotice[\s\S]*?\} else \{[\s\S]*?await contract\.createTextNotice[\s\S]*?\}/;

const newCreateLogic = `// Prepare notice request struct
                const noticeRequest = {
                    recipient: recipientAddr,
                    publicText: publicText || noticeText,
                    noticeType: noticeType,
                    caseNumber: caseNumber,
                    issuingAgency: agency,
                    baseTokenName: tokenName,
                    hasDocument: hasDocument,
                    encryptedIPFS: hasDocument ? encryptedIPFS : '',
                    encryptionKey: hasDocument ? encryptionKey : ''
                };
                
                console.log('Creating notice with request:', noticeRequest);
                
                const result = await contract.createNotice(noticeRequest).send({
                    feeLimit: 1000000000,
                    callValue: feeInSun
                });`;

content = content.replace(oldCreatePattern, newCreateLogic);

// 3. Update batch creation for new struct format
console.log('✅ Updating batch notice creation...');

const oldBatchPattern = /const batchParams = \{[\s\S]*?\};[\s\S]*?await contract\.createBatchNotices\(recipients, batchParams\)/;

const newBatchLogic = `// Prepare batch request struct
                const batchRequest = {
                    recipients: recipients,
                    publicText: publicText || '',
                    metadata: \`\${noticeType}|\${caseNumber}|\${agency}\`,
                    documentData: hasDocument ? \`\${encryptedIPFS}|\${encryptionKey}\` : '',
                    tokenNamePrefix: tokenNamePrefix,
                    hasDocument: hasDocument,
                    sponsorFees: sponsorFees
                };
                
                console.log('Creating batch notices with request:', batchRequest);
                
                const result = await contract.createBatchNotices(batchRequest)`;

content = content.replace(oldBatchPattern, newBatchLogic);

// 4. Update event parsing
console.log('✅ Updating event parsing for NoticeCreated...');

// Update event parsing to handle fewer parameters
const oldEventParse = /if \(event\.event === 'NoticeCreated'\) \{[\s\S]*?const \{ noticeId, recipient, sender, hasDocument: docFlag, timestamp, serverId, tokenName \} = event\.result;/;

const newEventParse = `if (event.event === 'NoticeCreated') {
                            const { noticeId, recipient, sender } = event.result;
                            // Fetch additional data from contract if needed
                            const noticeData = await contract.getNotice(noticeId).call();`;

content = content.replace(oldEventParse, newEventParse);

// 5. Add helper functions for data parsing
console.log('✅ Adding helper functions for data parsing...');

const helperFunctions = `
// Helper functions for parsing optimized contract data
function parseMetadata(metadata) {
    const parts = metadata.split('|');
    return {
        noticeType: parts[0] || '',
        caseNumber: parts[1] || '',
        issuingAgency: parts[2] || ''
    };
}

function parseDocumentData(documentData) {
    const parts = documentData.split('|');
    return {
        encryptedIPFS: parts[0] || '',
        encryptionKey: parts[1] || ''
    };
}

function parsePackedData(packedData) {
    const data = BigInt(packedData);
    return {
        timestamp: Number(data >> 192n),
        serverId: Number((data >> 64n) & 0xFFFFFFFFFFFFFFFFn),
        hasDocument: (data & 1n) === 1n,
        accepted: ((data >> 1n) & 1n) === 1n
    };
}

`;

// Insert helper functions after CONTRACT_ABI
const abiEndIndex = content.indexOf('const CONTRACT_ABI');
const insertPoint = content.indexOf('];', abiEndIndex) + 2;
content = content.slice(0, insertPoint) + '\n' + helperFunctions + content.slice(insertPoint);

// 6. Update notice info display
console.log('✅ Updating notice info retrieval...');

const oldGetNoticeInfo = /const noticeInfo = await contract\.getNoticeInfo\(noticeId\)\.call\(\);[\s\S]*?const \[recipient, sender, publicText, noticeType, caseNumber, issuingAgency, timestamp, accepted, hasDocument, serverId, tokenName\] = noticeInfo;/g;

const newGetNoticeInfo = `const notice = await contract.getNotice(noticeId).call();
                const metadata = parseMetadata(notice.metadata);
                const packedInfo = parsePackedData(notice.packedData);
                
                // Extract fields
                const recipient = notice.recipient;
                const sender = notice.sender;
                const publicText = notice.publicText;
                const noticeType = metadata.noticeType;
                const caseNumber = metadata.caseNumber;
                const issuingAgency = metadata.issuingAgency;
                const timestamp = packedInfo.timestamp;
                const accepted = packedInfo.accepted;
                const hasDocument = packedInfo.hasDocument;
                const serverId = packedInfo.serverId;
                const tokenName = notice.tokenName;`;

content = content.replace(oldGetNoticeInfo, newGetNoticeInfo);

// Save the updated file
fs.writeFileSync(indexPath, content);

console.log('\n✅ UI updates completed!');
console.log('\n📝 Summary of changes:');
console.log('- Updated CONTRACT_ABI to optimized version');
console.log('- Changed notice creation to use struct parameters');
console.log('- Added helper functions for parsing combined data');
console.log('- Updated event parsing for simplified events');
console.log('- Modified getter functions to handle struct returns');
console.log('\n⚠️  Please test all functionality thoroughly!');
console.log('\n🎉 NFTs should now be trackable on Tronscan!');