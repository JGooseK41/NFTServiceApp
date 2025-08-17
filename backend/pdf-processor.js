/**
 * PDF Processor
 * Handles PDF merging, preview generation, and alert overlay creation
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');
const pdf2pic = require('pdf2pic');

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
    }

    /**
     * Merge multiple PDFs into one document
     */
    async mergePDFs(pdfBuffers) {
        console.log(`📑 Merging ${pdfBuffers.length} PDFs into one document`);
        
        const mergedPdf = await PDFDocument.create();
        
        for (let i = 0; i < pdfBuffers.length; i++) {
            try {
                // Load each PDF
                const pdf = await PDFDocument.load(pdfBuffers[i]);
                
                // Copy all pages
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                
                // Add pages to merged document
                pages.forEach(page => mergedPdf.addPage(page));
                
                console.log(`  ✓ Added PDF ${i + 1}: ${pdf.getPageCount()} pages`);
            } catch (error) {
                console.error(`  ✗ Failed to add PDF ${i + 1}:`, error.message);
                // Continue with other PDFs even if one fails
            }
        }
        
        // Add metadata
        mergedPdf.setTitle('Legal Service Document');
        mergedPdf.setCreator('LegalNotice NFT Service');
        mergedPdf.setCreationDate(new Date());
        mergedPdf.setModificationDate(new Date());
        
        const mergedBytes = await mergedPdf.save();
        console.log(`✅ Merged PDF created: ${mergedPdf.getPageCount()} total pages, ${(mergedBytes.length / 1024 / 1024).toFixed(2)}MB`);
        
        return Buffer.from(mergedBytes);
    }

    /**
     * Generate alert preview with overlay from first page
     */
    async generateAlertPreview(pdfBuffer) {
        console.log('🎨 Generating alert preview with overlay');
        
        try {
            // Method 1: Try with pdf2pic first (better quality)
            const preview = await this.generateWithPdf2Pic(pdfBuffer);
            if (preview) return preview;
        } catch (error) {
            console.warn('pdf2pic failed, trying alternative method:', error.message);
        }
        
        // Method 2: Fallback to pdf-lib canvas approach
        return await this.generateWithPdfLib(pdfBuffer);
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