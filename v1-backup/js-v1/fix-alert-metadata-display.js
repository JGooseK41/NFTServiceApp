/**
 * FIX ALERT NFT METADATA DISPLAY
 * 
 * Problem: Alert #13 shows but #19 doesn't
 * Root cause: Inconsistent metadata storage/availability
 * Solution: Ensure all Alert NFTs have accessible metadata
 */

console.log('🔧 Fixing Alert NFT metadata display issues...');

window.AlertMetadataFix = {
    
    // Check and fix metadata for specific Alert NFT
    async fixAlertMetadata(alertId) {
        console.log(`\n📍 Fixing metadata for Alert #${alertId}...`);
        
        try {
            // First check if metadata exists
            const currentURI = await window.legalContract.tokenURI(alertId).call();
            
            if (currentURI) {
                console.log('Current URI:', currentURI.substring(0, 60) + '...');
                
                // Try to fetch it
                let metadataAccessible = false;
                
                if (currentURI.startsWith('ipfs://')) {
                    const hash = currentURI.replace('ipfs://', '');
                    try {
                        const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
                        if (response.ok) {
                            const text = await response.text();
                            if (!text.startsWith('<')) {
                                metadataAccessible = true;
                                console.log('✅ Metadata is accessible');
                            }
                        }
                    } catch (e) {
                        console.log('❌ Metadata not accessible');
                    }
                }
                
                if (!metadataAccessible) {
                    console.log('⚠️ Metadata not accessible, creating fallback...');
                    return await this.createFallbackMetadata(alertId);
                }
            } else {
                console.log('❌ No URI set, creating new metadata...');
                return await this.createFallbackMetadata(alertId);
            }
            
        } catch (error) {
            console.error('Error:', error);
        }
    },
    
    // Create fallback metadata for Alert NFTs
    async createFallbackMetadata(alertId) {
        console.log('Creating fallback metadata...');
        
        // Get notice data if available
        let noticeName = `Legal Alert #${alertId}`;
        let noticeDescription = 'You have received this token as notice of a pending investigation/legal matter concerning this wallet address.';
        
        try {
            const notice = await window.legalContract.alertNotices(alertId).call();
            if (notice && notice.caseNumber) {
                noticeName = `Legal Alert - Case ${notice.caseNumber}`;
            }
        } catch (e) {
            // Use defaults
        }
        
        // Create metadata with hosted image
        const metadata = {
            name: noticeName,
            description: noticeDescription,
            image: "https://nft-legal-service.netlify.app/images/alert-nft-thumbnail.png", // Use a reliable hosted image
            external_url: "https://www.blockserved.com",
            attributes: [
                {
                    trait_type: "Type",
                    value: "Legal Alert"
                },
                {
                    trait_type: "Token ID",
                    value: alertId.toString()
                },
                {
                    trait_type: "Status",
                    value: "Active"
                },
                {
                    trait_type: "Blockchain",
                    value: "TRON"
                }
            ]
        };
        
        // Create data URI (most reliable, no external dependencies)
        const dataURI = 'data:application/json;base64,' + btoa(JSON.stringify(metadata));
        
        console.log('✅ Created data URI metadata');
        console.log('Metadata:', metadata);
        
        // Store for later use
        window.alertMetadataCache = window.alertMetadataCache || {};
        window.alertMetadataCache[alertId] = {
            uri: dataURI,
            metadata: metadata
        };
        
        return dataURI;
    },
    
    // Fix all Alert NFTs that aren't displaying
    async fixAllAlerts() {
        console.log('🔧 Checking and fixing all Alert NFTs...');
        
        try {
            const totalSupply = await window.legalContract.totalSupply().call();
            const total = Number(totalSupply.toString());
            
            const alertsToFix = [];
            
            // Check all Alert NFTs (odd IDs)
            for (let i = 1; i <= total; i += 2) {
                try {
                    const uri = await window.legalContract.tokenURI(i).call();
                    
                    if (!uri) {
                        alertsToFix.push(i);
                        console.log(`Alert #${i}: No URI`);
                    } else {
                        // Check if accessible
                        if (uri.startsWith('ipfs://')) {
                            const hash = uri.replace('ipfs://', '');
                            try {
                                const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
                                const text = await response.text();
                                
                                if (text.startsWith('<')) {
                                    alertsToFix.push(i);
                                    console.log(`Alert #${i}: IPFS not accessible`);
                                } else {
                                    console.log(`Alert #${i}: ✅ OK`);
                                }
                            } catch (e) {
                                alertsToFix.push(i);
                                console.log(`Alert #${i}: Fetch error`);
                            }
                        }
                    }
                } catch (e) {
                    // Token might not exist
                }
            }
            
            if (alertsToFix.length > 0) {
                console.log(`\nNeed to fix: ${alertsToFix.join(', ')}`);
                
                for (const id of alertsToFix) {
                    await this.fixAlertMetadata(id);
                }
            } else {
                console.log('✅ All Alert NFTs have metadata');
            }
            
        } catch (error) {
            console.error('Error:', error);
        }
    },
    
    // Specific fix for #13 and #19
    async fixSpecificAlerts() {
        console.log('Fixing Alert #13 and #19 specifically...');
        
        // Fix #13 (user says it shows, but let's ensure)
        await this.fixAlertMetadata(13);
        
        // Fix #19 (user says it doesn't show)
        await this.fixAlertMetadata(19);
        
        console.log('\n✅ Metadata fixes applied');
        console.log('Note: Contract owner needs to call setTokenURI to apply on-chain');
    }
};

