/**
 * CHECK ALERT #27 METADATA
 * Verifies the structure and encoding of Alert Token #27
 */

console.log('🔍 CHECKING ALERT #27 METADATA');
console.log('=' .repeat(70));

window.CheckAlert27 = {
    
    async checkTokenURI() {
        console.log('\n📡 Fetching Alert #27 tokenURI from blockchain...\n');
        
        try {
            // Connect to the Alert NFT contract
            const contractAddress = 'TXHKwNNPVgPCABEsJQfKVKj5g6p4LN3Mcb';
            const contract = await window.tronWeb.contract().at(contractAddress);
            
            // Get the tokenURI for Alert #27
            const tokenURI = await contract.tokenURI(27).call();
            
            console.log('📌 Token URI for Alert #27:');
            console.log(tokenURI);
            console.log('\n' + '─'.repeat(50) + '\n');
            
            // Analyze the URI structure
            this.analyzeURI(tokenURI);
            
            // If it's a data URI, decode it
            if (tokenURI.startsWith('data:')) {
                await this.decodeDataURI(tokenURI);
            } 
            // If it's IPFS, fetch from gateway
            else if (tokenURI.includes('ipfs')) {
                await this.fetchIPFSMetadata(tokenURI);
            }
            
            return tokenURI;
            
        } catch (error) {
            console.error('❌ Error fetching token URI:', error);
        }
    },
    
    analyzeURI(uri) {
        console.log('🔬 ANALYZING URI STRUCTURE:');
        console.log('─'.repeat(50));
        
        if (uri.startsWith('data:application/json;base64,')) {
            console.log('✅ Type: BASE64 DATA URI');
            console.log('✅ Self-contained metadata (no external dependencies)');
            console.log('✅ Will display in wallets without IPFS');
        } else if (uri.includes('ipfs://')) {
            console.log('⚠️ Type: IPFS URI');
            console.log('⚠️ Requires IPFS gateway to access');
            console.log('⚠️ May not display in some wallets');
        } else if (uri.includes('gateway.pinata.cloud')) {
            console.log('⚠️ Type: PINATA GATEWAY URL');
            console.log('⚠️ Depends on Pinata service availability');
        } else {
            console.log('❓ Type: UNKNOWN FORMAT');
        }
        
        console.log('\n' + '─'.repeat(50) + '\n');
    },
    
    async decodeDataURI(dataURI) {
        console.log('🔓 DECODING BASE64 METADATA:');
        console.log('─'.repeat(50));
        
        try {
            // Extract the base64 part
            const base64Data = dataURI.split(',')[1];
            
            // Decode from base64
            const jsonString = atob(base64Data);
            const metadata = JSON.parse(jsonString);
            
            console.log('Decoded Metadata:');
            console.log(JSON.stringify(metadata, null, 2));
            
            // Check the image field
            console.log('\n📸 IMAGE ANALYSIS:');
            console.log('─'.repeat(50));
            
            if (metadata.image) {
                if (metadata.image.startsWith('data:image')) {
                    console.log('✅ Image is BASE64 encoded');
                    console.log('✅ Self-contained (no external dependencies)');
                    
                    // Calculate size
                    const sizeKB = Math.round(metadata.image.length * 0.75 / 1024);
                    console.log(`📦 Approximate size: ${sizeKB} KB`);
                    
                    // Show preview
                    this.showImagePreview(metadata.image);
                } else if (metadata.image.includes('ipfs')) {
                    console.log('⚠️ Image points to IPFS');
                    console.log('URL:', metadata.image);
                } else {
                    console.log('❓ Image format:', metadata.image.substring(0, 50) + '...');
                }
            }
            
            // Check other important fields
            console.log('\n📋 METADATA FIELDS:');
            console.log('─'.repeat(50));
            console.log('Name:', metadata.name);
            console.log('Description:', metadata.description);
            console.log('External URL:', metadata.external_url);
            console.log('Attributes:', metadata.attributes?.length || 0, 'attributes');
            
            if (metadata.attributes) {
                metadata.attributes.forEach(attr => {
                    console.log(`  - ${attr.trait_type}: ${attr.value}`);
                });
            }
            
            return metadata;
            
        } catch (error) {
            console.error('❌ Error decoding data URI:', error);
        }
    },
    
    async fetchIPFSMetadata(uri) {
        console.log('🌐 FETCHING FROM IPFS:');
        console.log('─'.repeat(50));
        
        try {
            // Convert IPFS URI to gateway URL
            let gatewayUrl = uri;
            if (uri.startsWith('ipfs://')) {
                const hash = uri.replace('ipfs://', '');
                gatewayUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
            }
            
            console.log('Gateway URL:', gatewayUrl);
            
            const response = await fetch(gatewayUrl);
            const metadata = await response.json();
            
            console.log('Fetched Metadata:');
            console.log(JSON.stringify(metadata, null, 2));
            
            // Check image
            if (metadata.image) {
                console.log('\n📸 Image URL:', metadata.image);
                if (metadata.image.includes('ipfs')) {
                    console.log('⚠️ Image is also on IPFS (double dependency)');
                }
            }
            
            return metadata;
            
        } catch (error) {
            console.error('❌ Error fetching from IPFS:', error);
        }
    },
    
    showImagePreview(imageData) {
        console.log('\n🖼️ SHOWING IMAGE PREVIEW...');
        
        // Remove existing preview
        const existing = document.getElementById('alert27Preview');
        if (existing) existing.remove();
        
        // Create preview modal
        const modal = document.createElement('div');
        modal.id = 'alert27Preview';
        modal.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        background: white; border: 3px solid #00ff88; border-radius: 10px;
                        padding: 20px; z-index: 10000; max-width: 600px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                
                <h3 style="margin: 0 0 15px 0; color: #1a1a2e;">Alert #27 Image Preview</h3>
                
                <img src="${imageData}" style="max-width: 100%; border: 1px solid #ddd;" />
                
                <div style="margin-top: 15px; text-align: center;">
                    <button onclick="document.getElementById('alert27Preview').remove()"
                            style="background: #00ff88; color: #1a1a2e; border: none;
                                   padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        Close Preview
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    async checkBackendStorage() {
        console.log('\n💾 CHECKING BACKEND STORAGE:');
        console.log('─'.repeat(50));
        
        try {
            const response = await fetch('https://nftserviceapp.onrender.com/api/notices/27/images', {
                headers: {
                    'X-Wallet-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
                    'X-Server-Address': window.tronWeb?.defaultAddress?.base58 || 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend has images stored');
                console.log('Alert Image:', data.alertImage ? 'Present' : 'Missing');
                console.log('Document Image:', data.documentImage ? 'Present' : 'Missing');
            } else {
                console.log('❌ Backend returned:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Error checking backend:', error);
        }
    },
    
    async runFullCheck() {
        console.log('🚀 RUNNING FULL CHECK FOR ALERT #27\n');
        
        // Check blockchain
        await this.checkTokenURI();
        
        // Check backend
        await this.checkBackendStorage();
        
        console.log('\n' + '=' .repeat(70));
        console.log('✅ CHECK COMPLETE!');
        console.log('\nSUMMARY:');
        console.log('- If using base64: Alert will display in wallets');
        console.log('- If using IPFS: May have display issues');
        console.log('- Backend storage provides fallback access');
    }
};

// Auto-run check
CheckAlert27.runFullCheck();

// Available commands
console.log('\n📚 AVAILABLE COMMANDS:');
console.log('─'.repeat(50));
console.log('CheckAlert27.checkTokenURI()     - Check blockchain metadata');
console.log('CheckAlert27.checkBackendStorage() - Check backend images');
console.log('CheckAlert27.runFullCheck()      - Run complete analysis');