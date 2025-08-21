/**
 * Test the specific case PDFs to understand the processing issue
 */

const { PDFDocument } = require('pdf-lib');
const PDFCleaner = require('./pdf-cleaner');

// Simulate the exact PDFs from the case
async function testCasePDFs() {
    console.log('=== Testing Case 34-9633897 PDFs ===\n');
    
    // These are the files mentioned in the logs
    const testFiles = [
        { name: '4 Order FInding Probable Cause.pdf', expectedPages: 2, actualPages: 2, status: '✅' },
        { name: '3 Complaint.pdf', expectedPages: 37, actualPages: 37, status: '✅' },
        { name: '7 NFT Summons Issued.pdf', expectedPages: 6, actualPages: 1, status: '❌' }
    ];
    
    console.log('Expected total pages: 45 (2 + 37 + 6)');
    console.log('Expected with separators: 47 (45 + 2 separator pages)');
    console.log('Actual merged: 40 pages + 2 separators = 42 total\n');
    
    console.log('File Analysis:');
    testFiles.forEach(file => {
        console.log(`${file.status} ${file.name}`);
        console.log(`   Expected: ${file.expectedPages} pages`);
        console.log(`   Actual: ${file.actualPages} pages`);
        if (file.actualPages !== file.expectedPages) {
            const missing = file.expectedPages - file.actualPages;
            console.log(`   ⚠️ MISSING: ${missing} pages`);
        }
    });
    
    console.log('\n=== Problem Diagnosis ===');
    console.log('\nDocument 3 (7 NFT Summons Issued.pdf) issues:');
    console.log('- Has corrupt object references (28 0 R, 13 0 R, 15 0 R, 16 0 R)');
    console.log('- Direct Load failed');
    console.log('- Ignore Encryption failed with invalid object errors');
    console.log('- QPDF failed (likely due to structural damage)');
    console.log('- Ghostscript succeeded but only extracted 1 page instead of ~6');
    console.log('\nPossible causes:');
    console.log('1. The PDF has 6 pages but 5 are completely corrupted');
    console.log('2. Ghostscript is stopping at the first error');
    console.log('3. The PDF has non-standard page tree structure');
    console.log('4. Pages 2-6 reference missing/corrupt resources');
    
    console.log('\n=== Recommended Solutions ===');
    console.log('1. Try mutool or pdftk which may handle corruption better');
    console.log('2. Use Ghostscript with -dPDFSTOPONERROR=false flag');
    console.log('3. Extract pages as images first, then rebuild PDF');
    console.log('4. Use a PDF repair tool before processing');
}

testCasePDFs();