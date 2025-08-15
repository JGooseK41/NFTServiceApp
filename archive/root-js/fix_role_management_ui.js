const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Find the broken section and fix it
const brokenSection = `                        </div>
                                                                                <div id="lawEnforcementSection" class="subsection" style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <i class="fas fa-shield-alt" style="color: #3b82f6;"></i>
                                    <span style="font-weight: 600;">Law Enforcement Exemption</span>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Agency Name</label>
                                    <input type="text" class="form-input" id="lawEnforcementAgencyName" 
                                           placeholder="e.g., FBI, DEA, Local Police Department">
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="lawEnforcementExempt">
                                    <label for="lawEnforcementExempt">Grant law enforcement fee exemption</label>
                                </div>
                            </div>
                        </div>`;

const fixedSection = `                        </div>
                        
                        <!-- Law Enforcement Section -->
                        <div id="lawEnforcementSection" class="subsection" style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-shield-alt" style="color: #3b82f6;"></i>
                                <span style="font-weight: 600;">Law Enforcement Exemption</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Agency Name</label>
                                <input type="text" class="form-input" id="lawEnforcementAgencyName" 
                                       placeholder="e.g., FBI, DEA, Local Police Department">
                            </div>
                            <div class="checkbox-group">
                                <input type="checkbox" id="lawEnforcementExempt">
                                <label for="lawEnforcementExempt">Grant law enforcement fee exemption</label>
                            </div>
                        </div>`;

// Replace the broken section
content = content.replace(brokenSection, fixedSection);

// Write the fixed content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed role management UI structure');

// Also verify the structure is correct by checking for proper div closures
const roleManagementStart = content.indexOf('<!-- Role Management -->');
const roleManagementEnd = content.indexOf('<!-- Fee Structure Management -->');

if (roleManagementStart !== -1 && roleManagementEnd !== -1) {
    const roleSection = content.substring(roleManagementStart, roleManagementEnd);
    const openDivs = (roleSection.match(/<div/g) || []).length;
    const closeDivs = (roleSection.match(/<\/div>/g) || []).length;
    
    console.log(`\n📊 Div balance check in Role Management section:`);
    console.log(`   Opening divs: ${openDivs}`);
    console.log(`   Closing divs: ${closeDivs}`);
    
    if (openDivs === closeDivs) {
        console.log('   ✅ Structure is balanced');
    } else {
        console.log(`   ⚠️  Structure imbalance: ${openDivs - closeDivs} unclosed divs`);
    }
}