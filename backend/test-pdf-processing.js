/**
 * Test PDF processing locally to debug issues
 */

const fs = require('fs').promises;
const path = require('path');
const PDFCleaner = require('./pdf-cleaner');
const { PDFDocument } = require('pdf-lib');

async function testPDFProcessing() {
    console.log('=== PDF Processing Test ===\n');
    
    // Check for test PDFs in uploads/pdfs directory
    const pdfDir = path.join(__dirname, 'uploads', 'pdfs');
    
    try {
        await fs.access(pdfDir);
        const files = await fs.readdir(pdfDir);
        const pdfFiles = files.filter(f => f.endsWith('.pdf'));
        
        if (pdfFiles.length === 0) {
            console.log('No PDF files found in uploads/pdfs/');
            console.log('Please place test PDFs there and run again.');
            return;
        }
        
        console.log(`Found ${pdfFiles.length} PDF files to test:\n`);
        
        // Test each PDF individually first
        const pdfBuffers = [];
        const fileInfo = [];
        
        for (const pdfFile of pdfFiles) {
            const filePath = path.join(pdfDir, pdfFile);
            console.log(`\n--- Testing ${pdfFile} ---`);
            
            const buffer = await fs.readFile(filePath);
            pdfBuffers.push(buffer);
            fileInfo.push({ fileName: pdfFile });
            
            // Try to load with regular pdf-lib
            console.log('1. Testing regular load...');
            try {
                const pdf = await PDFDocument.load(buffer);
                const pageCount = pdf.getPageCount();
                console.log(`   ✅ Regular load successful: ${pageCount} pages`);
            } catch (error) {
                console.log(`   ❌ Regular load failed: ${error.message}`);
            }
            
            // Try with ignoreEncryption
            console.log('2. Testing with ignoreEncryption...');
            try {
                const pdf = await PDFDocument.load(buffer, { 
                    ignoreEncryption: true,
                    updateMetadata: false,
                    throwOnInvalidObject: false 
                });
                const pageCount = pdf.getPageCount();
                console.log(`   ✅ Ignore encryption successful: ${pageCount} pages`);
                
                // Try to copy pages
                console.log('3. Testing page copying...');
                const testPdf = await PDFDocument.create();
                let copiedPages = 0;
                
                for (let i = 0; i < pageCount; i++) {
                    try {
                        const [page] = await testPdf.copyPages(pdf, [i]);
                        testPdf.addPage(page);
                        copiedPages++;
                    } catch (pageError) {
                        console.log(`   ⚠️ Could not copy page ${i + 1}: ${pageError.message}`);
                    }
                }
                console.log(`   📄 Copied ${copiedPages}/${pageCount} pages`);
                
            } catch (error) {
                console.log(`   ❌ Ignore encryption failed: ${error.message}`);
            }
        }
        
        // Now test the cleaner
        console.log('\n\n=== Testing PDF Cleaner ===\n');
        const cleaner = new PDFCleaner();
        
        try {
            const mergedPdf = await cleaner.cleanAndMergePDFs(pdfBuffers, fileInfo);
            
            // Save the result
            const outputPath = path.join(pdfDir, 'merged_output.pdf');
            await fs.writeFile(outputPath, mergedPdf);
            
            console.log(`\n✅ Merged PDF saved to: ${outputPath}`);
            console.log(`   Size: ${(mergedPdf.length / 1024 / 1024).toFixed(2)} MB`);
            
            // Try to load the merged PDF to verify it
            const verifyPdf = await PDFDocument.load(mergedPdf);
            console.log(`   Pages: ${verifyPdf.getPageCount()}`);
            
        } catch (error) {
            console.error('\n❌ Cleaner failed:', error);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.log('\nPlease create uploads/pdfs/ directory and add test PDFs');
    }
}

// Run the test
testPDFProcessing().catch(console.error);