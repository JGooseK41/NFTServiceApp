/**
 * PDF Print Processor
 * Uses headless browser to "print" PDFs, bypassing encryption
 */

const fs = require('fs').promises;
const path = require('path');
const { PDFDocument } = require('pdf-lib');

class PDFPrintProcessor {
    constructor() {
        this.tempDir = process.env.DISK_MOUNT_PATH 
            ? path.join(process.env.DISK_MOUNT_PATH, 'temp')
            : '/tmp';
        this.browser = null;
        this.puppeteer = null;
    }
    
    /**
     * Initialize Puppeteer if available
     */
    async initialize() {
        if (this.browser) return true;
        
        try {
            this.puppeteer = require('puppeteer');
            console.log('    Initializing headless browser...');
            
            // Launch with minimal resources for server environment
            // Use system Chromium if available (Docker environment)
            const launchOptions = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-zygote',
                    '--single-process',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            };
            
            // Use system Chromium in Docker environment
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            }
            
            this.browser = await this.puppeteer.launch(launchOptions);
            
            console.log('    ✅ Browser initialized');
            return true;
        } catch (error) {
            console.log('    ❌ Puppeteer not available:', error.message);
            return false;
        }
    }
    
    /**
     * Print PDF to bypass encryption
     */
    async printPDF(pdfBuffer, fileName) {
        try {
            if (!await this.initialize()) {
                return null;
            }
            
            console.log(`    Print-to-PDF processing ${fileName}...`);
            
            // Save PDF temporarily
            const inputPath = path.join(this.tempDir, `print_input_${Date.now()}.pdf`);
            await fs.mkdir(this.tempDir, { recursive: true });
            await fs.writeFile(inputPath, pdfBuffer);
            
            // Create a new page
            const page = await this.browser.newPage();
            
            try {
                // Method 1: Try to load PDF directly as file URL
                const fileUrl = `file://${inputPath}`;
                await page.goto(fileUrl, { 
                    waitUntil: 'networkidle0',
                    timeout: 30000 
                });
                
                // Print to PDF (this re-renders the content)
                const printedPdf = await page.pdf({
                    format: 'Letter',
                    printBackground: true,
                    displayHeaderFooter: false,
                    margin: {
                        top: '0px',
                        right: '0px',
                        bottom: '0px',
                        left: '0px'
                    }
                });
                
                console.log(`    ✅ Printed ${printedPdf.length} bytes`);
                
                // Clean up
                await page.close();
                await fs.unlink(inputPath).catch(() => {});
                
                // Verify the printed PDF
                const pdf = await PDFDocument.load(printedPdf);
                const pageCount = pdf.getPageCount();
                
                console.log(`    ✅ Print-to-PDF successful: ${pageCount} pages`);
                
                return {
                    success: true,
                    buffer: Buffer.from(printedPdf),
                    pageCount: pageCount
                };
                
            } catch (pageError) {
                console.log(`    Print error: ${pageError.message}`);
                await page.close();
                
                // Method 2: Try converting to HTML first
                return await this.printViaHTML(pdfBuffer, inputPath);
            }
            
        } catch (error) {
            console.log(`    Print-to-PDF failed: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Alternative: Convert PDF to images then to PDF
     */
    async printViaHTML(pdfBuffer, inputPath) {
        try {
            console.log('    Trying HTML conversion method...');
            
            // Create HTML with embedded PDF
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { margin: 0; padding: 0; }
                        embed { width: 100vw; height: 100vh; }
                    </style>
                </head>
                <body>
                    <embed src="file://${inputPath}" type="application/pdf" />
                </body>
                </html>
            `;
            
            const page = await this.browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            const printedPdf = await page.pdf({
                format: 'Letter',
                printBackground: true
            });
            
            await page.close();
            await fs.unlink(inputPath).catch(() => {});
            
            return {
                success: true,
                buffer: Buffer.from(printedPdf),
                pageCount: 1 // This method typically produces single page
            };
            
        } catch (error) {
            console.log(`    HTML method failed: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = PDFPrintProcessor;