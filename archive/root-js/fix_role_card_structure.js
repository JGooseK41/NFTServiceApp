const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Fix the role management card structure
// The issue is the extra </div> after law enforcement section that's closing the card early

// Find and fix the problematic structure
const problematicStructure = `                            </div>
                        </div>
                        </div>
                                                <!-- Action Buttons -->
                        <div style="margin-top: 1.5rem;">`;

const fixedStructure = `                            </div>
                        </div>
                        
                        <!-- Action Buttons -->
                        <div style="margin-top: 1.5rem;">`;

content = content.replace(problematicStructure, fixedStructure);

// Also clean up any extra whitespace before comments
content = content.replace(/\s+<!-- Law Enforcement Section -->/g, '\n                        <!-- Law Enforcement Section -->');
content = content.replace(/\s+<!-- Action Buttons -->/g, '\n                        <!-- Action Buttons -->');

// Write the fixed content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed role card structure:');
console.log('  - Removed extra closing div that was breaking the layout');
console.log('  - Buttons now properly inside the role management card');
console.log('  - Cleaned up extra whitespace');