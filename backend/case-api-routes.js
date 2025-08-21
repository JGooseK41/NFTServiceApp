/**
 * Case Management API Routes
 * RESTful endpoints for case lifecycle management
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const CaseManager = require('./case-manager');

// Initialize case manager
const caseManager = new CaseManager();

// Configure multer for PDF uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max per file
        files: 10 // Max 10 files at once
    },
    fileFilter: (req, file, cb) => {
        // Accept only PDFs
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

/**
 * Middleware to verify server authentication
 */
const verifyServer = (req, res, next) => {
    const serverAddress = req.headers['x-server-address'] || 
                         req.body.serverAddress || 
                         req.query.serverAddress;
    
    if (!serverAddress) {
        console.log('Warning: No server address provided, using TEST address');
        req.serverAddress = 'TEST-SERVER-DEFAULT';
    } else {
        req.serverAddress = serverAddress;
    }
    
    next();
};

/**
 * TEST ENDPOINT
 * GET /api/cases/test
 * No authentication required
 */
router.get('/cases/test', (req, res) => {
    res.json({
        success: true,
        message: 'Case API is working',
        timestamp: new Date().toISOString()
    });
});

/**
 * CREATE NEW CASE
 * POST /api/cases
 * Upload multiple PDFs to create a new case
 */
