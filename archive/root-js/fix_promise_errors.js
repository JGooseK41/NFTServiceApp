const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Promise syntax errors in UI...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Fix the first occurrence at line 9238
console.log('Fixing first Promise error...');
content = content.replace(
    'noticeInfo = [object Promise];',
    `noticeInfo = await legalContract.getNotice(notice.id).call();
                    // Parse the optimized contract data
                    const metadata = parseMetadata(noticeInfo.metadata);
                    const packedInfo = parsePackedData(noticeInfo.packedData);
                    
                    // Create a compatible structure
                    noticeInfo = {
                        recipient: noticeInfo.recipient,
                        sender: noticeInfo.sender,
                        publicText: noticeInfo.publicText,
                        noticeType: metadata.noticeType,
                        caseNumber: metadata.caseNumber,
                        issuingAgency: metadata.issuingAgency,
                        timestamp: packedInfo.timestamp,
                        accepted: packedInfo.accepted,
                        hasDocument: packedInfo.hasDocument,
                        serverId: packedInfo.serverId,
                        tokenName: noticeInfo.tokenName
                    };`
);

// Fix the second occurrence at line 9576
console.log('Fixing second Promise error...');
content = content.replace(
    'const noticeInfo = [object Promise];',
    `const notice = await legalContract.getNotice(alertId).call();
                // Parse the optimized contract data
                const metadata = parseMetadata(notice.metadata);
                const packedInfo = parsePackedData(notice.packedData);
                
                const noticeInfo = {
                    recipient: notice.recipient,
                    sender: notice.sender,
                    publicText: notice.publicText,
                    noticeType: metadata.noticeType,
                    caseNumber: metadata.caseNumber,
                    issuingAgency: metadata.issuingAgency,
                    timestamp: packedInfo.timestamp,
                    accepted: packedInfo.accepted,
                    hasDocument: packedInfo.hasDocument,
                    serverId: packedInfo.serverId,
                    tokenName: notice.tokenName
                };`
);

// Save the fixed file
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed Promise syntax errors!');
console.log('\nThe UI should now load properly.');