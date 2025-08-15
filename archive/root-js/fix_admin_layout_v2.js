const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. First, fix the law enforcement section that's causing issues
// Find the serverRegistrationForm closing div and law enforcement section
const brokenSection = `                        </div>
                                                                                <div id="lawEnforcementSection"`;

const fixedSection = `                        </div>
                        
                        <!-- Law Enforcement Section -->
                        <div id="lawEnforcementSection"`;

content = content.replace(brokenSection, fixedSection);

// 2. Fix the buttons that are misplaced
// Find the current button section
const currentButtons = `                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-primary" onclick="grantRole()" id="grantRoleBtn">
                                <i class="fas fa-user-plus"></i>
                                Grant Role
                            </button>`;

// Check if buttons need to be moved
if (!content.includes('<!-- Action Buttons -->')) {
    // Find where the law enforcement section ends
    const lawEnforcementEnd = '</div>\n                        </div>\n                        <div style="display: flex; gap: 0.5rem;">';
    
    if (content.includes(lawEnforcementEnd)) {
        content = content.replace(
            lawEnforcementEnd,
            '</div>\n                        </div>\n                        \n                        <!-- Action Buttons -->\n                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">'
        );
    }
}

// 3. Fix the law enforcement section styling to ensure readability
content = content.replace(
    'id="lawEnforcementAgencyName" \n                                           placeholder="e.g., FBI, DEA, Local Police Department">',
    'id="lawEnforcementAgencyName" \n                                           placeholder="e.g., FBI, DEA, Local Police Department"\n                                           style="background: white; color: #1a1a1a;">'
);

content = content.replace(
    '<label for="lawEnforcementExempt">Grant law enforcement fee exemption</label>',
    '<label for="lawEnforcementExempt" style="color: #1a1a1a;">Grant law enforcement fee exemption</label>'
);

// 4. Ensure the admin-controls div is properly closed
// Count divs in the admin section
const adminStart = content.indexOf('<div id="adminContent"');
const adminEnd = content.indexOf('<!-- Help Tab -->');
const adminSection = content.substring(adminStart, adminEnd);

// Check if admin-controls is properly structured
if (!adminSection.includes('</div> <!-- End admin-controls -->')) {
    // Find the last card in admin-controls
    const lastCardEnd = adminSection.lastIndexOf('</div>\n                    </div>');
    if (lastCardEnd > 0) {
        const beforeLastCard = content.substring(0, adminStart + lastCardEnd + 36); // +36 for the string length
        const afterLastCard = content.substring(adminStart + lastCardEnd + 36);
        content = beforeLastCard + '\n                </div> <!-- End admin-controls -->' + afterLastCard;
    }
}

// Write the fixed content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed admin panel layout (v2):');
console.log('  - Fixed law enforcement section structure');
console.log('  - Fixed input styling for readability');
console.log('  - Fixed button placement');
console.log('  - Ensured proper div structure');