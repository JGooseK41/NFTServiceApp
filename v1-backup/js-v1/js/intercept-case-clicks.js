/**
 * Intercept ALL Case Clicks
 * This will capture any click on case elements and show the modal
 */

console.log('🎯 Installing case click interceptor...');

// Make sure viewCaseDetails is available
window.viewCaseDetails = window.viewCaseDetails || function(caseId) {
    console.log(`📂 Opening case modal for: ${caseId}`);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'case-details-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        width: 90%;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        border-radius: 10px;
        padding: 20px;
    `;
    
    content.innerHTML = `
        <h2>Case #${caseId}</h2>
        <button onclick="this.closest('.case-details-modal').remove()" style="float: right; font-size: 24px; background: none; border: none; cursor: pointer;">&times;</button>
        <div id="caseContent">Loading...</div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Load data
    const apiUrl = 'https://nftserviceapp.onrender.com';
    const serverAddress = window.tronWeb?.defaultAddress?.base58 || localStorage.getItem('walletAddress') || '';
    
    fetch(`${apiUrl}/api/cases/${caseId}`, {
        headers: { 'X-Server-Address': serverAddress }
    })
    .then(r => r.json())
    .then(data => {
        document.getElementById('caseContent').innerHTML = `
            <p><strong>Status:</strong> ${data.status || 'Unknown'}</p>
            <p><strong>Created:</strong> ${data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A'}</p>
            <p><strong>Documents:</strong> ${data.document_count || 0}</p>
            ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
        `;
    })
    .catch(err => {
        document.getElementById('caseContent').innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
    });
    
    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
};

// Intercept ALL clicks on the document
document.addEventListener('click', function(e) {
    // Check if we clicked on a case element or its children
    let target = e.target;
    let caseElement = null;
    
    // Walk up the DOM tree to find a case element
    while (target && target !== document.body) {
        // Check various case element patterns
        if (target.classList && (
            target.classList.contains('case-item') ||
            target.classList.contains('case-item-enhanced') ||
            target.classList.contains('case-header') ||
            target.classList.contains('activity-item')
        )) {
            caseElement = target;
            break;
        }
        
        // Also check data attributes
        if (target.getAttribute && target.getAttribute('data-case-id')) {
            caseElement = target;
            break;
        }
        
        // Check if it contains case number text
        if (target.textContent && target.textContent.includes('Case #')) {
            caseElement = target;
            break;
        }
        
        target = target.parentElement;
    }
    
    // If we found a case element, extract the case ID and show modal
    if (caseElement) {
        // Don't trigger on buttons
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        
        let caseId = null;
        
        // Try to get case ID from various sources
        // 1. From data attribute
        caseId = caseElement.getAttribute('data-case-id');
        
        // 2. From text content
        if (!caseId) {
            const text = caseElement.textContent;
            const match = text.match(/Case #(\S+)/);
            if (match) {
                caseId = match[1];
            }
        }
        
        // 3. From onclick attribute
        if (!caseId) {
            const onclick = caseElement.getAttribute('onclick');
            if (onclick) {
                const match = onclick.match(/['"]([^'"]+)['"]/);
                if (match) {
                    caseId = match[1];
                }
            }
        }
        
        // If we found a case ID, show the modal
        if (caseId) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Intercepted case click:', caseId);
            window.viewCaseDetails(caseId);
        }
    }
}, true); // Use capture phase to intercept before other handlers

// Also monitor for dynamically added cases
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
                // Check if it's a case element
                if (node.classList && (
                    node.classList.contains('case-item') ||
                    node.classList.contains('case-item-enhanced') ||
                    node.classList.contains('activity-item')
                )) {
                    console.log('New case element detected:', node);
                    
                    // Extract case ID
                    const text = node.textContent;
                    const match = text.match(/Case #(\S+)/);
                    if (match) {
                        const caseId = match[1];
                        
                        // Add data attribute for easier identification
                        node.setAttribute('data-case-id', caseId);
                        node.style.cursor = 'pointer';
                    }
                }
            }
        });
    });
});

// Start observing the document
observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('✅ Case click interceptor installed!');
console.log('   - Clicks on any case element will open modal');
console.log('   - Works with dynamically added cases');
console.log('   - Test: Click any case in Case Management or Activity tabs');