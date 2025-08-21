/**
 * Deep analysis of the problematic PDF
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function analyzePDF() {
    const pdfPath = '7 NFT Summons Issued.pdf';
    const buffer = fs.readFileSync(pdfPath);
    
    console.log('=== PDF Analysis: 7 NFT Summons Issued.pdf ===\n');
    console.log(`File size: ${(buffer.length / 1024).toFixed(2)} KB`);
    
    // Check PDF header
    const header = buffer.slice(0, 100).toString('latin1');
    console.log(`\nPDF Header: ${header.substring(0, 30).replace(/[\r\n]/g, ' ')}`);
    
    // Try to find page count in the raw data
    const content = buffer.toString('latin1');
    
    // Look for /Type /Page markers
    const pageMatches = content.match(/\/Type\s*\/Page(?![s])/g);
    console.log(`\nRaw /Type /Page markers found: ${pageMatches ? pageMatches.length : 0}`);
    
    // Look for /Pages with /Count
    const countMatch = content.match(/\/Count\s+(\d+)/);
    if (countMatch) {
        console.log(`Page count from /Count: ${countMatch[1]}`);
    }
    
    // Try to load with various options
    console.log('\n=== Loading Attempts ===\n');
    
    // Attempt 1: With ignoreEncryption
    console.log('1. Trying with ignoreEncryption:');
    try {
        const pdf = await PDFDocument.load(buffer, { 
            ignoreEncryption: true,
            updateMetadata: false,
            throwOnInvalidObject: false,
            capNumbers: false
        });
        
        const pageCount = pdf.getPageCount();
        console.log(`   ✅ Loaded! Page count: ${pageCount}`);
        
        // Try to get info about each page
        for (let i = 0; i < pageCount; i++) {
            try {
                const page = pdf.getPage(i);
                const { width, height } = page.getSize();
                console.log(`   Page ${i + 1}: ${width}x${height}`);
                
                // Try to copy this page
                const testPdf = await PDFDocument.create();
                try {
                    const [copiedPage] = await testPdf.copyPages(pdf, [i]);
                    console.log(`      ✅ Can copy page ${i + 1}`);
                } catch (e) {
                    console.log(`      ❌ Cannot copy page ${i + 1}: ${e.message.substring(0, 50)}`);
                }
            } catch (e) {
                console.log(`   Page ${i + 1}: ERROR - ${e.message}`);
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        
        // Try to parse the error for more info
        if (error.message.includes('Invalid object ref')) {
            console.log('\n   Missing object references detected:');
            const refs = error.message.match(/\d+ \d+ R/g);
            if (refs) {
                refs.forEach(ref => console.log(`      - ${ref}`));
            }
        }
    }
    
    // Check for specific corruption patterns
    console.log('\n=== Corruption Analysis ===\n');
    
    // Check for invalid xref entries
    const xrefIndex = content.indexOf('xref');
    if (xrefIndex > -1) {
        const xrefSection = content.substring(xrefIndex, xrefIndex + 500);
        console.log('First xref section (truncated):');
        console.log(xrefSection.substring(0, 200).replace(/[\r\n]+/g, '\n'));
    }
    
    // Look for damaged objects
    const objectRefs = ['28 0 R', '13 0 R', '15 0 R', '16 0 R'];
    console.log('\nSearching for corrupt object references:');
    objectRefs.forEach(ref => {
        const objPattern = new RegExp(`${ref.replace(' R', '\\s+\\d+\\s+obj')}`);
        const found = content.match(objPattern);
        console.log(`   ${ref}: ${found ? 'Found in file' : 'NOT FOUND (missing!)'}`);
    });
    
    // Check if it's a hybrid PDF (has both xref table and xref stream)
    const hasXrefTable = content.includes('\nxref\n');
    const hasXrefStream = content.includes('/XRef');
    console.log(`\nPDF Structure:`);
    console.log(`   Has xref table: ${hasXrefTable}`);
    console.log(`   Has xref stream: ${hasXrefStream}`);
    console.log(`   Is hybrid: ${hasXrefTable && hasXrefStream}`);
    
    // Look for encryption info
    const encryptIndex = content.indexOf('/Encrypt');
    if (encryptIndex > -1) {
        console.log('\nEncryption detected:');
        const encryptSection = content.substring(encryptIndex, encryptIndex + 200);
        console.log(encryptSection.substring(0, 150).replace(/[\r\n]+/g, ' '));
    }
    
    console.log('\n=== Summary ===\n');
    console.log('This PDF has:');
    console.log('1. Encryption that prevents normal loading');
    console.log('2. Missing object references (28, 13, 15, 16)');
    console.log('3. Linearization (web optimization)');
    console.log('4. Cross-reference streams (compressed xref)');
    console.log('5. Object streams (compressed objects)');
    console.log('\nThe combination of encryption + missing objects is preventing proper page extraction.');
    console.log('Ghostscript can only recover 1 page because the other pages reference the missing objects.');
}

analyzePDF().catch(console.error);