# Energy & Bandwidth Rental Solution

## Current Status
The simplified contract does NOT have built-in energy/bandwidth rental. The frontend has partial implementation that needs completion.

## Options for Seamless Energy Management

### Option 1: Frontend-Based Energy Rental (Recommended)
Complete the existing frontend implementation to automatically rent energy before transactions.

**Implementation:**
```javascript
// Complete energy rental configuration
const ENERGY_RENTAL_CONFIG = {
    // JustLend Energy Rental API
    apiUrl: 'https://api.justlend.org/v2/energy/rent',
    energyPerNotice: 500000,  // Energy needed per notice
    energyBuffer: 1.2,        // 20% buffer
    maxPricePerUnit: 15,      // Max 15 TRX per 100k energy
    rentalDuration: 1,        // 1 hour rental
    minEnergyThreshold: 50000 // Minimum to trigger rental
};

// Automatic energy rental function
async function rentEnergyIfNeeded(requiredEnergy) {
    const energyNeeded = await checkEnergyNeeded(requiredEnergy);
    
    if (energyNeeded <= ENERGY_RENTAL_CONFIG.minEnergyThreshold) {
        return { success: true, rented: false, cost: 0 };
    }
    
    // Use JustLend or TRONSave API
    const rentalResponse = await fetch(ENERGY_RENTAL_CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            receivingAddress: tronWeb.defaultAddress.base58,
            energyAmount: energyNeeded * ENERGY_RENTAL_CONFIG.energyBuffer,
            duration: ENERGY_RENTAL_CONFIG.rentalDuration,
            maxPrice: ENERGY_RENTAL_CONFIG.maxPricePerUnit
        })
    });
    
    if (rentalResponse.ok) {
        const result = await rentalResponse.json();
        return {
            success: true,
            rented: true,
            cost: result.totalCost,
            txId: result.transactionId
        };
    }
    
    return { success: false, error: 'Energy rental failed' };
}
```

### Option 2: Contract-Based Energy Pool
Add energy management to the contract itself.

**New Contract Functions:**
```solidity
contract LegalNoticeNFT_Simplified {
    // Energy pool management
    mapping(address => uint256) public energyDeposits;
    uint256 public totalEnergyPool;
    uint256 public energyPricePerUnit = 15e6; // 15 TRX per 100k energy
    
    // Deposit TRX for energy rental
    function depositForEnergy() external payable {
        energyDeposits[msg.sender] += msg.value;
        totalEnergyPool += msg.value;
    }
    
    // Withdraw unused energy funds
    function withdrawEnergyDeposit(uint256 amount) external {
        require(energyDeposits[msg.sender] >= amount, "Insufficient deposit");
        energyDeposits[msg.sender] -= amount;
        totalEnergyPool -= amount;
        payable(msg.sender).transfer(amount);
    }
    
    // Internal: Deduct energy cost from user's deposit
    function _deductEnergyCost(address user, uint256 energyUsed) internal {
        uint256 cost = (energyUsed * energyPricePerUnit) / 100000;
        if (energyDeposits[user] >= cost) {
            energyDeposits[user] -= cost;
            totalEnergyPool -= cost;
        }
    }
}
```

### Option 3: Hybrid Approach (Best UX)
Combine frontend detection with optional pre-funding.

**Features:**
1. Check user's energy before transaction
2. If insufficient:
   - Option A: Auto-rent via API (pay per use)
   - Option B: Use pre-funded energy pool
   - Option C: Prompt user to stake TRX
3. Track energy usage for optimization

**Implementation Flow:**
```javascript
async function handleEnergyRequirement(requiredEnergy) {
    // 1. Check current energy
    const currentEnergy = await checkUserEnergy();
    
    if (currentEnergy >= requiredEnergy) {
        return { method: 'owned', cost: 0 };
    }
    
    // 2. Check if user has energy deposit in contract
    const energyDeposit = await contract.energyDeposits(userAddress);
    if (energyDeposit > 0) {
        return { method: 'prepaid', cost: 0 };
    }
    
    // 3. Show options to user
    const userChoice = await showEnergyOptions({
        instant: `Rent ${requiredEnergy} energy for ~${estimateCost(requiredEnergy)} TRX`,
        prepay: 'Deposit TRX for future energy needs',
        stake: 'Stake TRX for permanent energy'
    });
    
    switch(userChoice) {
        case 'instant':
            return await rentEnergyInstant(requiredEnergy);
        case 'prepay':
            return await depositForFutureEnergy();
        case 'stake':
            return await guideUserToStake();
    }
}
```

## Recommended Implementation

### Phase 1: Complete Frontend Energy Rental
1. Fix the incomplete `rentEnergyIfNeeded` function
2. Integrate with JustLend or TRONSave API
3. Add energy cost to fee display
4. Show clear messaging about energy rental

### Phase 2: Add Energy Metrics
1. Track actual energy usage per transaction type
2. Optimize `ENERGY_RENTAL_CONFIG` values
3. Show users their energy efficiency

### Phase 3: Optional Contract Enhancement
1. Add energy deposit system for frequent users
2. Bulk energy purchasing for better rates
3. Energy sharing between users

## Cost Breakdown Example

**Regular User Creating Document Notice:**
- Service Fee: 150 TRX
- Sponsorship: 2 TRX  
- Energy Rental: ~30 TRX (for 500k energy)
- **Total: ~182 TRX**

**Process Server (High Volume):**
- Creation Fee: 75 TRX
- Sponsorship: 2 TRX
- Energy: Consider staking 10,000 TRX for permanent energy
- **Per Notice: 77 TRX (no energy cost)**

**Law Enforcement:**
- Fees: 0 TRX (waived)
- Sponsorship: 2 TRX
- Energy: Must provide own (stake or rent)
- **Per Notice: 2 TRX + energy**

## Quick Frontend Fix

To make energy rental work immediately, update the `rentEnergyIfNeeded` function:

```javascript
async function rentEnergyIfNeeded(requiredEnergy) {
    try {
        const energyNeeded = await checkEnergyNeeded(requiredEnergy);
        
        if (energyNeeded <= ENERGY_RENTAL_CONFIG.minEnergyThreshold) {
            return { success: true, rented: false, cost: 0 };
        }
        
        // For now, just inform user and continue
        // In production, integrate with energy rental API
        const estimatedCost = Math.ceil(energyNeeded / 100000) * 15;
        
        const userConfirmed = confirm(
            `This transaction requires ${energyNeeded.toLocaleString()} energy.\n` +
            `Estimated cost: ${estimatedCost} TRX\n\n` +
            `Continue anyway? (Transaction may fail without energy)`
        );
        
        if (!userConfirmed) {
            return { success: false, error: 'User cancelled due to energy requirement' };
        }
        
        return { 
            success: true, 
            rented: false, 
            cost: 0,
            warning: 'Proceeding without energy rental - transaction may fail'
        };
        
    } catch (error) {
        console.error('Energy check failed:', error);
        return { success: true, rented: false, cost: 0 };
    }
}
```

This provides immediate functionality while you implement full energy rental integration.