router.post('/cases', verifyServer, upload.array('documents', 10), async (req, res) => {
    console.log('POST /api/cases - Server:', req.serverAddress, 'Files:', req.files?.length);
    console.log('Case Number from form:', req.body.caseNumber);
    
    // Log all received files
    if (req.files && req.files.length > 0) {
        console.log('📥 Received files:');
        req.files.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.originalname} - ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        });
    }
    
    try {
        // Validate case number is provided
        if (!req.body.caseNumber) {
            return res.status(400).json({
                success: false,
                error: 'Case number is required. Please enter a case number in the form.'
            });
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No PDF files uploaded'
            });
        }
        
        console.log(`📤 Received ${req.files.length} PDFs for case: ${req.body.caseNumber}`);
        
        const metadata = {
            caseNumber: req.body.caseNumber,
            noticeText: req.body.noticeText,
            issuingAgency: req.body.issuingAgency,
            noticeType: req.body.noticeType,
            caseDetails: req.body.caseDetails,
            responseDeadline: req.body.responseDeadline,
            legalRights: req.body.legalRights,
            recipients: req.body.recipients ? JSON.parse(req.body.recipients) : [],
            description: req.body.description,
            caseType: req.body.caseType,
            urgency: req.body.urgency,
            notes: req.body.notes
        };
        
        const result = await caseManager.createCase(
            req.serverAddress,
            req.files,
            metadata
        );
        
        if (result.success) {
            // Generate URL for consolidated PDF
            const consolidatedPdfUrl = `/api/cases/${result.caseId}/pdf`;
            
            res.json({
                success: true,
                caseId: result.caseId,
                case: result.case,
                pdfInfo: result.pdfInfo,
                alertPreview: result.alertPreview,
                consolidatedPdfUrl: consolidatedPdfUrl,
                message: 'PDFs cleaned and consolidated successfully'
            });
        } else if (result.exists) {
            // Case already exists - return with special status
            console.log('Case already exists:', result.caseId);
            res.status(409).json({
                success: false,
                exists: true,
                caseId: result.caseId,
                case: result.case,
                message: result.message,
                error: 'CASE_EXISTS'
            });
        } else {
            console.error('Case creation failed:', result.error);
            res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('Case creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * AMEND/UPDATE CASE
 * PUT /api/cases/:caseId
 * Update an existing case with new files or metadata
 */
router.put('/cases/:caseId', verifyServer, upload.array('documents', 10), async (req, res) => {
    console.log('PUT /api/cases/:caseId - Case:', req.params.caseId, 'Server:', req.serverAddress);
    
    try {
        const metadata = {
            caseNumber: req.body.caseNumber || req.params.caseId,
            noticeText: req.body.noticeText,
            issuingAgency: req.body.issuingAgency,
            noticeType: req.body.noticeType,
            caseDetails: req.body.caseDetails,
            responseDeadline: req.body.responseDeadline,
            legalRights: req.body.legalRights,
            recipients: req.body.recipients ? JSON.parse(req.body.recipients) : [],
            amendedAt: new Date().toISOString()
        };
        
        const result = await caseManager.amendCase(
            req.params.caseId,
            req.serverAddress,
            req.files,
            metadata
        );
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
        
    } catch (error) {
        console.error('Case amendment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET CASE DETAILS
 * GET /api/cases/:caseId
 */
router.get('/cases/:caseId', verifyServer, async (req, res) => {
    try {
        const result = await caseManager.getCase(
            req.params.caseId,
            req.serverAddress
        );
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
        
    } catch (error) {
        console.error('Get case error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET CASE PDF
 * GET /api/cases/:caseId/pdf
 * Returns the actual PDF file
 */
router.get('/cases/:caseId/pdf', verifyServer, async (req, res) => {
    try {
        const result = await caseManager.getCasePDF(
            req.params.caseId,
            req.serverAddress
        );
        
        if (result.success) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="case-${req.params.caseId}.pdf"`);
            res.send(result.pdf);
        } else {
            res.status(404).json(result);
        }
        
    } catch (error) {
        console.error('Get PDF error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE CASE
 * DELETE /api/cases/:caseId
 * Delete a case and its associated data
 */
router.delete('/cases/:caseId', verifyServer, async (req, res) => {
    console.log('DELETE /api/cases/:caseId - Case:', req.params.caseId, 'Server:', req.serverAddress);
    
    try {
        // For now, just delete from database
        // In the future, might want to archive instead
        const result = await caseManager.deleteCase(
            req.params.caseId,
            req.serverAddress
        );
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
        
    } catch (error) {
        console.error('Case deletion error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET ALERT PREVIEW
 * GET /api/cases/:caseId/preview
 * Returns the alert preview image
 */
router.get('/cases/:caseId/preview', verifyServer, async (req, res) => {
    try {
        const result = await caseManager.getCase(
            req.params.caseId,
            req.serverAddress
        );
        
        if (result.success && result.case.alert_preview) {
            // Extract image data from base64
            const matches = result.case.alert_preview.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            
            if (matches && matches.length === 3) {
                const imageBuffer = Buffer.from(matches[2], 'base64');
                res.setHeader('Content-Type', matches[1]);
                res.send(imageBuffer);
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Invalid preview format'
                });
            }
        } else {
            res.status(404).json({
                success: false,
                error: 'Preview not found'
            });
        }
        
    } catch (error) {
        console.error('Get preview error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * LIST CASES
 * GET /api/cases
 * Query params: status (draft|ready|served)
 */
router.get('/cases', verifyServer, async (req, res) => {
    console.log('GET /api/cases - Server:', req.serverAddress);
    try {
        const result = await caseManager.listCases(
            req.serverAddress,
            req.query.status
        );
        
        res.json(result);
        
    } catch (error) {
        console.error('List cases error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * UPDATE CASE
 * PUT /api/cases/:caseId
 * Update case metadata or status
 */
router.put('/cases/:caseId', verifyServer, async (req, res) => {
    try {
        // Verify ownership first
        const caseCheck = await caseManager.getCase(
            req.params.caseId,
            req.serverAddress
        );
        
        if (!caseCheck.success) {
            return res.status(404).json(caseCheck);
        }
        
        const result = await caseManager.updateCaseStatus(
            req.params.caseId,
            req.body.status,
            req.body
        );
        
        res.json(result);
        
    } catch (error) {
        console.error('Update case error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PREPARE CASE FOR SERVING
 * POST /api/cases/:caseId/prepare
 * Encrypt and prepare for IPFS upload
 */
router.post('/cases/:caseId/prepare', verifyServer, async (req, res) => {
    try {
        if (!req.body.recipientAddress) {
            return res.status(400).json({
                success: false,
                error: 'Recipient address required'
            });
        }
        
        const result = await caseManager.prepareCaseForServing(
            req.params.caseId,
            req.body.recipientAddress
        );
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('Prepare case error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * MARK CASE AS SERVED
 * POST /api/cases/:caseId/served
 * Called after successful blockchain transaction
 */
router.post('/cases/:caseId/served', verifyServer, async (req, res) => {
    try {
        const { txHash, alertNftId, documentNftId } = req.body;
        
        if (!txHash) {
            return res.status(400).json({
                success: false,
                error: 'Transaction hash required'
            });
        }
        
        const result = await caseManager.markCaseAsServed(
            req.params.caseId,
            txHash,
            alertNftId,
            documentNftId
        );
        
        res.json(result);
        
    } catch (error) {
        console.error('Mark served error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE CASE
 * DELETE /api/cases/:caseId
 * Only drafts can be deleted
 */
router.delete('/cases/:caseId', verifyServer, async (req, res) => {
    try {
        const result = await caseManager.deleteCase(
            req.params.caseId,
            req.serverAddress
        );
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
        
    } catch (error) {
        console.error('Delete case error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DISK STATISTICS
 * GET /api/storage/stats
 * Get disk usage information
 */
router.get('/storage/stats', verifyServer, async (req, res) => {
    try {
        const diskStats = await caseManager.diskStorage.getDiskStats();
        const cases = await caseManager.diskStorage.listCases(true);
        
        res.json({
            success: true,
            disk: diskStats,
            caseCount: {
                active: cases.filter(c => c.status === 'active').length,
                archived: cases.filter(c => c.status === 'archived').length,
                total: cases.length
            }
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;