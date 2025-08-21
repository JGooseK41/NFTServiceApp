/**
 * PDF Cleaner - Enhanced Version
 * More robust handling of permission-protected PDFs
 * Multiple fallback strategies for difficult documents
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const execPromise = util.promisify(exec);
const PDFPrintProcessor = require('./pdf-print-processor');

class PDFCleaner {
    constructor() {
        this.tempDir = process.env.DISK_MOUNT_PATH 
            ? path.join(process.env.DISK_MOUNT_PATH, 'temp')
            : '/tmp';
        this.printProcessor = new PDFPrintProcessor();
    }

    /**
     * Clean and merge PDFs with enhanced multi-strategy approach
     */
    async cleanAndMergePDFs(pdfBuffers, fileInfo = []) {
        console.log(`🧹 Enhanced cleaning and merging ${pdfBuffers.length} PDFs`);
        
        // Ensure temp directory exists
        await fs.mkdir(this.tempDir, { recursive: true });
        
        const processedDocuments = [];
        
        // Process each PDF with comprehensive strategies
        for (let i = 0; i < pdfBuffers.length; i++) {
            const fileName = fileInfo[i]?.fileName || `Document ${i + 1}`;
            console.log(`\n  📄 Processing document ${i + 1}: ${fileName}`);
            
            const result = await this.processSinglePDF(pdfBuffers[i], i, fileName);
            processedDocuments.push(result);
        }
        
        // Merge all processed PDFs with enhanced error handling
        return await this.mergeProcessedPDFs(processedDocuments, fileInfo);
    }
    
    /**
     * Process a single PDF with multiple fallback strategies
     */
    async processSinglePDF(pdfBuffer, index, fileName) {
        // Check if PDF is encrypted
        const pdfText = pdfBuffer.toString('latin1').substring(0, 1024);
        const isEncrypted = pdfText.includes('/Encrypt');
        
        // If encrypted, prioritize tools that can decrypt
        const strategies = isEncrypted ? [
            { name: 'Print-to-PDF', fn: () => this.tryPrintToPDF(pdfBuffer, fileName) },
            { name: 'Ghostscript', fn: () => this.tryGhostscript(pdfBuffer, index) },
            { name: 'QPDF Clean', fn: () => this.tryQPDFClean(pdfBuffer, index) },
            { name: 'Direct Load', fn: () => this.tryDirectLoad(pdfBuffer) },
            { name: 'Ignore Encryption', fn: () => this.tryIgnoreEncryption(pdfBuffer) },
            { name: 'Repair Corrupt', fn: () => this.tryRepairCorrupt(pdfBuffer, index) },
            { name: 'Page-by-Page', fn: () => this.tryPageByPage(pdfBuffer) }
        ] : [
            { name: 'Direct Load', fn: () => this.tryDirectLoad(pdfBuffer) },
            { name: 'Ignore Encryption', fn: () => this.tryIgnoreEncryption(pdfBuffer) },
            { name: 'Repair Corrupt', fn: () => this.tryRepairCorrupt(pdfBuffer, index) },
            { name: 'Print-to-PDF', fn: () => this.tryPrintToPDF(pdfBuffer, fileName) },
            { name: 'QPDF Clean', fn: () => this.tryQPDFClean(pdfBuffer, index) },
            { name: 'Ghostscript', fn: () => this.tryGhostscript(pdfBuffer, index) },
            { name: 'Page-by-Page', fn: () => this.tryPageByPage(pdfBuffer) }
        ];
        
        for (const strategy of strategies) {
            console.log(`    Trying ${strategy.name}...`);
            try {
                const result = await strategy.fn();
                if (result && result.success) {
                    console.log(`    ✅ Success with ${strategy.name}: ${result.pageCount} pages`);
                    return {
                        success: true,
                        buffer: result.buffer,
                        pageCount: result.pageCount,
                        method: strategy.name,
                        fileName: fileName
                    };
                }
            } catch (error) {
                console.log(`    ❌ ${strategy.name} failed: ${error.message}`);
            }
        }
        
        // If all strategies fail, return original with warning
        console.log(`    ⚠️ All strategies failed, using original PDF`);
        return {
            success: false,
            buffer: pdfBuffer,
            pageCount: 0,
            method: 'Original (uncleaned)',
            fileName: fileName,
            error: 'Could not clean PDF - permissions may be preserved'
        };
    }
    
    /**
     * Strategy: Try direct load without special flags
     */
    async tryDirectLoad(pdfBuffer) {
        try {
            const pdf = await PDFDocument.load(pdfBuffer);
            const pageCount = pdf.getPageCount();
            
            if (pageCount > 0) {
                const cleanPdf = await PDFDocument.create();
                const pages = await cleanPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(page => cleanPdf.addPage(page));
                
                const cleanedBytes = await cleanPdf.save();
                return {
                    success: true,
                    buffer: Buffer.from(cleanedBytes),
                    pageCount: pageCount
                };
            }
        } catch (error) {
            // Expected to fail for protected PDFs
        }
        return null;
    }
    
    /**
     * Strategy: Load with ignoreEncryption and try page-by-page
     */
    async tryIgnoreEncryption(pdfBuffer) {
        try {
            const pdf = await PDFDocument.load(pdfBuffer, { 
                ignoreEncryption: true,
                updateMetadata: false,
                throwOnInvalidObject: false,
                capNumbers: false
            });
            
            const pageCount = pdf.getPageCount();
            const cleanPdf = await PDFDocument.create();
            
            let successfulPages = 0;
            let hasVisibleContent = false;
            
            for (let i = 0; i < pageCount; i++) {
                try {
                    const [page] = await cleanPdf.copyPages(pdf, [i]);
                    
                    // Check if page has actual content
                    const origPage = pdf.getPage(i);
                    const resources = origPage.node.Resources();
                    const hasFont = resources && resources.lookup('Font');
                    const hasXObject = resources && resources.lookup('XObject');
                    
                    if (hasFont || hasXObject) {
                        hasVisibleContent = true;
                    }
                    
                    cleanPdf.addPage(page);
                    successfulPages++;
                } catch (pageError) {
                    // Skip failed pages
                }
            }
            
            // Only return success if we have pages with actual content
            if (successfulPages > 0 && hasVisibleContent) {
                const cleanedBytes = await cleanPdf.save();
                return {
                    success: true,
                    buffer: Buffer.from(cleanedBytes),
                    pageCount: successfulPages
                };
            } else if (successfulPages > 0) {
                console.log(`      Warning: ${successfulPages} pages copied but no visible content detected`);
                // Return null to try other strategies
                return null;
            }
        } catch (error) {
            // Continue to next strategy
        }
        return null;
    }
    
    /**
     * Strategy: Repair corrupt PDFs with missing objects
     */
    async tryRepairCorrupt(pdfBuffer, index) {
        try {
            // First, detect how many pages the PDF should have
            const content = pdfBuffer.toString('latin1');
            const pageMarkers = content.match(/\/Type\s*\/Page(?![s])/g);
            const expectedPages = pageMarkers ? pageMarkers.length : 0;
            
            console.log(`      Detected ${expectedPages} page markers in corrupt PDF`);
            
            // Try to load with maximum tolerance
            const pdf = await PDFDocument.load(pdfBuffer, { 
                ignoreEncryption: true,
                updateMetadata: false,
                throwOnInvalidObject: false,
                capNumbers: false
            });
            
            const loadedPages = pdf.getPageCount();
            console.log(`      pdf-lib loaded ${loadedPages} pages`);
            
            // Create a new PDF with recovered content
            const repairedPdf = await PDFDocument.create();
            const helvetica = await repairedPdf.embedFont(StandardFonts.Helvetica);
            
            let recoveredPages = 0;
            
            // Try to copy accessible pages
            for (let i = 0; i < Math.max(loadedPages, expectedPages); i++) {
                let pageAdded = false;
                
                // Try to copy from original if within range
                if (i < loadedPages) {
                    try {
                        const [page] = await repairedPdf.copyPages(pdf, [i]);
                        repairedPdf.addPage(page);
                        recoveredPages++;
                        pageAdded = true;
                        console.log(`        Page ${i + 1}: Recovered original content`);
                    } catch (e) {
                        console.log(`        Page ${i + 1}: Copy failed - ${e.message.substring(0, 40)}`);
                    }
                }
                
                // If we couldn't copy but know the page should exist, add placeholder
                if (!pageAdded && i < expectedPages) {
                    const placeholderPage = repairedPdf.addPage([612, 792]);
                    
                    placeholderPage.drawText(`Page ${i + 1} of ${expectedPages}`, {
                        x: 50,
                        y: 750,
                        size: 12,
                        font: helvetica,
                        color: rgb(0.3, 0.3, 0.3)
                    });
                    
                    placeholderPage.drawText('Page data corrupted - Missing object references', {
                        x: 50,
                        y: 400,
                        size: 16,
                        font: helvetica,
                        color: rgb(0.7, 0, 0)
                    });
                    
                    placeholderPage.drawText('This page references objects that are missing from the PDF file.', {
                        x: 50,
                        y: 370,
                        size: 12,
                        font: helvetica,
                        color: rgb(0.5, 0.5, 0.5)
                    });
                    
                    placeholderPage.drawText(`Expected ${expectedPages} pages based on page markers.`, {
                        x: 50,
                        y: 340,
                        size: 12,
                        font: helvetica,
                        color: rgb(0.5, 0.5, 0.5)
                    });
                    
                    recoveredPages++;
                    console.log(`        Page ${i + 1}: Added placeholder for corrupt page`);
                }
            }
            
            if (recoveredPages > 0) {
                const repairedBytes = await repairedPdf.save();
                console.log(`      ✅ Repaired PDF: ${recoveredPages} pages (from ${expectedPages} expected)`);
                return {
                    success: true,
                    buffer: Buffer.from(repairedBytes),
                    pageCount: recoveredPages
                };
            }
            
        } catch (error) {
            console.log(`      Repair failed: ${error.message}`);
        }
        return null;
    }
    
    /**
     * Strategy: Print-to-PDF to bypass encryption
     */
    async tryPrintToPDF(pdfBuffer, fileName) {
        try {
            const result = await this.printProcessor.printPDF(pdfBuffer, fileName);
            if (result && result.success) {
                return result;
            }
        } catch (error) {
            console.log(`      Print-to-PDF error: ${error.message}`);
        }
        return null;
    }
    
    /**
     * Strategy: Try QPDF command line tool
     */
    async tryQPDFClean(pdfBuffer, index) {
        try {
            await execPromise('which qpdf');
            
            const inputPath = path.join(this.tempDir, `input_${index}_${Date.now()}.pdf`);
            const outputPath = path.join(this.tempDir, `output_${index}_${Date.now()}.pdf`);
            
            await fs.writeFile(inputPath, pdfBuffer);
            
            // Use qpdf to decrypt and clean the PDF
            // --decrypt removes encryption
            // --stream-data=uncompress decompresses streams for better processing
            // --object-streams=disable makes the PDF structure simpler
            const qpdfCommand = `qpdf --decrypt --stream-data=uncompress --object-streams=disable "${inputPath}" "${outputPath}" 2>&1 || true`;
            
            try {
                await execPromise(qpdfCommand);
                const cleanedBuffer = await fs.readFile(outputPath);
                
                // Clean up temp files
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});
                
                // Verify the decrypted PDF
                const pdf = await PDFDocument.load(cleanedBuffer);
                const pageCount = pdf.getPageCount();
                
                console.log(`      QPDF decrypted: ${pageCount} pages`);
                
                return {
                    success: true,
                    buffer: cleanedBuffer,
                    pageCount: pageCount
                };
            } catch (qpdfError) {
                console.log(`      QPDF command failed: ${qpdfError.message}`);
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});
            }
        } catch (error) {
            // qpdf not available or failed
        }
        return null;
    }
    
    /**
     * Strategy: Try Ghostscript
     */
    async tryGhostscript(pdfBuffer, index) {
        try {
            await execPromise('which gs');
            
            const inputPath = path.join(this.tempDir, `gs_input_${index}_${Date.now()}.pdf`);
            const outputPath = path.join(this.tempDir, `gs_output_${index}_${Date.now()}.pdf`);
            
            await fs.writeFile(inputPath, pdfBuffer);
            
            // First try to get info about the original PDF
            try {
                const originalPdf = await PDFDocument.load(pdfBuffer, { 
                    ignoreEncryption: true,
                    throwOnInvalidObject: false 
                });
                const originalPages = originalPdf.getPageCount();
                console.log(`      Original PDF has ${originalPages} pages before Ghostscript processing`);
            } catch (e) {
                console.log(`      Could not read original PDF page count`);
            }
            
            // Use Ghostscript with settings to handle corrupt and encrypted PDFs
            // -dPDFSTOPONERROR=false tells GS to continue even when encountering errors
            // -dPDFSETTINGS=/ebook preserves text while reprocessing
            // -dPrinted=false helps with some encrypted PDFs
            const gsCommand = `gs -q -dNOPAUSE -dBATCH -dPDFSTOPONERROR=false -dPDFSETTINGS=/ebook -dPrinted=false -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -sOutputFile="${outputPath}" -f "${inputPath}" 2>&1 || true`;
            
            try {
                const result = await execPromise(gsCommand);
                console.log(`      Ghostscript completed${result.stderr ? ' with warnings' : ' successfully'}`);
            } catch (gsError) {
                // Try with even more aggressive error recovery
                console.log(`      Ghostscript first attempt failed, trying recovery mode...`);
                
                // This command attempts to extract individual pages even if some fail
                const recoveryCommand = `gs -q -dNOPAUSE -dBATCH -dPDFSTOPONERROR=false -dPDFSETTINGS=/default -sDEVICE=pdfwrite -dFirstPage=1 -dLastPage=100 -sOutputFile="${outputPath}" -f "${inputPath}" 2>&1 || true`;
                await execPromise(recoveryCommand);
            }
            
            const cleanedBuffer = await fs.readFile(outputPath);
            
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            
            const pdf = await PDFDocument.load(cleanedBuffer);
            const pageCount = pdf.getPageCount();
            
            console.log(`      Ghostscript processed: ${pageCount} pages extracted`);
            
            return {
                success: true,
                buffer: cleanedBuffer,
                pageCount: pageCount
            };
        } catch (error) {
            console.log(`      Ghostscript error: ${error.message}`);
        }
        return null;
    }
    
    /**
     * Strategy: Try page-by-page extraction
     */
    async tryPageByPage(pdfBuffer) {
        try {
            const pdf = await PDFDocument.load(pdfBuffer, { 
                ignoreEncryption: true,
                updateMetadata: false,
                throwOnInvalidObject: false
            });
            
            const pageCount = pdf.getPageCount();
            console.log(`      Attempting to extract ${pageCount} pages individually...`);
            
            const cleanPdf = await PDFDocument.create();
            
            let extractedPages = 0;
            let placeholderPages = 0;
            
            for (let i = 0; i < pageCount; i++) {
                let pageExtracted = false;
                
                // Try direct copy first
                if (!pageExtracted) {
                    try {
                        const [page] = await cleanPdf.copyPages(pdf, [i]);
                        cleanPdf.addPage(page);
                        pageExtracted = true;
                        extractedPages++;
                    } catch (e) {
                        console.log(`        Page ${i + 1}: Copy failed - ${e.message.substring(0, 50)}`);
                    }
                }
                
                // Add placeholder if copy failed
                if (!pageExtracted) {
                    try {
                        const sourcePage = pdf.getPage(i);
                        const { width, height } = sourcePage.getSize();
                        const newPage = cleanPdf.addPage([width, height]);
                        
                        const helvetica = await cleanPdf.embedFont(StandardFonts.Helvetica);
                        
                        newPage.drawText(`Page ${i + 1}`, {
                            x: 50,
                            y: height - 50,
                            size: 12,
                            font: helvetica,
                            color: rgb(0.3, 0.3, 0.3)
                        });
                        
                        newPage.drawText('(Content protected - manual review required)', {
                            x: 50,
                            y: height / 2,
                            size: 14,
                            font: helvetica,
                            color: rgb(0.5, 0.5, 0.5)
                        });
                        
                        placeholderPages++;
                        extractedPages++;
                    } catch (e) {
                        console.log(`        Page ${i + 1}: Placeholder failed - skipping`);
                    }
                }
            }
            
            console.log(`      Extracted: ${extractedPages - placeholderPages} pages, ${placeholderPages} placeholders`);
            
            if (extractedPages > 0) {
                const cleanedBytes = await cleanPdf.save();
                return {
                    success: true,
                    buffer: Buffer.from(cleanedBytes),
                    pageCount: extractedPages
                };
            }
        } catch (error) {
            console.log(`      Page-by-page failed: ${error.message}`);
        }
        return null;
    }

    /**
     * Merge processed PDFs with proper error handling
     */
    async mergeProcessedPDFs(processedDocuments, fileInfo) {
        console.log(`\n📑 Merging ${processedDocuments.length} processed documents`);
        
        const mergedPdf = await PDFDocument.create();
        const helveticaBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await mergedPdf.embedFont(StandardFonts.Helvetica);
        
        let totalPages = 0;
        let currentPageNum = 0;
        
        for (let i = 0; i < processedDocuments.length; i++) {
            const doc = processedDocuments[i];
            const fileName = fileInfo[i]?.fileName || doc.fileName || `Document ${i + 1}`;
            
            console.log(`  Adding ${fileName} (${doc.method})`);
            
            // Add separator page (except before first document)
            if (i > 0) {
                const separatorPage = mergedPdf.addPage([612, 792]);
                const { width, height } = separatorPage.getSize();
                currentPageNum++;
                
                // Draw separator content
                separatorPage.drawText(`DOCUMENT ${i + 1}`, {
                    x: width / 2 - 100,
                    y: height / 2 + 50,
                    size: 30,
                    font: helveticaBold,
                    color: rgb(0, 0, 0)
                });
                
                separatorPage.drawText(fileName, {
                    x: 50,
                    y: height / 2,
                    size: 14,
                    font: helvetica,
                    color: rgb(0.3, 0.3, 0.3)
                });
                
                separatorPage.drawText(`Processing method: ${doc.method}`, {
                    x: 50,
                    y: height / 2 - 20,
                    size: 10,
                    font: helvetica,
                    color: rgb(0.5, 0.5, 0.5)
                });
                
                if (!doc.success) {
                    separatorPage.drawText('⚠️ This document had processing issues', {
                        x: 50,
                        y: height / 2 - 50,
                        size: 12,
                        font: helvetica,
                        color: rgb(0.7, 0, 0)
                    });
                    
                    if (doc.error) {
                        separatorPage.drawText(doc.error, {
                            x: 50,
                            y: height / 2 - 70,
                            size: 10,
                            font: helvetica,
                            color: rgb(0.5, 0.5, 0.5)
                        });
                    }
                }
                
                separatorPage.drawText(`Page ${currentPageNum}`, {
                    x: width / 2 - 30,
                    y: 30,
                    size: 10,
                    font: helvetica,
                    color: rgb(0.5, 0.5, 0.5)
                });
            }
            
            // Add document pages
            try {
                const pdf = await PDFDocument.load(doc.buffer, {
                    ignoreEncryption: true,
                    updateMetadata: false,
                    throwOnInvalidObject: false
                });
                
                const pageCount = pdf.getPageCount();
                console.log(`    Adding ${pageCount} pages from ${fileName}`);
                
                // Try to copy all pages at once first
                try {
                    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    pages.forEach((page, idx) => {
                        mergedPdf.addPage(page);
                        currentPageNum++;
                        totalPages++;
                    });
                } catch (bulkError) {
                    // Fall back to page-by-page
                    console.log(`    Bulk copy failed, trying page-by-page`);
                    
                    for (let j = 0; j < pageCount; j++) {
                        try {
                            const [page] = await mergedPdf.copyPages(pdf, [j]);
                            mergedPdf.addPage(page);
                            currentPageNum++;
                            totalPages++;
                        } catch (pageError) {
                            // Add error page for this specific page
                            const errorPage = mergedPdf.addPage([612, 792]);
                            currentPageNum++;
                            totalPages++;
                            
                            errorPage.drawText(`${fileName} - Page ${j + 1}`, {
                                x: 50,
                                y: 750,
                                size: 12,
                                font: helvetica,
                                color: rgb(0.3, 0.3, 0.3)
                            });
                            
                            errorPage.drawText('This page could not be processed', {
                                x: 50,
                                y: 400,
                                size: 14,
                                font: helvetica,
                                color: rgb(0.7, 0, 0)
                            });
                            
                            errorPage.drawText('The document may have security restrictions.', {
                                x: 50,
                                y: 370,
                                size: 12,
                                font: helvetica,
                                color: rgb(0.5, 0.5, 0.5)
                            });
                        }
                    }
                }
                
            } catch (error) {
                console.error(`    ✗ Failed to add document ${i + 1}:`, error.message);
                
                // Add error page for entire document
                const errorPage = mergedPdf.addPage([612, 792]);
                currentPageNum++;
                
                errorPage.drawText(`DOCUMENT ${i + 1}: ${fileName}`, {
                    x: 50,
                    y: 700,
                    size: 16,
                    font: helveticaBold,
                    color: rgb(0, 0, 0)
                });
                
                errorPage.drawText('Document could not be processed', {
                    x: 50,
                    y: 400,
                    size: 20,
                    font: helveticaBold,
                    color: rgb(0.7, 0, 0)
                });
                
                errorPage.drawText(error.message, {
                    x: 50,
                    y: 350,
                    size: 12,
                    font: helvetica,
                    color: rgb(0.5, 0.5, 0.5)
                });
                
                errorPage.drawText('Please provide a PDF without security restrictions.', {
                    x: 50,
                    y: 320,
                    size: 12,
                    font: helvetica,
                    color: rgb(0.5, 0.5, 0.5)
                });
            }
        }
        
        // Save the merged PDF
        const mergedBytes = await mergedPdf.save({
            useObjectStreams: false,
            addDefaultPage: false,
            objectsPerTick: 50
        });
        
        console.log(`✅ Successfully merged ${totalPages} pages into consolidated PDF`);
        return Buffer.from(mergedBytes);
    }
    
    // Compatibility method - keep the old name but use new implementation
    async mergePDFs(pdfBuffers, fileInfo = []) {
        // This now just calls the new merge method after processing
        const processedDocs = [];
        for (let i = 0; i < pdfBuffers.length; i++) {
            processedDocs.push({
                success: true,
                buffer: pdfBuffers[i],
                pageCount: 0,
                method: 'Direct',
                fileName: fileInfo[i]?.fileName || `Document ${i + 1}`
            });
        }
        return await this.mergeProcessedPDFs(processedDocs, fileInfo);
    }
    
    // Clean up resources
    async cleanup() {
        if (this.printProcessor) {
            await this.printProcessor.cleanup();
        }
    }
}

module.exports = PDFCleaner;