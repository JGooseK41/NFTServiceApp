/**
 * FIX NOTICE VIEWER DISPLAY ISSUES
 * - Remove purple color scheme
 * - Fix contrast issues
 * - Fix "no image found" error
 */

console.log('🎨 Fixing notice viewer display issues...');

(function() {
    // Fix 1: Replace purple gradient with professional blue
    function fixColorScheme() {
        // Find all elements with the purple gradient
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.background && style.background.includes('#3730a3')) {
                // Replace purple with dark blue
                el.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #1e40af 100%)';
            }
            
            // Fix any inline styles
            if (el.style.background && el.style.background.includes('#3730a3')) {
                el.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #1e40af 100%)';
            }
        });
        
        // Add better contrast styles
        const style = document.createElement('style');
        style.innerHTML = `
            /* Fix contrast issues */
            .notice-viewer-container,
            .notice-content,
            .alert-content,
            .document-content {
                background: white !important;
                color: #111827 !important;
            }
            
            .notice-viewer-container h1,
            .notice-viewer-container h2,
            .notice-viewer-container h3,
            .notice-viewer-container h4 {
                color: #111827 !important;
            }
            
            .notice-viewer-container p,
            .notice-viewer-container div,
            .notice-viewer-container span {
                color: #374151 !important;
            }
            
            /* Fix gradient backgrounds to blue theme */
            .gradient-header,
            .header-gradient,
            [style*="linear-gradient"] {
                background: linear-gradient(135deg, #0ea5e9 0%, #1e40af 100%) !important;
            }
            
            /* Ensure text on gradients is readable */
            .gradient-header *,
            .header-gradient *,
            [style*="linear-gradient"] * {
                color: white !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            
            /* Fix specific BlockServed styles */
            .blockserved-header {
                background: linear-gradient(135deg, #0ea5e9 0%, #1e40af 100%) !important;
            }
            
            .blockserved-content {
                background: white !important;
                color: #111827 !important;
                padding: 20px;
            }
        `;
        document.head.appendChild(style);
        console.log('✅ Color scheme fixed');
    }
    
    // Fix 2: Load and display notice images properly
    async function fixImageLoading() {
        console.log('🖼️ Fixing image loading...');
        
        // Get notice ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const noticeId = urlParams.get('id') || urlParams.get('noticeId') || urlParams.get('tokenId');
        
        if (!noticeId) {
            console.log('No notice ID found in URL');
            return;
        }
        
        console.log('Loading images for notice:', noticeId);
        
        // Find image containers
        const imageContainers = document.querySelectorAll(
            '.notice-image, .alert-image, .document-image, ' +
            '#noticeImage, #alertImage, #documentImage, ' +
            '[data-image-container], .image-container'
        );
        
        // Also check for "no image" messages
        const noImageMessages = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && (
                el.textContent.includes('No image found') ||
                el.textContent.includes('No images found') ||
                el.textContent.includes('Error loading')
            )
        );
        
        if (imageContainers.length > 0 || noImageMessages.length > 0) {
            try {
                // Fetch images from backend
                const response = await fetch(`https://nftserviceapp.onrender.com/api/images/${noticeId}`, {
                    headers: {
                        'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || '',
                        'X-Server-Address': localStorage.getItem('serverAddress') || ''
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // Display alert image
                    if (data.alertImage) {
                        displayImage(data.alertImage, 'alert', imageContainers, noImageMessages);
                    }
                    
                    // Display document image if exists
                    if (data.documentImage) {
                        displayImage(data.documentImage, 'document', imageContainers, noImageMessages);
                    }
                    
                    // If no images, check blockchain
                    if (!data.alertImage && !data.documentImage) {
                        console.log('No images in backend, checking blockchain...');
                        await loadFromBlockchain(noticeId, imageContainers, noImageMessages);
                    }
                } else {
                    console.log('Backend error, trying blockchain...');
                    await loadFromBlockchain(noticeId, imageContainers, noImageMessages);
                }
            } catch (error) {
                console.error('Error loading images:', error);
                await loadFromBlockchain(noticeId, imageContainers, noImageMessages);
            }
        }
    }
    
    function displayImage(imageData, type, containers, messages) {
        console.log(`Displaying ${type} image`);
        
        // Remove "no image" messages
        messages.forEach(msg => {
            msg.style.display = 'none';
        });
        
        // Create image element
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = `${type} notice image`;
        img.style.cssText = `
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin: 10px 0;
        `;
        
        // Add to containers
        containers.forEach(container => {
            container.innerHTML = '';
            container.appendChild(img.cloneNode(true));
        });
        
        // Also add to any empty containers that might be for images
        const emptyContainers = document.querySelectorAll('.content-box:empty, .image-box:empty');
        emptyContainers.forEach(container => {
            container.appendChild(img.cloneNode(true));
        });
    }
    
    async function loadFromBlockchain(noticeId, containers, messages) {
        try {
            if (!window.tronWeb || !window.legalContract) {
                console.log('TronWeb or contract not available');
                return;
            }
            
            const tokenURI = await window.legalContract.tokenURI(noticeId).call();
            
            if (tokenURI.startsWith('data:')) {
                // Parse base64 metadata
                const base64 = tokenURI.split(',')[1];
                const json = atob(base64);
                const metadata = JSON.parse(json);
                
                if (metadata.image) {
                    displayImage(metadata.image, 'blockchain', containers, messages);
                }
            }
        } catch (error) {
            console.error('Error loading from blockchain:', error);
        }
    }
    
    // Run fixes
    fixColorScheme();
    
    // Wait for page to load then fix images
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixImageLoading);
    } else {
        fixImageLoading();
    }
    
    // Re-run on dynamic content changes
    const observer = new MutationObserver(() => {
        fixColorScheme();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('✅ Notice viewer display fixes applied');
})();