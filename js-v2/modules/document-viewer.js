// Document Viewer Module - Handles secure document retrieval and display
window.documentViewer = {
    
    // View encrypted document by ID
    async viewDocument(documentId, viewerAddress) {
        try {
            console.log('Retrieving encrypted document:', documentId);
            
            // Build API URL
            const baseUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:3001'
                : 'https://nftserviceapp.onrender.com';
            
            const url = `${baseUrl}/api/documents/encrypted/${documentId}`;
            
            // Fetch with authentication
            const response = await fetchWithTimeout(url, {
                headers: {
                    'X-Wallet-Address': viewerAddress || window.wallet?.address || '',
                    'X-Server-Address': viewerAddress || window.wallet?.address || ''
                }
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Access denied - you are not authorized to view this document');
                } else if (response.status === 404) {
                    throw new Error('Document not found');
                } else {
                    throw new Error('Failed to retrieve document');
                }
            }
            
            // Get document as blob
            const blob = await response.blob();
            
            // Create object URL for viewing
            const objectUrl = URL.createObjectURL(blob);
            
            return {
                success: true,
                url: objectUrl,
                blob: blob,
                type: response.headers.get('content-type')
            };
            
        } catch (error) {
            console.error('Failed to view document:', error);
            throw error;
        }
    },
    
    // Get document metadata without decrypting
    async getDocumentMetadata(documentId) {
        try {
            const baseUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:3001'
                : 'https://nftserviceapp.onrender.com';
            
            const url = `${baseUrl}/api/documents/encrypted/${documentId}/metadata`;
            
            const response = await fetchWithTimeout(url);
            
            if (!response.ok) {
                throw new Error('Failed to get document metadata');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Failed to get metadata:', error);
            throw error;
        }
    },
    
    // Display document in iframe or new window
    async displayDocument(documentId, targetElement, options = {}) {
        try {
            // Show loading state
            if (targetElement) {
                targetElement.innerHTML = '<div class="loading">Decrypting document...</div>';
            }
            
            // Get the document
            const result = await this.viewDocument(documentId, options.viewerAddress);
            
            if (options.newWindow) {
                // Open in new window
                window.open(result.url, '_blank');
            } else if (targetElement) {
                // Display in iframe
                const iframe = document.createElement('iframe');
                iframe.src = result.url;
                iframe.style.width = '100%';
                iframe.style.height = options.height || '800px';
                iframe.style.border = 'none';
                
                targetElement.innerHTML = '';
                targetElement.appendChild(iframe);
            }
            
            return result;
            
        } catch (error) {
            if (targetElement) {
                targetElement.innerHTML = `
                    <div class="error" style="color: red; padding: 20px;">
                        ${error.message}
                    </div>
                `;
            }
            throw error;
        }
    },
    
    // Download decrypted document
    async downloadDocument(documentId, viewerAddress) {
        try {
            const result = await this.viewDocument(documentId, viewerAddress);
            
            // Get metadata for filename
            const metadata = await this.getDocumentMetadata(documentId);
            const filename = metadata?.original_name || `document_${documentId}.pdf`;
            
            // Create download link
            const a = document.createElement('a');
            a.href = result.url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up object URL
            setTimeout(() => URL.revokeObjectURL(result.url), 1000);
            
            return { success: true, filename };
            
        } catch (error) {
            console.error('Failed to download document:', error);
            throw error;
        }
    },
    
    // Check if user has access to document
    async checkAccess(documentId, userAddress) {
        try {
            const metadata = await this.getDocumentMetadata(documentId);
            
            if (!metadata) {
                return { hasAccess: false, reason: 'Document not found' };
            }
            
            // For now, just check if metadata is accessible
            // The backend will do the actual authorization
            return { hasAccess: true, metadata };
            
        } catch (error) {
            return { hasAccess: false, reason: error.message };
        }
    },
    
    // Create a secure document viewer component
    createViewer(containerId, documentId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }
        
        // Create viewer HTML
        container.innerHTML = `
            <div class="document-viewer" style="border: 1px solid #ddd; border-radius: 5px; padding: 10px;">
                <div class="viewer-header" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <h3>Document Viewer</h3>
                    <div class="viewer-controls">
                        <button onclick="documentViewer.downloadDocument('${documentId}', '${options.viewerAddress || ''}')">
                            Download
                        </button>
                        <button onclick="documentViewer.displayDocument('${documentId}', document.getElementById('viewer-content-${documentId}'), {newWindow: true})">
                            Open in New Window
                        </button>
                    </div>
                </div>
                <div id="viewer-content-${documentId}" class="viewer-content" style="min-height: 600px; background: #f5f5f5;">
                    <div style="padding: 20px; text-align: center;">
                        Click "Load Document" to decrypt and view
                    </div>
                </div>
                <div class="viewer-footer" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                    <button onclick="documentViewer.displayDocument('${documentId}', document.getElementById('viewer-content-${documentId}'))">
                        Load Document
                    </button>
                    <span style="margin-left: 10px; color: #666;">
                        Document ID: ${documentId}
                    </span>
                </div>
            </div>
        `;
        
        // Auto-load if specified
        if (options.autoLoad) {
            this.displayDocument(documentId, document.getElementById(`viewer-content-${documentId}`), options);
        }
    }
};

console.log('Document viewer module loaded');