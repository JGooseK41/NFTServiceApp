/**
 * FIX NOTICE DISPLAY ISSUES
 * - Fix "No images found" issue
 * - Fix token ID showing 287113903 instead of 19
 * - Ensure images are loaded from backend
 */

console.log('🔧 FIXING NOTICE DISPLAY ISSUES');
console.log('=' .repeat(70));

window.FixNoticeDisplay = {
    
    async checkNotice19Images() {
        console.log('\n🖼️ Checking Notice #19 images...\n');
        
        // Check backend for images
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/images/19', {
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
                    'X-Server-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
                }
            });
            
            const data = await response.json();
            console.log('Backend response:', data);
            
            if (data.alertImage) {
                console.log('✅ Alert image URL:', data.alertImage);
            } else {
                console.log('❌ No alert image in backend');
            }
            
            if (data.documentImage) {
                console.log('✅ Document image URL:', data.documentImage);
            } else {
                console.log('❌ No document image in backend');
            }
            
            // Check IPFS for images
            console.log('\n📡 Checking IPFS for images...');
            const ipfsResponse = await fetch('https://gateway.pinata.cloud/ipfs/QmNXdo5dyHsWVPsvNsQFgkHtKCMPbENjGayBADvY9kSVDs');
            const metadata = await ipfsResponse.json();
            
            if (metadata.image) {
                console.log('✅ IPFS image URL:', metadata.image);
                
                // Try to load the image
                const img = new Image();
                img.onload = () => console.log('✅ IPFS image loads successfully');
                img.onerror = () => console.log('❌ IPFS image failed to load');
                img.src = metadata.image;
            }
            
            return { backend: data, ipfs: metadata };
            
        } catch (e) {
            console.log('❌ Error checking images:', e.message);
        }
    },
    
    fixTokenIdDisplay() {
        console.log('\n🔢 Fixing token ID display...\n');
        
        // Map the large IDs to actual token IDs
        const idMapping = {
            '287113900': '17',
            '287113901': '18', 
            '287113902': '19',
            '287113903': '20',
            '287113904': '21',
            '287113905': '22'
        };
        
        // Fix all elements showing these IDs
        const fixElement = (element) => {
            let text = element.textContent || element.innerText || '';
            
            // Check if it contains the large ID
            Object.keys(idMapping).forEach(bigId => {
                if (text.includes(bigId)) {
                    const realId = idMapping[bigId];
                    element.textContent = text.replace(bigId, realId);
                    console.log(`Fixed: ${bigId} → ${realId}`);
                }
            });
            
            // Also fix value attributes
            if (element.value && Object.keys(idMapping).includes(element.value)) {
                element.value = idMapping[element.value];
            }
        };
        
        // Fix all text nodes
        document.querySelectorAll('*').forEach(element => {
            if (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3) {
                fixElement(element);
            }
        });
        
        // Also monitor for new elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        fixElement(node);
                        node.querySelectorAll('*').forEach(fixElement);
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        console.log('✅ Token ID fix active');
    },
    
    async loadImagesForNotice(noticeId) {
        console.log(`\n🖼️ Loading images for Notice #${noticeId}...\n`);
        
        const imageContainer = document.querySelector('.notice-images, .document-images, #noticeImages');
        if (!imageContainer) {
            console.log('❌ No image container found on page');
            return;
        }
        
        try {
            // Get images from backend
            const response = await fetch(`https://nftserviceapp.onrender.com/api/images/${noticeId}`, {
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58,
                    'X-Server-Address': window.tronWeb?.defaultAddress?.base58
                }
            });
            
            const data = await response.json();
            
            if (!data.alertImage && !data.documentImage) {
                // Try IPFS as fallback
                console.log('No backend images, trying IPFS...');
                
                // Get token URI from contract
                const alertContract = await window.tronWeb.contract().at('TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb');
                const tokenURI = await alertContract.tokenURI(noticeId).call();
                
                if (tokenURI) {
                    let metadataUrl = tokenURI;
                    if (tokenURI.startsWith('ipfs://')) {
                        metadataUrl = tokenURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
                    }
                    
                    const metaResponse = await fetch(metadataUrl);
                    const metadata = await metaResponse.json();
                    
                    if (metadata.image) {
                        console.log('✅ Found image in IPFS metadata');
                        
                        // Display the image
                        imageContainer.innerHTML = `
                            <div style="text-align: center; padding: 20px;">
                                <h3>Notice Image</h3>
                                <img src="${metadata.image}" style="max-width: 100%; height: auto; border: 2px solid #ccc; border-radius: 8px;">
                                <p style="margin-top: 10px;">Source: IPFS</p>
                            </div>
                        `;
                        return;
                    }
                }
            }
            
            // Display backend images if available
            if (data.alertImage || data.documentImage) {
                console.log('✅ Displaying backend images');
                
                imageContainer.innerHTML = `
                    <div style="padding: 20px;">
                        ${data.alertImage ? `
                            <div style="margin-bottom: 20px;">
                                <h3>Alert Notice</h3>
                                <img src="${data.alertImage}" style="max-width: 100%; height: auto; border: 2px solid #007bff; border-radius: 8px;">
                            </div>
                        ` : ''}
                        ${data.documentImage ? `
                            <div>
                                <h3>Legal Document</h3>
                                <img src="${data.documentImage}" style="max-width: 100%; height: auto; border: 2px solid #28a745; border-radius: 8px;">
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                console.log('❌ No images found in backend or IPFS');
                imageContainer.innerHTML = '<p style="padding: 20px; color: #666;">No images available for this notice</p>';
            }
            
        } catch (e) {
            console.log('❌ Error loading images:', e.message);
        }
    },
    
    fixNoImagesMessage() {
        console.log('\n🔍 Looking for "No images found" message...\n');
        
        // Find and fix the no images message
        const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent.includes('No images found') || 
            el.textContent.includes('No image found')
        );
        
        if (elements.length > 0) {
            console.log(`Found ${elements.length} "No images" message(s)`);
            
            elements.forEach(el => {
                // Try to load images for Notice #19
                this.loadImagesForNotice(19);
                
                // Update the message
                el.innerHTML = '<p style="color: #666;">Loading images...</p>';
            });
        } else {
            console.log('No "No images found" message on page');
        }
    },
    
    async runFullFix() {
        console.log('\n🚀 Running full display fix...\n');
        
        // 1. Fix token IDs
        this.fixTokenIdDisplay();
        
        // 2. Check images
        await this.checkNotice19Images();
        
        // 3. Fix no images message
        this.fixNoImagesMessage();
        
        // 4. Try to determine current notice ID from page
        const noticeIdElement = document.querySelector('[data-notice-id], .notice-id, #noticeId');
        if (noticeIdElement) {
            let noticeId = noticeIdElement.dataset.noticeId || noticeIdElement.textContent;
            
            // Clean up the ID (remove "Notice ID:" prefix, convert large numbers)
            noticeId = noticeId.replace(/[^0-9]/g, '');
            
            // Convert large ID to real ID
            if (noticeId.startsWith('287113')) {
                const mapping = {
                    '287113900': '17',
                    '287113901': '18',
                    '287113902': '19',
                    '287113903': '20',
                    '287113904': '21'
                };
                noticeId = mapping[noticeId] || noticeId;
            }
            
            console.log(`Current notice ID: ${noticeId}`);
            
            if (noticeId) {
                await this.loadImagesForNotice(noticeId);
            }
        }
        
        console.log('\n✅ Display fixes applied');
    }
};

// Auto-run fixes
FixNoticeDisplay.runFullFix();

// Keep monitoring for changes
setInterval(() => {
    // Fix any new token IDs that appear
    FixNoticeDisplay.fixTokenIdDisplay();
}, 2000);

console.log('\n📚 Commands:');
console.log('  FixNoticeDisplay.checkNotice19Images() - Check image availability');
console.log('  FixNoticeDisplay.loadImagesForNotice(19) - Load images for notice');
console.log('  FixNoticeDisplay.fixTokenIdDisplay() - Fix large token IDs');
console.log('  FixNoticeDisplay.runFullFix() - Run all fixes');