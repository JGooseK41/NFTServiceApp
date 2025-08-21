const fs = require('fs').promises;
const path = require('path');
const PDFPrintProcessor = require('./backend/pdf-print-processor');

async function testPrintToPDF() {
    console.log('Testing Print-to-PDF with NFT Summons file...');
    
    const processor = new PDFPrintProcessor();
    
    try {
        // Read the problematic NFT Summons file
        const pdfBuffer = await fs.readFile('7 NFT Summons Issued.pdf');
        console.log(`Loaded PDF: ${pdfBuffer.length} bytes`);
        
        // Try to print it
        const result = await processor.printPDF(pdfBuffer, '7 NFT Summons Issued.pdf');
        
        if (result && result.success) {
            console.log(`✅ Success! Extracted ${result.pageCount} pages`);
            console.log(`Output size: ${result.buffer.length} bytes`);
            
            // Save the result
            await fs.writeFile('test_printed_summons.pdf', result.buffer);
            console.log('Saved to test_printed_summons.pdf');
        } else {
            console.log('❌ Print-to-PDF failed');
        }
        
        await processor.cleanup();
    } catch (error) {
        console.error('Error:', error);
        await processor.cleanup();
    }
}

testPrintToPDF();
