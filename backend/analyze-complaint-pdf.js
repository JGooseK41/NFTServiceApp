/**
 * Analyze why Complaint PDF shows blank pages
 */

const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

async function analyzeComplaintPDF() {
    const pdfPath = '3 Complaint.pdf';
    const buffer = fs.readFileSync(pdfPath);
    
    console.log('=== Analyzing: 3 Complaint.pdf ===\n');
    
    try {
        // Load with ignoreEncryption
        const pdf = await PDFDocument.load(buffer, { 
            ignoreEncryption: true,
            updateMetadata: false
        });
        
        const pageCount = pdf.getPageCount();
        console.log(`Loaded ${pageCount} pages\n`);
        
        // Check each page for content
        console.log('Page Content Analysis:');
        for (let i = 0; i < Math.min(5, pageCount); i++) {
            const page = pdf.getPage(i);
            const { width, height } = page.getSize();
            
            console.log(`\nPage ${i + 1}:`);
            console.log(`  Size: ${width}x${height}`);
            
            // Check for content streams
            const contents = page.node.Contents();
            console.log(`  Has content streams: ${contents ? 'Yes' : 'No'}`);
            
            // Check for resources
            const resources = page.node.Resources();
            console.log(`  Has resources: ${resources ? 'Yes' : 'No'}`);
            
            if (resources) {
                // Check for fonts
                try {
                    const fonts = resources.lookup('Font');
                    console.log(`  Has fonts: ${fonts ? 'Yes' : 'No'}`);
                } catch (e) {
                    console.log(`  Fonts: Error accessing`);
                }
                
                // Check for images
                try {
                    const xobjects = resources.lookup('XObject');
                    console.log(`  Has XObjects (images): ${xobjects ? 'Yes' : 'No'}`);
                } catch (e) {
                    console.log(`  XObjects: Error accessing`);
                }
            }
            
            // Try to get text content
            try {
                // This is a simplified check - actual text extraction is complex
                const contentStream = contents ? contents.toString() : '';
                const hasText = contentStream.includes('Tj') || contentStream.includes('TJ');
                const hasDrawing = contentStream.includes(' m ') || contentStream.includes(' l ');
                console.log(`  Has text operations: ${hasText}`);
                console.log(`  Has drawing operations: ${hasDrawing}`);
            } catch (e) {
                console.log(`  Content analysis failed: ${e.message}`);
            }
        }
        
        // Test copying to a new PDF
        console.log('\n=== Testing Page Copy ===\n');
        const testPdf = await PDFDocument.create();
        
        // Copy first page
        const [firstPage] = await testPdf.copyPages(pdf, [0]);
        testPdf.addPage(firstPage);
        
        // Try to add visible content to verify the page
        const helvetica = await testPdf.embedFont(require('pdf-lib').StandardFonts.Helvetica);
        firstPage.drawText('TEST OVERLAY', {
            x: 50,
            y: 50,
            size: 20,
            font: helvetica,
            color: rgb(1, 0, 0)
        });
        
        // Save test PDF
        const testBytes = await testPdf.save();
        fs.writeFileSync('test-complaint-copy.pdf', testBytes);
        console.log('Created test-complaint-copy.pdf with first page + test overlay');
        
        // Check if the issue is with the content being white or transparent
        console.log('\n=== Possible Issues ===\n');
        console.log('1. Content might be white text on white background');
        console.log('2. Content might be using transparency/opacity settings');
        console.log('3. Content might be clipped or masked');
        console.log('4. Font resources might not be embedded properly');
        console.log('5. The encryption might be affecting rendering but not copying');
        
        // Try a different copy method
        console.log('\n=== Alternative Copy Method ===\n');
        const altPdf = await PDFDocument.create();
        
        for (let i = 0; i < Math.min(3, pageCount); i++) {
            try {
                // Copy page
                const [page] = await altPdf.copyPages(pdf, [i]);
                
                // Get page dimensions
                const { width, height } = page.getSize();
                
                // Add page but also add a border to see if page is there
                altPdf.addPage(page);
                
                // Draw a border to verify page exists
                page.drawRectangle({
                    x: 10,
                    y: 10,
                    width: width - 20,
                    height: height - 20,
                    borderColor: rgb(0, 0, 1),
                    borderWidth: 1,
                    opacity: 0.5
                });
                
                console.log(`Page ${i + 1}: Added with blue border`);
            } catch (e) {
                console.log(`Page ${i + 1}: Failed - ${e.message}`);
            }
        }
        
        const altBytes = await altPdf.save();
        fs.writeFileSync('test-complaint-bordered.pdf', altBytes);
        console.log('\nCreated test-complaint-bordered.pdf with borders on first 3 pages');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

analyzeComplaintPDF().catch(console.error);