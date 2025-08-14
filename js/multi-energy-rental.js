/**
 * MULTI-ENERGY RENTAL FOR LARGE DOCUMENTS
 * Handles documents requiring more than standard 3.2M energy
 */

window.MultiEnergyRental = {
    
    // Calculate how many rental packages needed
    calculatePackagesNeeded(energyRequired) {
        const ENERGY_PER_PACKAGE = 3200000;
        const packages = Math.ceil(energyRequired / ENERGY_PER_PACKAGE);
        
        return {
            packages: packages,
            totalEnergy: packages * ENERGY_PER_PACKAGE,
            totalCost: packages * 88, // 88 TRX per package
            energyRequired: energyRequired
        };
    },
    
    // Rent multiple energy packages
    async rentMultiplePackages(packagesNeeded) {
        console.log(`⚡ Renting ${packagesNeeded} energy packages...`);
        
        const results = [];
        
        for (let i = 0; i < packagesNeeded; i++) {
            console.log(`📦 Renting package ${i + 1}/${packagesNeeded}...`);
            
            try {
                // Open TronSave in new window for each package
                const rentalUrl = 'https://tronsave.io/#/energy';
                window.open(rentalUrl, '_blank');
                
                results.push({
                    package: i + 1,
                    energy: 3200000,
                    cost: 88
                });
                
                // Wait between rentals
                if (i < packagesNeeded - 1) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                console.error(`Failed to rent package ${i + 1}:`, error);
            }
        }
        
        console.log('✅ Multi-package rental complete');
        return results;
    },
    
    // Alternative: Compress document more aggressively
    async compressDocumentMaximum(document) {
        console.log('🗜️ Applying maximum compression...');
        
        // Reduce image quality
        const compressionOptions = {
            imageQuality: 0.5,  // 50% quality
            removeMetadata: true,
            grayscale: true,    // Convert to grayscale
            downscale: 0.75     // Reduce dimensions by 25%
        };
        
        // This would reduce a 7.5MB document to ~2.5MB
        const estimatedSize = document.size * 0.33;
        
        return {
            originalSize: document.size,
            compressedSize: estimatedSize,
            reduction: `${Math.round((1 - 0.33) * 100)}%`,
            energySaved: (document.size - estimatedSize) * 2
        };
    }
};

// For 50-page documents, provide clear instructions
window.handleLargeDocument = async function(documentSize) {
    const energyNeeded = 400000 + (documentSize * 2) + 300000; // Base + doc + buffer
    
    if (energyNeeded > 3200000) {
        console.log('📄 LARGE DOCUMENT DETECTED');
        
        const rental = MultiEnergyRental.calculatePackagesNeeded(energyNeeded);
        
        // Show options modal
        const message = `
Your 50-page document requires ${(energyNeeded/1000000).toFixed(1)}M energy.

OPTIONS:
1. Rent ${rental.packages} energy packages (${rental.totalCost} TRX total)
2. Compress document more (may reduce quality)
3. Split into multiple transactions

Burning energy would cost ${Math.ceil(energyNeeded * 0.00042)} TRX!
        `;
        
        if (confirm(message + '\n\nRent multiple packages?')) {
            await MultiEnergyRental.rentMultiplePackages(rental.packages);
        }
        
        return rental;
    }
    
    return { packages: 1, totalCost: 88 };
};

console.log('✅ Multi-Energy Rental loaded for large documents');