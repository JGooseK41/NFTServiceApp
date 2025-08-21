/**
 * Diagnose PDF issues to understand why pages aren't being extracted
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function diagnosePDF(pdfPath) {
    console.log(`\n=== Diagnosing: ${path.basename(pdfPath)} ===\n`);
    
    const buffer = await fs.readFile(pdfPath);
    console.log(`File size: ${(buffer.length / 1024).toFixed(2)} KB`);
    
    // 1. Try regular load
    console.log('\n1. Regular PDFDocument.load():');
    try {
        const pdf = await PDFDocument.load(buffer);
        const pageCount = pdf.getPageCount();
        console.log(`   ✅ Success: ${pageCount} pages`);
        
        // Try to get info about each page
        for (let i = 0; i < pageCount; i++) {
            try {
                const page = pdf.getPage(i);
                const { width, height } = page.getSize();
                console.log(`   Page ${i + 1}: ${width}x${height}`);
            } catch (e) {
                console.log(`   Page ${i + 1}: ERROR - ${e.message}`);
            }
        }
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        if (error.stack) {
            const lines = error.stack.split('\n').slice(0, 3);
            lines.forEach(line => console.log(`      ${line}`));
        }
    }
    
    // 2. Try with ignoreEncryption
    console.log('\n2. PDFDocument.load() with ignoreEncryption:');
    try {
        const pdf = await PDFDocument.load(buffer, { 
            ignoreEncryption: true,
            updateMetadata: false,
            throwOnInvalidObject: false 
        });
        const pageCount = pdf.getPageCount();
        console.log(`   ✅ Success: ${pageCount} pages`);
        
        // Try to copy pages
        console.log('   Testing page copying:');
        const testPdf = await PDFDocument.create();
        let copied = 0;
        let failed = 0;
        
        for (let i = 0; i < pageCount; i++) {
            try {
                const [page] = await testPdf.copyPages(pdf, [i]);
                testPdf.addPage(page);
                copied++;
                console.log(`   Page ${i + 1}: ✅ Copied`);
            } catch (e) {
                failed++;
                console.log(`   Page ${i + 1}: ❌ ${e.message}`);
            }
        }
        console.log(`   Summary: ${copied} copied, ${failed} failed`);
        
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
    
    // 3. Use external tools to get info
    console.log('\n3. External tool analysis:');
    
    // Try pdfinfo
    try {
        const result = await execPromise(`pdfinfo "${pdfPath}" 2>&1`);
        console.log('   pdfinfo output:');
        const lines = result.stdout.split('\n').filter(l => l.includes('Pages') || l.includes('Encrypted') || l.includes('Error'));
        lines.forEach(line => console.log(`      ${line}`));
    } catch (e) {
        console.log('   pdfinfo not available or failed');
    }
    
    // Try qpdf --show-pages
    try {
        const result = await execPromise(`qpdf --show-pages "${pdfPath}" 2>&1 | head -20`);
        console.log('   qpdf --show-pages:');
        const pageMatches = result.stdout.match(/page \d+:/g);
        if (pageMatches) {
            console.log(`      Found ${pageMatches.length} pages`);
        }
    } catch (e) {
        console.log('   qpdf not available or failed');
    }
    
    // Try gs to count pages
    try {
        const gsCommand = `gs -q -dNODISPLAY -c "(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit"`;
        const result = await execPromise(gsCommand);
        console.log(`   Ghostscript page count: ${result.stdout.trim()}`);
    } catch (e) {
        console.log('   Ghostscript page count failed');
    }
    
    // 4. Check for specific issues
    console.log('\n4. PDF Structure Analysis:');
    
    // Check if it's linearized
    const headerBytes = buffer.slice(0, 1024).toString('latin1');
    if (headerBytes.includes('Linearized')) {
        console.log('   ⚠️ PDF is linearized (web-optimized)');
    }
    
    // Check PDF version
    const versionMatch = headerBytes.match(/%PDF-(\d\.\d)/);
    if (versionMatch) {
        console.log(`   PDF Version: ${versionMatch[1]}`);
    }
    
    // Check for encryption
    if (headerBytes.includes('/Encrypt')) {
        console.log('   ⚠️ PDF has encryption dictionary');
    }
    
    // Look for xref issues
    const content = buffer.toString('latin1');
    const xrefMatches = content.match(/xref/g);
    const trailerMatches = content.match(/trailer/g);
    console.log(`   xref sections: ${xrefMatches ? xrefMatches.length : 0}`);
    console.log(`   trailer sections: ${trailerMatches ? trailerMatches.length : 0}`);
    
    // Check for object streams (compressed objects)
    if (content.includes('/ObjStm')) {
        console.log('   ⚠️ PDF uses object streams (compressed objects)');
    }
    
    // Check for cross-reference streams
    if (content.includes('/XRef')) {
        console.log('   ⚠️ PDF uses cross-reference streams');
    }
}

// Main function to run diagnosis
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node diagnose-pdf.js <pdf-file-path>');
        console.log('\nLooking for case PDFs in uploads/pdfs/cases/...');
        
        // Try to find the problematic PDF
        const casePath = path.join(__dirname, 'uploads', 'pdfs', 'cases', '34-9633897');
        try {
            const files = await fs.readdir(casePath);
            const pdfFile = files.find(f => f.endsWith('.pdf'));
            if (pdfFile) {
                console.log(`\nFound case PDF: ${pdfFile}`);
                await diagnosePDF(path.join(casePath, pdfFile));
            }
        } catch (e) {
            console.log('\nNo case PDFs found. Please provide a PDF path as argument.');
        }
        
        return;
    }
    
    const pdfPath = args[0];
    
    try {
        await fs.access(pdfPath);
        await diagnosePDF(pdfPath);
    } catch (error) {
        console.error(`Error: Cannot access file ${pdfPath}`);
    }
}

main().catch(console.error);