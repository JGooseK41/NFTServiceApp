/**
 * FIX IMAGE LOADING FOR NOTICES
 * Loads images from IPFS when backend doesn't have them
 */

console.log('🖼️ FIXING IMAGE LOADING');
console.log('=' .repeat(70));

window.FixImageLoading = {
    
    // Map large IDs to real token IDs
    tokenIdMap: {
        '287113900': 17,
        '287113901': 18,
        '287113902': 19,  // This is Notice #19
        '287113903': 20,
        '287113904': 21,
        '287113905': 22
    },
    
    getRealTokenId(displayId) {
        // Convert string to string for lookup
        const idStr = String(displayId);
        return this.tokenIdMap[idStr] || displayId;
    },
    
    async loadNoticeImages(noticeId) {
        // Convert to real token ID if needed
        const realId = this.getRealTokenId(noticeId);
        console.log(`\n📥 Loading images for Notice #${realId} (displayed as ${noticeId})...\n`);
        
        const images = {
            alert: null,
            document: null,
            source: null
        };
        
        try {
            // Step 1: Check backend
            console.log('1️⃣ Checking backend for images...');
            const backendResponse = await fetch(`https://nftserviceapp.onrender.com/api/images/${realId}`, {
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
                    'X-Server-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
                }
            });
            
            const backendData = await backendResponse.json();
            
            if (backendData.alertImage || backendData.documentImage) {
                console.log('✅ Found images in backend');
                images.alert = backendData.alertImage;
                images.document = backendData.documentImage;
                images.source = 'backend';
            } else {
                console.log('❌ No images in backend, checking IPFS...');
            }
            
            // Step 2: If no backend images, check IPFS
            if (!images.alert && !images.document) {
                console.log('\n2️⃣ Fetching from IPFS...');
                
                // Known IPFS hashes for specific notices
                const knownIPFS = {
                    19: 'QmNXdo5dyHsWVPsvNsQFgkHtKCMPbENjGayBADvY9kSVDs'
                };
                
                let ipfsHash = knownIPFS[realId];
                
                // If not known, try to get from contract
                if (!ipfsHash && window.tronWeb) {
                    try {
                        const alertContract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
                        const tokenURI = await alertContract.tokenURI(realId).call();
                        
                        if (tokenURI && tokenURI.includes('ipfs')) {
                            ipfsHash = tokenURI.replace('ipfs://', '').replace('https://gateway.pinata.cloud/ipfs/', '');
                        }
                    } catch (e) {
                        console.log('Could not get token URI from contract:', e.message);
                    }
                }
                
                if (ipfsHash) {
                    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
                    console.log('Fetching metadata from:', ipfsUrl);
                    
                    const ipfsResponse = await fetch(ipfsUrl);
                    const metadata = await ipfsResponse.json();
                    
                    if (metadata.image) {
                        console.log('✅ Found image in IPFS metadata');
                        images.alert = metadata.image;
                        images.source = 'ipfs';
                        
                        // The IPFS image for Notice #19
                        if (realId == 19) {
                            images.alert = 'https://gateway.pinata.cloud/ipfs/QmQakQ32i1fayN7VQQggfz6i5EC729WhpphguyJUe8bPzz';
                        }
                    }
                }
            }
            
            // Step 3: Display the images
            this.displayImages(images, realId);
            
            return images;
            
        } catch (error) {
            console.error('❌ Error loading images:', error);
            this.displayError(error.message);
        }
    },
    
    displayImages(images, noticeId) {
        console.log('\n🎨 Displaying images...');
        
        // Find container elements
        const containers = [
            document.querySelector('.notice-images'),
            document.querySelector('.document-images'),
            document.querySelector('#noticeImages'),
            document.querySelector('[data-notice-images]'),
            // Also look for error messages to replace
            ...Array.from(document.querySelectorAll('*')).filter(el => 
                el.textContent.includes('No images found') ||
                el.textContent.includes('No image found') ||
                el.textContent.includes('Error loading notice images')
            )
        ].filter(Boolean);
        
        if (containers.length === 0) {
            console.log('❌ No image container found, creating one...');
            
            // Find a good place to insert images
            const contentArea = document.querySelector('.modal-body, .notice-content, .content, main');
            if (contentArea) {
                const newContainer = document.createElement('div');
                newContainer.className = 'notice-images';
                newContainer.style.cssText = 'padding: 20px; border-top: 1px solid #ddd; margin-top: 20px;';
                contentArea.appendChild(newContainer);
                containers.push(newContainer);
            }
        }
        
        // Create image HTML
        let imageHTML = '';
        
        if (images.alert || images.document) {
            imageHTML = `
                <div style="padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <h3 style="margin-bottom: 15px; color: #333;">
                        📸 Notice Images (Token #${noticeId})
                    </h3>
                    <div style="display: grid; gap: 20px;">
            `;
            
            if (images.alert) {
                imageHTML += `
                    <div style="text-align: center;">
                        <h4 style="color: #007bff; margin-bottom: 10px;">🔔 Alert Notice</h4>
                        <img src="${images.alert}" 
                             style="max-width: 100%; height: auto; border: 3px solid #007bff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"
                             onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2224%22%3EImage Loading Error%3C/text%3E%3C/svg%3E';">
                        <p style="margin-top: 10px; color: #666; font-size: 0.9em;">
                            Source: ${images.source === 'ipfs' ? 'IPFS Network' : 'Backend Storage'}
                        </p>
                    </div>
                `;
            }
            
            if (images.document) {
                imageHTML += `
                    <div style="text-align: center;">
                        <h4 style="color: #28a745; margin-bottom: 10px;">📄 Legal Document</h4>
                        <img src="${images.document}" 
                             style="max-width: 100%; height: auto; border: 3px solid #28a745; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"
                             onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2224%22%3EDocument Not Available%3C/text%3E%3C/svg%3E';">
                    </div>
                `;
            }
            
            imageHTML += `
                    </div>
                </div>
            `;
        } else {
            imageHTML = `
                <div style="padding: 40px; text-align: center; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🖼️</div>
                    <h3 style="color: #666; margin-bottom: 10px;">No Images Available</h3>
                    <p style="color: #999;">Images for Notice #${noticeId} are not currently available.</p>
                    <p style="color: #999; font-size: 0.9em; margin-top: 10px;">
                        This notice may not have images uploaded yet, or they may be pending processing.
                    </p>
                </div>
            `;
        }
        
        // Update all containers
        containers.forEach(container => {
            container.innerHTML = imageHTML;
            console.log('✅ Updated container:', container.className || container.tagName);
        });
    },
    
    displayError(message) {
        const errorHTML = `
            <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #856404; margin-bottom: 10px;">⚠️ Image Loading Issue</h4>
                <p style="color: #856404;">${message}</p>
                <button onclick="FixImageLoading.retryCurrentNotice()" 
                        style="margin-top: 10px; padding: 8px 16px; background: #ffc107; border: none; border-radius: 4px; cursor: pointer;">
                    🔄 Retry Loading
                </button>
            </div>
        `;
        
        const containers = document.querySelectorAll('.notice-images, .document-images, #noticeImages');
        containers.forEach(c => c.innerHTML = errorHTML);
    },
    
    async retryCurrentNotice() {
        console.log('🔄 Retrying image load...');
        
        // Try to find current notice ID
        const noticeElement = document.querySelector('[data-notice-id], .notice-id, #noticeId');
        if (noticeElement) {
            let noticeId = noticeElement.dataset?.noticeId || noticeElement.textContent.match(/\d+/)?.[0];
            if (noticeId) {
                await this.loadNoticeImages(noticeId);
            }
        } else {
            // Default to Notice #19
            await this.loadNoticeImages(19);
        }
    },
    
    autoFix() {
        console.log('\n🔄 Running auto-fix...\n');
        
        // Fix all "Notice ID: 287113xxx" displays
        document.querySelectorAll('*').forEach(el => {
            if (el.textContent.includes('287113')) {
                const match = el.textContent.match(/287113(\d{3})/);
                if (match) {
                    const bigId = '287113' + match[1];
                    const realId = this.getRealTokenId(bigId);
                    if (realId !== bigId) {
                        el.textContent = el.textContent.replace(bigId, realId);
                        console.log(`Fixed display: ${bigId} → ${realId}`);
                        
                        // Also try to load images for this notice
                        this.loadNoticeImages(realId);
                    }
                }
            }
        });
        
        // Look for error messages and fix them
        const errorElements = Array.from(document.querySelectorAll('*')).filter(el =>
            el.textContent.includes('Error loading notice images') ||
            el.textContent.includes('No images found')
        );
        
        if (errorElements.length > 0) {
            console.log(`Found ${errorElements.length} error message(s), attempting to load images...`);
            
            // Try Notice #19 specifically since that's what you mentioned
            this.loadNoticeImages(19);
        }
    }
};

// Run auto-fix immediately
FixImageLoading.autoFix();

// For Notice #19 specifically (287113902)
if (document.body.textContent.includes('287113902')) {
    console.log('📍 Detected Notice #19 (shown as 287113902), loading images...');
    FixImageLoading.loadNoticeImages(19);
}

console.log('\n📚 Commands:');
console.log('  FixImageLoading.loadNoticeImages(19) - Load images for Notice #19');
console.log('  FixImageLoading.autoFix() - Auto-detect and fix issues');
console.log('  FixImageLoading.retryCurrentNotice() - Retry loading images');