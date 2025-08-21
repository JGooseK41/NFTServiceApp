/**
 * PDF Processor
 * Handles PDF merging, preview generation, and alert overlay creation
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');
const pdf2pic = require('pdf2pic');
const PDFCleaner = require('./pdf-cleaner');

class PDFProcessor {
    constructor() {
        this.options = {
            density: 150,           // DPI for image conversion
            savename: 'preview',    
            savedir: './temp',
            format: 'png',
            width: 800,
            height: 1200
        };
        this.pdfCleaner = new PDFCleaner();
    }

    /**
     * Merge multiple PDFs into one document with separators and page numbers
     */
    async mergePDFs(pdfBuffers, fileInfo = []) {
        console.log(`📑 Processing ${pdfBuffers.length} PDFs for merging`);
        
        // Use PDFCleaner to strip permissions and merge
        try {
            const cleanedAndMerged = await this.pdfCleaner.cleanAndMergePDFs(pdfBuffers, fileInfo);
            
            // Check if any PDFs require manual conversion
            if (cleanedAndMerged.requiresManualConversion) {
                // Return error with instructions
                throw new Error(cleanedAndMerged.error);
            }
            
            console.log('✅ Successfully cleaned and merged PDFs');
            return cleanedAndMerged;
        } catch (cleanError) {
            console.error('⚠️ PDF processing issue:', cleanError.message);
            
            // If it's a manual conversion error, throw it up to the caller
            if (cleanError.message.includes('Print-to-PDF')) {
                throw cleanError;
            }
            
            // Otherwise fall back to original merge logic
            console.log('Falling back to standard merge...');
        }
        
        const mergedPdf = await PDFDocument.create();
        const helveticaBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await mergedPdf.embedFont(StandardFonts.Helvetica);
        
        let totalPageCount = 0;
        const documentSections = [];
        
        // First pass: calculate total pages and prepare sections
        console.log(`\n📄 Processing ${pdfBuffers.length} PDF documents for merging...`);
        for (let i = 0; i < pdfBuffers.length; i++) {
            try {
                const pdf = await PDFDocument.load(pdfBuffers[i]);
                const pageCount = pdf.getPageCount();
                console.log(`  Document ${i + 1}: ${fileInfo[i]?.fileName || 'Unknown'} - ${pageCount} pages`);
                
                documentSections.push({
                    pdf,
                    fileName: fileInfo[i]?.fileName || `Document ${i + 1}`,
                    startPage: totalPageCount + i, // Account for separator pages (none before first doc)
                    pageCount: pageCount
                });
                
                // Add page count + 1 for separator, except for first document
                totalPageCount += pageCount + (i > 0 ? 1 : 0);
            } catch (error) {
                console.error(`  ✗ Failed to load PDF ${i + 1}:`, error.message);
            }
        }
        console.log(`📊 Total pages to merge: ${totalPageCount} (including ${pdfBuffers.length - 1} separator pages)`)
        
        let currentPageNum = 0;
        
        // Second pass: add documents with separators and page numbers
        for (let i = 0; i < documentSections.length; i++) {
            const section = documentSections[i];
            
            // Add separator page before each document EXCEPT the first one
            if (i > 0) {
                const separatorPage = mergedPdf.addPage([612, 792]); // Letter size
                currentPageNum++;
                
                // Draw separator page content
                this.drawSeparatorPage(
                    separatorPage, 
                    helveticaBold, 
                    helvetica,
                    section.fileName,
                    i + 1,
                    documentSections.length,
                    section.pageCount,
                    currentPageNum,
                    totalPageCount
                );
            }
            
            // Copy and add all pages from this PDF
            const pages = await mergedPdf.copyPages(section.pdf, section.pdf.getPageIndices());
            
            for (let j = 0; j < pages.length; j++) {
                const page = pages[j];
                mergedPdf.addPage(page);
                currentPageNum++;
                
                // Add page number to each page
                this.addPageNumber(
                    page,
                    helvetica,
                    currentPageNum,
                    totalPageCount,
                    `${section.fileName} - Page ${j + 1} of ${section.pageCount}`
                );
            }
            
            console.log(`  ✓ Added ${section.fileName}: ${section.pageCount} pages`);
        }
        
        // Add metadata
        mergedPdf.setTitle('Legal Service Document - Combined');
        mergedPdf.setCreator('LegalNotice NFT Service');
        mergedPdf.setSubject(`Combined ${documentSections.length} documents`);
        mergedPdf.setCreationDate(new Date());
        mergedPdf.setModificationDate(new Date());
        
        const mergedBytes = await mergedPdf.save();
        console.log(`✅ Merged PDF created: ${totalPageCount} total pages (${documentSections.length} documents), ${(mergedBytes.length / 1024 / 1024).toFixed(2)}MB`);
        
        return Buffer.from(mergedBytes);
    }
    
    /**
     * Draw separator page between documents
     */
    drawSeparatorPage(page, boldFont, regularFont, fileName, docNum, totalDocs, pageCount, currentPage, totalPages) {
        const { width, height } = page.getSize();
        
        // Background color (light gray)
        page.drawRectangle({
            x: 0,
            y: 0,
            width: width,
            height: height,
            color: rgb(0.95, 0.95, 0.95)
        });
        
        // White content box
        page.drawRectangle({
            x: 50,
            y: height - 450,
            width: width - 100,
            height: 350,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.2, 0.2, 0.2),
            borderWidth: 1
        });
        
        // Header
        page.drawText('DOCUMENT SEPARATOR', {
            x: width / 2 - 100,
            y: height - 150,
            size: 20,
            font: boldFont,
            color: rgb(0.91, 0.298, 0.235) // Red
        });
        
        // Document info
        page.drawText(`Document ${docNum} of ${totalDocs}`, {
            x: 80,
            y: height - 220,
            size: 14,
            font: regularFont,
            color: rgb(0.2, 0.2, 0.2)
        });
        
        // File name
        page.drawText('File Name:', {
            x: 80,
            y: height - 260,
            size: 12,
            font: boldFont,
            color: rgb(0.2, 0.2, 0.2)
        });
        
        // Truncate filename if too long
        const maxFileNameLength = 50;
        const displayFileName = fileName.length > maxFileNameLength ? 
            fileName.substring(0, maxFileNameLength - 3) + '...' : fileName;
        
        page.drawText(displayFileName, {
            x: 80,
            y: height - 280,
            size: 12,
            font: regularFont,
            color: rgb(0.3, 0.3, 0.3)
        });
        
        // Page count info
        page.drawText('Document Pages:', {
            x: 80,
            y: height - 320,
            size: 12,
            font: boldFont,
            color: rgb(0.2, 0.2, 0.2)
        });
        
        page.drawText(`${pageCount} pages`, {
            x: 80,
            y: height - 340,
            size: 12,
            font: regularFont,
            color: rgb(0.3, 0.3, 0.3)
        });
        
        // Location in combined document
        page.drawText('Location in Combined Document:', {
            x: 80,
            y: height - 380,
            size: 12,
            font: boldFont,
            color: rgb(0.2, 0.2, 0.2)
        });
        
        page.drawText(`Pages ${currentPage + 1} through ${currentPage + pageCount} of ${totalPages}`, {
            x: 80,
            y: height - 400,
            size: 12,
            font: regularFont,
            color: rgb(0.3, 0.3, 0.3)
        });
        
        // Footer with page number
        page.drawText(`Page ${currentPage} of ${totalPages}`, {
            x: width / 2 - 40,
            y: 30,
            size: 10,
            font: regularFont,
            color: rgb(0.5, 0.5, 0.5)
        });
        
        // Timestamp
        page.drawText(`Combined: ${new Date().toLocaleString()}`, {
            x: 50,
            y: 30,
            size: 8,
            font: regularFont,
            color: rgb(0.6, 0.6, 0.6)
        });
    }
    
    /**
     * Add page number footer to a page
     */
    addPageNumber(page, font, currentPage, totalPages, documentInfo) {
        const { width, height } = page.getSize();
        
        // White background for footer
        page.drawRectangle({
            x: 0,
            y: 0,
            width: width,
            height: 25,
            color: rgb(1, 1, 1),
            opacity: 0.9
        });
        
        // Page number (center)
        page.drawText(`Page ${currentPage} of ${totalPages}`, {
            x: width / 2 - 40,
            y: 8,
            size: 10,
            font: font,
            color: rgb(0.3, 0.3, 0.3)
        });
        
        // Document info (left)
        const maxInfoLength = 40;
        const displayInfo = documentInfo.length > maxInfoLength ? 
            documentInfo.substring(0, maxInfoLength - 3) + '...' : documentInfo;
        
        page.drawText(displayInfo, {
            x: 10,
            y: 8,
            size: 8,
            font: font,
            color: rgb(0.5, 0.5, 0.5)
        });
    }

    /**
     * Generate alert preview with overlay from first page
     */
    async generateAlertPreview(pdfBuffer) {
        console.log('🎨 Generating alert preview with overlay');
        
        try {
            // Try to extract and convert first page
            const firstPageBuffer = await this.extractFirstPage(pdfBuffer);
            
            // Convert to base64 for preview
            const base64Pdf = firstPageBuffer.toString('base64');
            const pdfDataUri = `data:application/pdf;base64,${base64Pdf}`;
            
            // Since we can't easily render PDF to image on server without dependencies,
            // we'll create a preview that indicates it's a PDF with overlay styling
            return await this.createStyledPdfPreview(pdfBuffer);
            
        } catch (error) {
            console.error('Alert preview generation failed:', error);
            // Fallback to simple preview
            return this.createSimplePreview('Legal Document');
        }
    }

    /**
     * Generate preview using pdf2pic (requires poppler)
     */
    async generateWithPdf2Pic(pdfBuffer) {
        const pdf2picConverter = new pdf2pic.fromBuffer(pdfBuffer, this.options);
        
        // Convert first page to image
        const result = await pdf2picConverter(1); // Page 1
        
        if (!result || !result.buffer) {
            throw new Error('pdf2pic conversion failed');
        }
        
        // Add overlay using sharp
        const overlayBuffer = await this.createAlertOverlay();
        
        const finalImage = await sharp(result.buffer)
            .resize(800, 1200, { fit: 'contain', background: 'white' })
            .composite([{
                input: overlayBuffer,
                blend: 'over'
            }])
            .jpeg({ quality: 85 })
            .toBuffer();
        
        return `data:image/jpeg;base64,${finalImage.toString('base64')}`;
    }

    /**
     * Generate preview using pdf-lib (fallback)
     */
    async generateWithPdfLib(pdfBuffer) {
        console.log('Using pdf-lib fallback for preview generation');
        
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const firstPage = pdfDoc.getPage(0);
        const { width, height } = firstPage.getSize();
        
        // Create new document with just first page
        const previewDoc = await PDFDocument.create();
        const [copiedPage] = await previewDoc.copyPages(pdfDoc, [0]);
        previewDoc.addPage(copiedPage);
        
        // Add overlay elements
        const page = previewDoc.getPage(0);
        const helveticaBold = await previewDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await previewDoc.embedFont(StandardFonts.Helvetica);
        
        // Red header bar
        page.drawRectangle({
            x: 0,
            y: height - 60,
            width: width,
            height: 60,
            color: rgb(0.91, 0.298, 0.235), // #e74c3c
        });
        
        // Header text
        page.drawText('LEGAL SERVICE DOCUMENT', {
            x: width / 2 - 120,
            y: height - 40,
            size: 20,
            font: helveticaBold,
            color: rgb(1, 1, 1),
        });
        
        // Red border
        page.drawRectangle({
            x: 2,
            y: 2,
            width: width - 4,
            height: height - 4,
            borderColor: rgb(0.91, 0.298, 0.235),
            borderWidth: 4,
        });
        
        // Footer with timestamp
        const timestamp = new Date().toLocaleString();
        page.drawText(`Alert Preview Generated: ${timestamp}`, {
            x: 10,
            y: 10,
            size: 10,
            font: helvetica,
            color: rgb(0.4, 0.4, 0.4),
        });
        
        // Convert to buffer
        const previewBytes = await previewDoc.save();
        
        // Since we can't easily convert PDF to image with just pdf-lib,
        // we'll create a simple canvas-based preview
        return this.createSimplePreview(pdfDoc.getTitle() || 'Legal Document');
    }

    /**
     * Create alert overlay as buffer (for compositing)
     */
    async createAlertOverlay() {
        const width = 800;
        const height = 1200;
        
        // Create SVG overlay
        const svg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <!-- Red header bar -->
                <rect x="0" y="0" width="${width}" height="60" fill="#e74c3c"/>
                
                <!-- Header text -->
                <text x="${width/2}" y="40" font-family="Arial, sans-serif" font-size="24" 
                      font-weight="bold" fill="white" text-anchor="middle">
                    LEGAL SERVICE DOCUMENT
                </text>
                
                <!-- Red border -->
                <rect x="2" y="2" width="${width-4}" height="${height-4}" 
                      fill="none" stroke="#e74c3c" stroke-width="4"/>
                
                <!-- Footer text -->
                <text x="10" y="${height-10}" font-family="Arial, sans-serif" 
                      font-size="12" fill="#666">
                    Alert Preview - ${new Date().toLocaleString()}
                </text>
                
                <!-- Watermark -->
                <text x="${width/2}" y="${height/2}" font-family="Arial, sans-serif" 
                      font-size="48" fill="#e74c3c" fill-opacity="0.1" 
                      text-anchor="middle" transform="rotate(-45 ${width/2} ${height/2})">
                    LEGAL NOTICE
                </text>
            </svg>
        `;
        
        return Buffer.from(svg);
    }

    /**
     * Create simple preview when PDF rendering fails
     */
    createSimplePreview(fileName) {
        // Canvas-based fallback (similar to frontend)
        const canvas = {
            width: 800,
            height: 1200
        };
        
        // Create base64 preview image
        const svg = `
            <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
                <!-- White background -->
                <rect width="${canvas.width}" height="${canvas.height}" fill="white"/>
                
                <!-- Red header -->
                <rect x="0" y="0" width="${canvas.width}" height="80" fill="#e74c3c"/>
                <text x="${canvas.width/2}" y="50" font-family="Arial" font-size="28" 
                      font-weight="bold" fill="white" text-anchor="middle">
                    LEGAL SERVICE DOCUMENT
                </text>
                
                <!-- Document icon -->
                <text x="${canvas.width/2}" y="400" font-size="120" text-anchor="middle">📄</text>
                
                <!-- File name -->
                <text x="${canvas.width/2}" y="500" font-family="Arial" font-size="24" 
                      fill="#333" text-anchor="middle">
                    ${fileName.substring(0, 30)}${fileName.length > 30 ? '...' : ''}
                </text>
                
                <!-- Status -->
                <text x="${canvas.width/2}" y="550" font-family="Arial" font-size="18" 
                      fill="#059669" text-anchor="middle">
                    ✓ Document Ready for Service
                </text>
                
                <!-- Border -->
                <rect x="2" y="2" width="${canvas.width-4}" height="${canvas.height-4}" 
                      fill="none" stroke="#e74c3c" stroke-width="4"/>
                
                <!-- Footer -->
                <text x="${canvas.width/2}" y="${canvas.height-20}" font-family="Arial" 
                      font-size="14" fill="#999" text-anchor="middle">
                    Preview Generated: ${new Date().toLocaleString()}
                </text>
            </svg>
        `;
        
        // Convert SVG to base64
        const base64 = Buffer.from(svg).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
    }

    /**
     * Extract first page as standalone PDF (for preview purposes)
     */
    async extractFirstPage(pdfBuffer) {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const newDoc = await PDFDocument.create();
        
        const [firstPage] = await newDoc.copyPages(pdfDoc, [0]);
        newDoc.addPage(firstPage);
        
        return Buffer.from(await newDoc.save());
    }

    /**
     * Add watermark to PDF
     */
    async addWatermark(pdfBuffer, watermarkText = 'CONFIDENTIAL') {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        pages.forEach(page => {
            const { width, height } = page.getSize();
            page.drawText(watermarkText, {
                x: width / 2 - 100,
                y: height / 2,
                size: 50,
                font,
                color: rgb(0.9, 0.9, 0.9),
                rotate: { angle: -45, origin: { x: width / 2, y: height / 2 } },
                opacity: 0.3
            });
        });
        
        return Buffer.from(await pdfDoc.save());
    }

    /**
     * Create styled PDF preview with document info
     */
    async createStyledPdfPreview(pdfBuffer) {
        try {
            // Get PDF info for display
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pageCount = pdfDoc.getPageCount();
            const title = pdfDoc.getTitle() || 'Legal Service Document';
            
            // Get first page dimensions
            const firstPage = pdfDoc.getPage(0);
            const { width, height } = firstPage.getSize();
            const aspectRatio = width / height;
            
            // Create a preview that mimics the document layout
            const previewWidth = 800;
            const previewHeight = Math.round(previewWidth / aspectRatio);
            
            const svg = `
                <svg width="${previewWidth}" height="${previewHeight}" xmlns="http://www.w3.org/2000/svg">
                    <!-- White background (document) -->
                    <rect width="${previewWidth}" height="${previewHeight}" fill="white"/>
                    
                    <!-- Document content placeholder -->
                    <rect x="40" y="100" width="${previewWidth-80}" height="2" fill="#e5e7eb"/>
                    <rect x="40" y="120" width="${previewWidth-120}" height="2" fill="#e5e7eb"/>
                    <rect x="40" y="140" width="${previewWidth-100}" height="2" fill="#e5e7eb"/>
                    <rect x="40" y="160" width="${previewWidth-140}" height="2" fill="#e5e7eb"/>
                    
                    <rect x="40" y="200" width="${previewWidth-80}" height="2" fill="#e5e7eb"/>
                    <rect x="40" y="220" width="${previewWidth-100}" height="2" fill="#e5e7eb"/>
                    <rect x="40" y="240" width="${previewWidth-120}" height="2" fill="#e5e7eb"/>
                    
                    <!-- Red overlay header -->
                    <rect x="0" y="0" width="${previewWidth}" height="80" fill="#e74c3c" fill-opacity="0.95"/>
                    
                    <!-- Header text -->
                    <text x="${previewWidth/2}" y="35" font-family="Arial, sans-serif" font-size="24" 
                          font-weight="bold" fill="white" text-anchor="middle">
                        LEGAL SERVICE ALERT
                    </text>
                    <text x="${previewWidth/2}" y="60" font-family="Arial, sans-serif" font-size="14" 
                          fill="white" text-anchor="middle">
                        Document Ready for Service - ${pageCount} Page${pageCount > 1 ? 's' : ''}
                    </text>
                    
                    <!-- Red border -->
                    <rect x="2" y="2" width="${previewWidth-4}" height="${previewHeight-4}" 
                          fill="none" stroke="#e74c3c" stroke-width="4"/>
                    
                    <!-- Watermark -->
                    <text x="${previewWidth/2}" y="${previewHeight/2}" font-family="Arial, sans-serif" 
                          font-size="48" fill="#e74c3c" fill-opacity="0.1" 
                          text-anchor="middle" transform="rotate(-45 ${previewWidth/2} ${previewHeight/2})">
                        LEGAL NOTICE
                    </text>
                    
                    <!-- Footer -->
                    <rect x="0" y="${previewHeight-40}" width="${previewWidth}" height="40" fill="#f8f9fa"/>
                    <text x="10" y="${previewHeight-15}" font-family="Arial, sans-serif" 
                          font-size="12" fill="#666">
                        Alert Preview Generated: ${new Date().toLocaleString()}
                    </text>
                </svg>
            `;
            
            // Convert SVG to base64
            const base64 = Buffer.from(svg).toString('base64');
            return `data:image/svg+xml;base64,${base64}`;
            
        } catch (error) {
            console.error('Failed to create styled preview:', error);
            return this.createSimplePreview('Legal Document');
        }
    }

    /**
     * Get PDF metadata
     */
    async getPDFInfo(pdfBuffer) {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        
        return {
            pageCount: pdfDoc.getPageCount(),
            title: pdfDoc.getTitle(),
            author: pdfDoc.getAuthor(),
            subject: pdfDoc.getSubject(),
            creator: pdfDoc.getCreator(),
            producer: pdfDoc.getProducer(),
            creationDate: pdfDoc.getCreationDate(),
            modificationDate: pdfDoc.getModificationDate(),
            size: pdfBuffer.length,
            sizeFormatted: `${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`
        };
    }
}

module.exports = PDFProcessor;