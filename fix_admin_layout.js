const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Fix the adminContent div to have proper grid layout
content = content.replace(
    '<div id="adminContent" style="display: none;">',
    '<div id="adminContent" style="display: none;">\n                <div class="admin-controls">'
);

// 2. Find where admin-controls ends and close it properly
// First, let's find the end of the admin tab
const adminTabEnd = content.indexOf('<!-- Help Tab -->');
const beforeHelpTab = content.substring(0, adminTabEnd);
const afterHelpTab = content.substring(adminTabEnd);

// Add closing div for admin-controls before the end of adminContent
const fixedBeforeHelp = beforeHelpTab.replace(
    '                    </div>\n                </div>\n            </div>\n        </div>',
    '                    </div>\n                </div>\n                </div> <!-- End admin-controls -->\n            </div>\n        </div>'
);

content = fixedBeforeHelp + afterHelpTab;

// 3. Fix the law enforcement section styling
const lawEnforcementFix = `                        <!-- Law Enforcement Section -->
                        <div id="lawEnforcementSection" class="subsection" style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-shield-alt" style="color: #3b82f6;"></i>
                                <span style="font-weight: 600;">Law Enforcement Exemption</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Agency Name</label>
                                <input type="text" class="form-input" id="lawEnforcementAgencyName" 
                                       placeholder="e.g., FBI, DEA, Local Police Department"
                                       style="background: white;">
                            </div>
                            <div class="checkbox-group">
                                <input type="checkbox" id="lawEnforcementExempt">
                                <label for="lawEnforcementExempt" style="color: var(--text-primary);">Grant law enforcement fee exemption</label>
                            </div>
                        </div>
                        
                        <!-- Action Buttons -->
                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                            <button class="btn btn-primary" onclick="grantRole()" id="grantRoleBtn">
                                <i class="fas fa-user-plus"></i>
                                Grant Role
                            </button>
                            <button class="btn btn-secondary" onclick="checkRole()" id="checkRoleBtn">
                                <i class="fas fa-user-check"></i>
                                Check Role
                            </button>
                        </div>`;

// Find and replace the broken law enforcement section
const lawEnforcementPattern = /<div id="lawEnforcementSection"[\s\S]*?<button class="btn btn-secondary" onclick="checkRole\(\)"[^>]*>[\s\S]*?<\/button>/;

if (lawEnforcementPattern.test(content)) {
    content = content.replace(lawEnforcementPattern, lawEnforcementFix);
} else {
    console.log('⚠️  Could not find law enforcement section to fix');
}

// 4. Move pending and all registrations outside of admin-controls grid
const pendingRegistrationsPattern = /<!-- Pending Registrations -->[\s\S]*?<!-- All Registrations Viewer -->[\s\S]*?<\/div>\s*<\/div>/;
const match = content.match(pendingRegistrationsPattern);

if (match) {
    const registrationCards = match[0];
    
    // Remove from current location
    content = content.replace(registrationCards, '');
    
    // Add after adminContent opening but before admin-controls
    content = content.replace(
        '<div id="adminContent" style="display: none;">\n                <div class="admin-controls">',
        `<div id="adminContent" style="display: none;">
                ${registrationCards}
                
                <div class="admin-controls">`
    );
}

// Write the fixed content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed admin panel layout:');
console.log('  - Added proper grid layout for admin-controls');
console.log('  - Fixed law enforcement section styling');
console.log('  - Fixed button placement');
console.log('  - Moved registration cards outside of grid');