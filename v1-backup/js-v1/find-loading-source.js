/**
 * DIAGNOSTIC: Find what's creating the loading screen
 */

console.log('🔍 DIAGNOSTIC: Searching for loading screen source...');

// Override createElement to log when elements are created
const originalCreateElement = document.createElement;
document.createElement = function(tagName) {
    const element = originalCreateElement.call(document, tagName);
    
    // Override innerHTML setter to catch when loading text is added
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(element, 'innerHTML', {
        set: function(value) {
            if (value && typeof value === 'string') {
                if (value.includes('Please wait for blockchain confirmation') ||
                    value.includes('Processing Transaction') ||
                    value.includes('transaction-loading')) {
                    console.error('🚨 FOUND LOADING SCREEN SOURCE!');
                    console.error('Element type:', tagName);
                    console.error('Content being set:', value.substring(0, 200));
                    console.trace('Stack trace:');
                }
            }
            originalInnerHTML.set.call(this, value);
        },
        get: originalInnerHTML.get
    });
    
    return element;
};

// Monitor DOM mutations
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
                const text = node.textContent || '';
                if (text.includes('Please wait for blockchain confirmation') ||
                    text.includes('Processing Transaction')) {
                    console.error('🚨 LOADING SCREEN ADDED TO DOM!');
                    console.error('Element:', node);
                    console.error('Parent:', node.parentElement);
                    console.trace('Stack trace:');
                }
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('✅ Diagnostic script loaded - will log when loading screen is created');