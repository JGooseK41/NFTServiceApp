/**
 * Test different ways to load and process the PDFs
 * Since the PDFs display correctly in viewers, the content must be accessible
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function testPDFLoading() {
    const files = [
        '3 Complaint.pdf',
        '7 NFT Summons Issued.pdf'
    ];
    
    for (const file of files) {
        console.log(`\n=== Testing ${file} ===\n`);
        const buffer = fs.readFileSync(file);
        
        // Test 1: Try without any flags
        console.log('1. Default load (will fail for encrypted):');
        try {
            const pdf1 = await PDFDocument.load(buffer);
            console.log(`   ✅ Loaded: ${pdf1.getPageCount()} pages`);
        } catch (e) {
            console.log(`   ❌ ${e.message.substring(0, 80)}`);
        }
        
        // Test 2: With ignoreEncryption only
        console.log('\n2. With ignoreEncryption only:');
        try {
            const pdf2 = await PDFDocument.load(buffer, { ignoreEncryption: true });
            const pageCount = pdf2.getPageCount();
            console.log(`   ✅ Loaded: ${pageCount} pages`);
            
            // Check if we can actually read the content
            const page = pdf2.getPage(0);
            console.log(`   First page size: ${page.getWidth()}x${page.getHeight()}`);
            
            // Try to access the raw content stream
            const contents = page.node.Contents();
            if (contents) {
                const stream = contents.toString();
                console.log(`   Content stream length: ${stream.length} bytes`);
                
                // Look for common PDF operators
                const hasText = stream.includes('Tj') || stream.includes('TJ') || stream.includes('Tf');
                const hasImages = stream.includes('Do') || stream.includes('BI');
                const hasGraphics = stream.includes(' m ') || stream.includes(' l ') || stream.includes(' c ');
                
                console.log(`   Has text operators: ${hasText}`);
                console.log(`   Has image operators: ${hasImages}`);
                console.log(`   Has graphics operators: ${hasGraphics}`);
                
                // Check if content might be in a form XObject
                const resources = page.node.Resources();
                if (resources) {
                    const xobj = resources.get('XObject');
                    if (xobj) {
                        console.log(`   Has XObject resources: Yes`);
                        // XObjects can contain the actual page content
                    }
                }
            }
        } catch (e) {
            console.log(`   ❌ ${e.message.substring(0, 80)}`);
        }
        
        // Test 3: Try different flag combinations
        console.log('\n3. With all tolerance flags:');
        try {
            const pdf3 = await PDFDocument.load(buffer, { 
                ignoreEncryption: true,
                updateMetadata: false,
                throwOnInvalidObject: false,
                capNumbers: false
            });
            console.log(`   ✅ Loaded: ${pdf3.getPageCount()} pages`);
            
            // Try creating a new PDF and copying content differently
            const newPdf = await PDFDocument.create();
            
            // Method A: Copy pages normally
            try {
                const [page1] = await newPdf.copyPages(pdf3, [0]);
                console.log('   ✅ Can copy pages normally');
            } catch (e) {
                console.log('   ❌ Normal copy failed');
            }
            
            // Method B: Try to embed the pages differently
            try {
                const pages = pdf3.getPages();
                console.log(`   Total pages object count: ${pages.length}`);
            } catch (e) {
                console.log('   ❌ Cannot enumerate pages');
            }
            
        } catch (e) {
            console.log(`   ❌ ${e.message.substring(0, 80)}`);
        }
        
        // Test 4: Check the actual PDF structure
        console.log('\n4. Raw PDF structure:');
        const pdfText = buffer.toString('latin1');
        
        // Check PDF version
        const version = pdfText.match(/%PDF-(\d\.\d)/);
        console.log(`   PDF Version: ${version ? version[1] : 'Unknown'}`);
        
        // Check for encryption
        console.log(`   Has /Encrypt: ${pdfText.includes('/Encrypt')}`);
        
        // Check for different content storage methods
        console.log(`   Has /Contents: ${pdfText.includes('/Contents')}`);
        console.log(`   Has stream objects: ${(pdfText.match(/stream/g) || []).length}`);
        console.log(`   Has endstream markers: ${(pdfText.match(/endstream/g) || []).length}`);
        
        // Check for form XObjects (often used for complex content)
        console.log(`   Has /Form subtype: ${pdfText.includes('/Form')}`);
        
        // Check for specific compression
        console.log(`   Uses FlateDecode: ${pdfText.includes('/FlateDecode')}`);
        console.log(`   Uses DCTDecode (JPEG): ${pdfText.includes('/DCTDecode')}`);
    }
}

testPDFLoading().catch(console.error);