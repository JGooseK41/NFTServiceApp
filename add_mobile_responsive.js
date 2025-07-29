const fs = require('fs');
const path = require('path');

console.log('📱 Adding Mobile Responsive Design...\n');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf8');

// Add mobile viewport meta tag
const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">';
if (\!content.includes('viewport')) {
    content = content.replace('<head>', '<head>\n    ' + viewportMeta);
}

// Add responsive CSS
const responsiveCSS = `
        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
            body {
                padding: 0;
                margin: 0;
            }
            
            .container {
                padding: 0.5rem;
                margin: 0;
                max-width: 100%;
            }
            
            .header {
                padding: 1rem 0.5rem;
                flex-direction: column;
                gap: 1rem;
            }
            
            .header-content {
                flex-direction: column;
                align-items: center;
                gap: 1rem;
                width: 100%;
            }
            
            .header-controls {
                width: 100%;
                justify-content: center;
            }
            
            .chain-selector {
                width: 100%;
            }
            
            .chain-dropdown {
                width: 100%;
                font-size: 0.9rem;
            }
            
            .tabs {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                padding: 0 0.5rem;
            }
            
            .tab-buttons {
                min-width: max-content;
                gap: 0.25rem;
            }
            
            .tab-button {
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
                white-space: nowrap;
            }
            
            .card {
                margin: 0.5rem 0;
                border-radius: 12px;
            }
            
            .card-header {
                padding: 1rem;
                font-size: 1.1rem;
            }
            
            .card-header h2 {
                font-size: 1.1rem;
            }
            
            .form-group {
                margin-bottom: 1rem;
            }
            
            .form-label {
                font-size: 0.875rem;
            }
            
            .form-input, .form-select, textarea {
                font-size: 16px; /* Prevents zoom on iOS */
                padding: 0.75rem;
            }
            
            .btn {
                padding: 0.75rem 1.5rem;
                font-size: 0.875rem;
                width: 100%;
                margin-bottom: 0.5rem;
            }
            
            .btn-small {
                padding: 0.5rem 1rem;
                font-size: 0.8rem;
            }
            
            .modal-content {
                width: 95%;
                max-width: 95%;
                margin: 1rem;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .modal-body {
                padding: 1rem;
            }
            
            .info-grid, .wallet-info-grid {
                grid-template-columns: 1fr;
                gap: 0.75rem;
            }
            
            .stats-card {
                min-width: 100%;
            }
            
            .notification {
                right: 0.5rem;
                left: 0.5rem;
                max-width: none;
            }
            
            .document-upload-area {
                padding: 2rem 1rem;
            }
            
            .address-input-group {
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .address-input-group input {
                width: 100%;
            }
            
            .address-input-group button {
                width: 100%;
            }
            
            .fee-display-card {
                font-size: 0.875rem;
            }
            
            .token-detail {
                flex-direction: column;
                gap: 0.25rem;
                font-size: 0.875rem;
            }
            
            .receipt-container {
                padding: 1rem;
            }
            
            .faq-item {
                margin-bottom: 0.75rem;
            }
            
            .faq-header {
                padding: 0.75rem;
                font-size: 0.9rem;
            }
            
            /* Mobile-specific utility classes */
            .mobile-only {
                display: block \!important;
            }
            
            .desktop-only {
                display: none \!important;
            }
            
            /* Fix overlapping elements */
            .loading-overlay {
                z-index: 9999;
            }
            
            /* Improve touch targets */
            .clickable, button, a, .btn {
                min-height: 44px;
                min-width: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            /* Fix tables on mobile */
            table {
                display: block;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            /* Wallet address display */
            .wallet-address {
                font-size: 0.75rem;
                word-break: break-all;
            }
            
            /* Energy rental modal */
            .energy-modal-content {
                padding: 1rem;
            }
            
            .energy-option {
                padding: 0.75rem;
                margin-bottom: 0.5rem;
            }
        }
        
        /* Tablet styles */
        @media (min-width: 769px) and (max-width: 1024px) {
            .container {
                max-width: 100%;
                padding: 1rem;
            }
            
            .info-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .btn {
                width: auto;
            }
        }
        
        /* Utility classes for responsive design */
        .mobile-only {
            display: none;
        }
        
        @media (max-width: 768px) {
            .mobile-only {
                display: block;
            }
            .desktop-only {
                display: none;
            }
        }
    </style>`;

// Insert responsive CSS before closing style tag
const styleEndIndex = content.lastIndexOf('</style>');
if (styleEndIndex > 0) {
    content = content.slice(0, styleEndIndex) + responsiveCSS + '\n    ' + content.slice(styleEndIndex);
}

// Save the updated file
fs.writeFileSync(indexPath, content);

console.log('✅ Mobile Responsive Design Added\!');

