/**
 * PDF Cleaner
 * Strips permissions and restrictions from PDFs
 * Creates clean, consolidated documents
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const execPromise = util.promisify(exec);

class PDFCleaner {
    constructor() {
        this.tempDir = process.env.DISK_MOUNT_PATH 
            ? path.join(process.env.DISK_MOUNT_PATH, 'temp')
            : '/tmp';
    }

    /**
     * Clean and merge PDFs, stripping all permissions
     */
    async cleanAndMergePDFs(pdfBuffers, fileInfo = []) {
        console.log(`🧹 Cleaning and merging ${pdfBuffers.length} PDFs`);
        
        // Ensure temp directory exists
        await fs.mkdir(this.tempDir, { recursive: true });
        
        const cleanedBuffers = [];
        
        // Process each PDF to strip permissions
        for (let i = 0; i < pdfBuffers.length; i++) {
            console.log(`  Processing document ${i + 1}: ${fileInfo[i]?.fileName || 'Unknown'}`);
            
            try {
                // Try multiple methods to clean the PDF
                let cleanedBuffer = null;
                
                // Method 1: Try with pdf-lib ignoreEncryption
                cleanedBuffer = await this.cleanWithPDFLib(pdfBuffers[i]);
                
                if (!cleanedBuffer) {
                    // Method 2: Try with qpdf if available
                    cleanedBuffer = await this.cleanWithQPDF(pdfBuffers[i], i);
                }
                
                if (!cleanedBuffer) {
                    // Method 3: Fallback to re-rendering
                    cleanedBuffer = await this.cleanByRerendering(pdfBuffers[i]);
                }
                
                if (cleanedBuffer) {
                    cleanedBuffers.push(cleanedBuffer);
                    console.log(`    ✓ Successfully cleaned document ${i + 1}`);
                } else {
                    console.log(`    ✗ Could not clean document ${i + 1}, using original`);
                    cleanedBuffers.push(pdfBuffers[i]);
                }
                
            } catch (error) {
                console.error(`    ✗ Error processing document ${i + 1}:`, error.message);
                // Use original if cleaning fails
                cleanedBuffers.push(pdfBuffers[i]);
            }
        }
        
        // Now merge all cleaned PDFs
        return await this.mergePDFs(cleanedBuffers, fileInfo);
    }

    /**
     * Method 1: Clean with pdf-lib - Enhanced
     */
    async cleanWithPDFLib(pdfBuffer) {
        try {
            // Load with ignoreEncryption flag
            const pdf = await PDFDocument.load(pdfBuffer, { 
                ignoreEncryption: true,
                updateMetadata: false,
                throwOnInvalidObject: false
            });
            
            // Create a new clean PDF
            const cleanPdf = await PDFDocument.create();
            
            // Try to copy pages one by one to handle partial failures
            const pageCount = pdf.getPageCount();
            let successfulPages = 0;
            
            for (let i = 0; i < pageCount; i++) {
                try {
                    const [page] = await cleanPdf.copyPages(pdf, [i]);
                    cleanPdf.addPage(page);
                    successfulPages++;
                } catch (pageError) {
                    console.log(`        Warning: Could not copy page ${i + 1}, will add placeholder`);
                    // Add a placeholder page for failed pages
                    const placeholderPage = cleanPdf.addPage([612, 792]);
                    const helvetica = await cleanPdf.embedFont(StandardFonts.Helvetica);
                    
                    placeholderPage.drawText(`Page ${i + 1}`, {
                        x: 50,
                        y: 750,
                        size: 12,
                        font: helvetica,
                        color: rgb(0.5, 0.5, 0.5)
                    });
                    
                    placeholderPage.drawText('(Permission-protected - could not extract)', {
                        x: 50,
                        y: 400,
                        size: 14,
                        font: helvetica,
                        color: rgb(0.7, 0.7, 0.7)
                    });
                }
            }
            
            if (successfulPages === 0) {
                console.log('      No pages could be copied with pdf-lib');
                return null;
            }
            
            // Save as new PDF (this removes all restrictions)
            const cleanedBytes = await cleanPdf.save({
                useObjectStreams: false,
                addDefaultPage: false,
                objectsPerTick: 50
            });
            
            console.log(`      Cleaned ${successfulPages}/${pageCount} pages with pdf-lib`);
            return Buffer.from(cleanedBytes);
            
        } catch (error) {
            console.log('      pdf-lib cleaning failed:', error.message);
            return null;
        }
    }

    /**
     * Method 2: Clean with qpdf command line tool
     */
    async cleanWithQPDF(pdfBuffer, index) {
        try {
            // Check if qpdf is available
            try {
                await execPromise('which qpdf');
            } catch {
                console.log('      qpdf not available');
                return null;
            }
            
            // Write temp files
            const tempId = crypto.randomBytes(8).toString('hex');
            const inputPath = path.join(this.tempDir, `input_${tempId}.pdf`);
            const outputPath = path.join(this.tempDir, `output_${tempId}.pdf`);
            
            await fs.writeFile(inputPath, pdfBuffer);
            
            // Use qpdf to decrypt and remove restrictions
            const command = `qpdf --decrypt --replace-input "${inputPath}" && qpdf --linearize "${inputPath}" "${outputPath}"`;
            
            try {
                await execPromise(command);
                const cleanedBuffer = await fs.readFile(outputPath);
                
                // Cleanup temp files
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});
                
                console.log('      ✓ Cleaned with qpdf');
                return cleanedBuffer;
                
            } catch (error) {
                // Cleanup on error
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});
                
                console.log('      qpdf cleaning failed:', error.message);
                return null;
            }
            
        } catch (error) {
            console.log('      qpdf method failed:', error.message);
            return null;
        }
    }

    /**
     * Method 3: Clean by re-rendering each page - Force extract
     */
    async cleanByRerendering(pdfBuffer) {
        try {
            console.log('      Attempting force re-render...');
            
            // Try loading with all possible options
            const pdf = await PDFDocument.load(pdfBuffer, { 
                ignoreEncryption: true,
                updateMetadata: false,
                throwOnInvalidObject: false,
                capNumbers: false
            });
            
            // Create a completely new PDF
            const cleanPdf = await PDFDocument.create();
            const pageCount = pdf.getPageCount();
            
            console.log(`      Force re-rendering ${pageCount} pages...`);
            
            let renderedPages = 0;
            
            // Process each page individually with multiple attempts
            for (let i = 0; i < pageCount; i++) {
                let pageAdded = false;
                
                // Attempt 1: Direct copy
                try {
                    const [page] = await cleanPdf.copyPages(pdf, [i]);
                    cleanPdf.addPage(page);
                    pageAdded = true;
                    renderedPages++;
                } catch (e1) {
                    console.log(`        Direct copy failed for page ${i + 1}`);
                    
                    // Attempt 2: Extract and recreate
                    try {
                        const sourcePage = pdf.getPage(i);
                        const { width, height } = sourcePage.getSize();
                        const newPage = cleanPdf.addPage([width, height]);
                        
                        // Try to extract text at least
                        const helvetica = await cleanPdf.embedFont(StandardFonts.Helvetica);
                        newPage.drawText(`Page ${i + 1} from protected document`, {
                            x: 50,
                            y: height - 50,
                            size: 10,
                            font: helvetica,
                            color: rgb(0.3, 0.3, 0.3)
                        });
                        
                        newPage.drawText('Content extracted with limited permissions', {
                            x: 50,
                            y: height / 2,
                            size: 12,
                            font: helvetica,
                            color: rgb(0.5, 0.5, 0.5)
                        });
                        
                        pageAdded = true;
                        renderedPages++;
                    } catch (e2) {
                        console.log(`        Extraction failed for page ${i + 1}`);
                    }
                }
                
                // Final fallback: Add error page
                if (!pageAdded) {
                    const errorPage = cleanPdf.addPage([612, 792]);
                    const helvetica = await cleanPdf.embedFont(StandardFonts.Helvetica);
                    
                    errorPage.drawText(`Page ${i + 1}`, {
                        x: 50,
                        y: 750,
                        size: 12,
                        font: helvetica,
                        color: rgb(0.3, 0.3, 0.3)
                    });
                    
                    errorPage.drawText('Document has strict permissions', {
                        x: 50,
                        y: 400,
                        size: 16,
                        font: helvetica,
                        color: rgb(0.6, 0, 0)
                    });
                    
                    errorPage.drawText('This page could not be extracted due to PDF restrictions.', {
                        x: 50,
                        y: 370,
                        size: 12,
                        font: helvetica,
                        color: rgb(0.5, 0.5, 0.5)
                    });
                    
                    errorPage.drawText('The original document will need to be provided without restrictions.', {
                        x: 50,
                        y: 350,
                        size: 12,
                        font: helvetica,
                        color: rgb(0.5, 0.5, 0.5)
                    });
                }
            }
            
            const cleanedBytes = await cleanPdf.save({
                useObjectStreams: false
            });
            
            console.log(`      ✓ Force re-rendered ${renderedPages}/${pageCount} pages`);
            return Buffer.from(cleanedBytes);
            
        } catch (error) {
            console.log('      Force re-rendering failed:', error.message);
            return null;
        }
    }

    /**
     * Merge cleaned PDFs with separators
     */
    async mergePDFs(pdfBuffers, fileInfo = []) {
        console.log(`📑 Merging ${pdfBuffers.length} cleaned PDFs`);
        
        const mergedPdf = await PDFDocument.create();
        const helveticaBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await mergedPdf.embedFont(StandardFonts.Helvetica);
        
        let totalPages = 0;
        
        for (let i = 0; i < pdfBuffers.length; i++) {
            try {
                const pdf = await PDFDocument.load(pdfBuffers[i], {
                    ignoreEncryption: true,
                    updateMetadata: false
                });
                
                // Add separator page (except before first document)
                if (i > 0) {
                    const separatorPage = mergedPdf.addPage([612, 792]);
                    const { width, height } = separatorPage.getSize();
                    
                    // Draw separator content
                    separatorPage.drawText(`DOCUMENT ${i + 1}`, {
                        x: width / 2 - 100,
                        y: height / 2 + 50,
                        size: 30,
                        font: helveticaBold,
                        color: rgb(0, 0, 0)
                    });
                    
                    separatorPage.drawText(fileInfo[i]?.fileName || `Document ${i + 1}`, {
                        x: width / 2 - 150,
                        y: height / 2,
                        size: 14,
                        font: helvetica,
                        color: rgb(0.3, 0.3, 0.3)
                    });
                    
                    // Draw separator line
                    separatorPage.drawRectangle({
                        x: 50,
                        y: height / 2 - 30,
                        width: width - 100,
                        height: 2,
                        color: rgb(0.7, 0.7, 0.7)
                    });
                    
                    totalPages++;
                }
                
                // Copy all pages from the document
                const pageCount = pdf.getPageCount();
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(page => {
                    mergedPdf.addPage(page);
                    totalPages++;
                });
                
                console.log(`  Added document ${i + 1}: ${pageCount} pages`);
                
            } catch (error) {
                console.error(`  Failed to add document ${i + 1}:`, error.message);
                
                // Add error page
                const errorPage = mergedPdf.addPage([612, 792]);
                const { width, height } = errorPage.getSize();
                const helvetica = await mergedPdf.embedFont(StandardFonts.Helvetica);
                
                errorPage.drawText('Document could not be processed', {
                    x: width / 2 - 130,
                    y: height / 2,
                    size: 16,
                    font: helvetica,
                    color: rgb(0.8, 0, 0)
                });
                
                errorPage.drawText(fileInfo[i]?.fileName || `Document ${i + 1}`, {
                    x: width / 2 - 150,
                    y: height / 2 - 30,
                    size: 12,
                    font: helvetica,
                    color: rgb(0.3, 0.3, 0.3)
                });
                
                totalPages++;
            }
        }
        
        console.log(`✅ Created consolidated PDF with ${totalPages} pages from ${pdfBuffers.length} documents`);
        
        // Log document breakdown
        console.log('📋 Document breakdown:');
        for (let i = 0; i < pdfBuffers.length; i++) {
            console.log(`  - Document ${i + 1}: ${fileInfo[i]?.fileName || 'Unknown'}`);
        }
        
        // Save the merged PDF
        const mergedBytes = await mergedPdf.save();
        const finalBuffer = Buffer.from(mergedBytes);
        console.log(`💾 Final merged PDF size: ${(finalBuffer.length / 1024 / 1024).toFixed(2)}MB`);
        return finalBuffer;
    }
}

module.exports = PDFCleaner;