// Hook into the minting process to ensure metadata is always set
(function() {
    if (window.serveNotice) {
        const originalServe = window.serveNotice;
        
        window.serveNotice = async function(noticeData) {
            console.log('📝 Ensuring Alert NFT gets proper metadata...');
            
            // Store pending metadata
            window.pendingAlertMetadata = {
                name: `Legal Alert - ${noticeData.caseNumber || 'Notice'}`,
                description: 'You have received this token as notice of a pending investigation/legal matter concerning this wallet address.',
                image: noticeData.thumbnailUrl || "https://nft-legal-service.netlify.app/images/alert-nft-thumbnail.png",
                caseNumber: noticeData.caseNumber,
                timestamp: Date.now()
            };
            
            // Call original
            const result = await originalServe.call(this, noticeData);
            
            // After minting, ensure metadata is set
            if (result && result.alertId) {
                const uri = await window.legalContract.tokenURI(result.alertId).call();
                
                if (!uri) {
                    console.log('⚠️ Alert NFT minted without metadata, creating fallback...');
                    await window.AlertMetadataFix.fixAlertMetadata(result.alertId);
                }
            }
            
            return result;
        };
    }
})();

// Create a function to ensure metadata during transaction
window.ensureAlertMetadata = async function(alertId) {
    console.log(`Ensuring metadata for Alert #${alertId}...`);
    
    const uri = await window.legalContract.tokenURI(alertId).call();
    
    if (!uri) {
        // Create metadata
        const metadataURI = await window.AlertMetadataFix.createFallbackMetadata(alertId);
        
        console.log('⚠️ IMPORTANT: Metadata created but not set on-chain');
        console.log('To set on-chain, contract owner must call:');
        console.log(`contract.setTokenURI(${alertId}, "${metadataURI}")`);
        
        return metadataURI;
    }
    
    return uri;
};

console.log('✅ Alert metadata fix loaded');
console.log('');
console.log('Commands:');
console.log('  AlertMetadataFix.fixSpecificAlerts()  - Fix #13 and #19');
console.log('  AlertMetadataFix.fixAllAlerts()       - Check and fix all Alerts');
console.log('  AlertMetadataFix.fixAlertMetadata(19) - Fix specific Alert');
console.log('');
console.log('⚠️ Note: These fixes create metadata locally.');
console.log('For permanent fix, contract owner must call setTokenURI on-chain.');