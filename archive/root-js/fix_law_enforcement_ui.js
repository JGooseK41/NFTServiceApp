const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Update the law enforcement section with better styling
const newLawEnforcementSection = `                        <!-- Law Enforcement Section -->
                        <div id="lawEnforcementSection" class="subsection" style="background: rgba(59, 130, 246, 0.1); padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-shield-alt" style="color: #3b82f6;"></i>
                                <span style="font-weight: 600; color: var(--text-primary);">Law Enforcement Exemption</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Agency Name</label>
                                <input type="text" class="form-input" id="lawEnforcementAgencyName" 
                                       placeholder="e.g., FBI, DEA, Local Police Department"
                                       style="background: rgba(255, 255, 255, 0.05); color: var(--text-primary); border: 1px solid rgba(255, 255, 255, 0.1);">
                            </div>
                            <div class="checkbox-group" style="display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem;">
                                <input type="checkbox" id="lawEnforcementExempt" style="width: 20px; height: 20px; cursor: pointer;">
                                <label for="lawEnforcementExempt" style="color: var(--text-primary); cursor: pointer; font-size: 1rem;">Grant law enforcement fee exemption</label>
                            </div>
                        </div>`;

// Find and replace the law enforcement section
const lawEnforcementPattern = /<div id="lawEnforcementSection"[^>]*>[\s\S]*?<\/div>\s*<\/div>/;
const match = content.match(lawEnforcementPattern);

if (match) {
    content = content.replace(match[0], newLawEnforcementSection);
} else {
    console.log('⚠️  Could not find law enforcement section');
}

// 2. Fix the button placement and sizing
const oldButtonSection = /<div style="display: flex; gap: 0\.5rem;[^"]*">\s*<button class="btn btn-primary" onclick="grantRole\(\)"[^>]*>[\s\S]*?<\/button>\s*<button class="btn btn-secondary" onclick="checkRole\(\)"[^>]*>[\s\S]*?<\/button>\s*<\/div>/;

const newButtonSection = `                        <!-- Action Buttons -->
                        <div style="margin-top: 1.5rem;">
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-start;">
                                <button class="btn btn-primary btn-small" onclick="grantRole()" id="grantRoleBtn" style="padding: 0.5rem 1rem;">
                                    <i class="fas fa-user-plus"></i>
                                    Grant Role
                                </button>
                                <button class="btn btn-secondary btn-small" onclick="checkRole()" id="checkRoleBtn" style="padding: 0.5rem 1rem;">
                                    <i class="fas fa-user-check"></i>
                                    Check Role
                                </button>
                            </div>
                        </div>`;

if (oldButtonSection.test(content)) {
    content = content.replace(oldButtonSection, newButtonSection);
} else {
    // Try alternate pattern
    const altButtonPattern = /<!-- Action Buttons -->[\s\S]*?<\/div>\s*<\/div>/;
    if (altButtonPattern.test(content)) {
        content = content.replace(altButtonPattern, newButtonSection);
    }
}

// 3. Add some CSS for better checkbox styling if not already present
if (!content.includes('/* Enhanced checkbox styling */')) {
    const cssAddition = `
        /* Enhanced checkbox styling */
        #lawEnforcementExempt {
            -webkit-appearance: none;
            appearance: none;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(59, 130, 246, 0.5);
            border-radius: 4px;
            display: inline-block;
            position: relative;
            transition: all 0.2s ease;
        }
        
        #lawEnforcementExempt:checked {
            background: #3b82f6;
            border-color: #3b82f6;
        }
        
        #lawEnforcementExempt:checked::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 14px;
            font-weight: bold;
        }
        
        #lawEnforcementExempt:hover {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }`;
    
    // Add the CSS before the closing </style> tag
    content = content.replace('</style>', cssAddition + '\n    </style>');
}

// Write the fixed content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed law enforcement UI:');
console.log('  - Larger checkbox (20x20px) with custom styling');
console.log('  - Darker background that matches theme');
console.log('  - Smaller buttons placed below the form');
console.log('  - Better visual hierarchy and spacing');