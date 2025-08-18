/**
 * PDF Upload Diagnostics - Identify what's taking 30 seconds
 */

console.log('🔍 PDF Upload Diagnostics Loaded');

// Track all timings
window.PDFDiagnostics = {
    startTime: null,
    operations: [],
    
    start() {
        this.startTime = Date.now();
        this.operations = [];
        console.log('⏱️ PDF DIAGNOSTICS STARTED');
    },
    
    log(operation, details = '') {
        const elapsed = Date.now() - this.startTime;
        const entry = `[${elapsed}ms] ${operation} ${details}`;
        this.operations.push(entry);
        console.log(`⏱️ ${entry}`);
        
        // Highlight slow operations
        if (elapsed > 5000) {
            console.warn(`⚠️ SLOW OPERATION: ${operation} took ${elapsed}ms`);
        }
    },
    
    end() {
        const total = Date.now() - this.startTime;
        console.log('⏱️ PDF DIAGNOSTICS COMPLETE');
        console.log(`Total time: ${total}ms (${(total/1000).toFixed(1)}s)`);
        console.log('Operations:', this.operations);
        
        // Show alert if it took too long
        if (total > 10000) {
            console.error(`❌ PDF processing took ${(total/1000).toFixed(1)}s - this is too slow!`);
            console.log('Breakdown:', this.operations.join('\n'));
        }
    }
};

// Intercept file reading
const originalFileReader = FileReader;
window.FileReader = function() {
    const reader = new originalFileReader();
    
    const originalReadAsDataURL = reader.readAsDataURL.bind(reader);
    const originalReadAsArrayBuffer = reader.readAsArrayBuffer.bind(reader);
    
    reader.readAsDataURL = function(file) {
        window.PDFDiagnostics.log('FileReader.readAsDataURL', `${file.name} (${(file.size/1024/1024).toFixed(2)}MB)`);
        return originalReadAsDataURL(file);
    };
    
    reader.readAsArrayBuffer = function(file) {
        window.PDFDiagnostics.log('FileReader.readAsArrayBuffer', `${file.name} (${(file.size/1024/1024).toFixed(2)}MB)`);
        return originalReadAsArrayBuffer(file);
    };
    
    const originalOnload = reader.onload;
    Object.defineProperty(reader, 'onload', {
        set: function(handler) {
            this._onload = function(e) {
                window.PDFDiagnostics.log('FileReader.onload fired');
                if (handler) handler.call(this, e);
            };
        },
        get: function() {
            return this._onload;
        }
    });
    
    return reader;
};

// Intercept document converter calls
if (window.DocumentConverter) {
    const OriginalConverter = window.DocumentConverter;
    window.DocumentConverter = function() {
        const instance = new OriginalConverter();
        
        const originalConvertDocument = instance.convertDocument;
        instance.convertDocument = async function(file) {
            window.PDFDiagnostics.log('DocumentConverter.convertDocument START', file.name);
            const result = await originalConvertDocument.call(this, file);
            window.PDFDiagnostics.log('DocumentConverter.convertDocument END');
            return result;
        };
        
        const originalConvertPDF = instance.convertPDF;
        instance.convertPDF = async function(file) {
            window.PDFDiagnostics.log('DocumentConverter.convertPDF START', file.name);
            const result = await originalConvertPDF.call(this, file);
            window.PDFDiagnostics.log('DocumentConverter.convertPDF END');
            return result;
        };
        
        return instance;
    };
}

// Intercept PDF.js calls
if (typeof pdfjsLib !== 'undefined') {
    const originalGetDocument = pdfjsLib.getDocument;
    pdfjsLib.getDocument = function(src) {
        window.PDFDiagnostics.log('pdfjsLib.getDocument START');
        const loadingTask = originalGetDocument.call(this, src);
        
        const originalPromise = loadingTask.promise;
        loadingTask.promise = originalPromise.then(pdf => {
            window.PDFDiagnostics.log('pdfjsLib.getDocument COMPLETE', `${pdf.numPages} pages`);
            return pdf;
        }).catch(error => {
            window.PDFDiagnostics.log('pdfjsLib.getDocument ERROR', error.message);
            throw error;
        });
        
        return loadingTask;
    };
}

// Intercept canvas operations
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
    window.PDFDiagnostics.log('Canvas.toDataURL', `${this.width}x${this.height} ${type || 'png'}`);
    return originalToDataURL.call(this, type, quality);
};

// Intercept fetch calls
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = args[0];
    if (url && url.toString().includes('/api/') && url.toString().includes('upload')) {
        window.PDFDiagnostics.log('Fetch START', url.toString());
        try {
            const result = await originalFetch.apply(this, args);
            window.PDFDiagnostics.log('Fetch COMPLETE', url.toString());
            return result;
        } catch (error) {
            window.PDFDiagnostics.log('Fetch ERROR', `${url} - ${error.message}`);
            throw error;
        }
    }
    return originalFetch.apply(this, args);
};

// Hook into document upload
const originalHandleDocumentUpload = window.handleDocumentUpload;
if (originalHandleDocumentUpload) {
    window.handleDocumentUpload = async function(event) {
        console.log('📊 STARTING PDF UPLOAD DIAGNOSTICS');
        window.PDFDiagnostics.start();
        
        try {
            const result = await originalHandleDocumentUpload.call(this, event);
            window.PDFDiagnostics.end();
            return result;
        } catch (error) {
            window.PDFDiagnostics.log('ERROR', error.message);
            window.PDFDiagnostics.end();
            throw error;
        }
    };
}

// Also hook into processDocumentFiles if it exists
const originalProcessFiles = window.processDocumentFiles;
if (originalProcessFiles) {
    window.processDocumentFiles = async function() {
        window.PDFDiagnostics.log('processDocumentFiles START');
        const result = await originalProcessFiles.call(this);
        window.PDFDiagnostics.log('processDocumentFiles END');
        return result;
    };
}

// Monitor UltraFastPDFHandler
if (window.UltraFastPDFHandler) {
    const originalProcessPDF = window.UltraFastPDFHandler.processPDF;
    window.UltraFastPDFHandler.processPDF = async function(file) {
        window.PDFDiagnostics.log('UltraFastPDFHandler.processPDF START', file.name);
        const result = await originalProcessPDF.call(this, file);
        window.PDFDiagnostics.log('UltraFastPDFHandler.processPDF END');
        return result;
    };
}

// Monitor FastPDFHandler
if (window.FastPDFHandler) {
    const originalProcessPDF = window.FastPDFHandler.processPDF;
    window.FastPDFHandler.processPDF = async function(file) {
        window.PDFDiagnostics.log('FastPDFHandler.processPDF START', file.name);
        const result = await originalProcessPDF.call(this, file);
        window.PDFDiagnostics.log('FastPDFHandler.processPDF END');
        return result;
    };
}

console.log('🔍 PDF Diagnostics Ready - Upload a PDF to see timing breakdown');