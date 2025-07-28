const fs = require('fs');
const path = require('path');

// Read the index.html
const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Fix the button placement by removing the extra closing div and reorganizing
const brokenStructure = `                            </div>
                        </div>
                        </div>
                                                <!-- Action Buttons -->
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

const fixedStructure = `                            </div>
                        </div>
                        
                        <!-- Action Buttons -->
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

// Replace the broken structure
content = content.replace(brokenStructure, fixedStructure);

// Write the fixed content
fs.writeFileSync(indexPath, content);

console.log('✅ Fixed button placement - removed extra closing div');