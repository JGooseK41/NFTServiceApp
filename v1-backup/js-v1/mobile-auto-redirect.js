/**
 * Mobile Auto-Redirect System
 * Automatically redirects mobile users to the mobile-optimized interface
 */

window.MobileAutoRedirect = {
    
    // Configuration
    MOBILE_URL: 'blockserved-mobile.html',
    DESKTOP_URL: 'index.html',
    REDIRECT_KEY: 'mobile_redirect_preference',
    BYPASS_PARAM: 'desktop',
    
    /**
     * Check if user is on a mobile device
     */
    isMobileDevice() {
        // Check multiple indicators for mobile
        const indicators = {
            // Check user agent
            userAgent: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            
            // Check screen size
            screenSize: window.innerWidth <= 768,
            
            // Check touch capability
            touchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            
            // Check orientation (mobile devices have this)
            hasOrientation: typeof window.orientation !== 'undefined',
            
            // Check for mobile-specific features
            mobileVendor: /Android|iPhone|iPad|iPod/i.test(navigator.vendor || ''),
            
            // Check platform
            mobilePlatform: /Android|iPhone|iPad|iPod/i.test(navigator.platform || '')
        };
        
        // Count how many indicators suggest mobile
        const mobileScore = Object.values(indicators).filter(Boolean).length;
        
        // Log detection details for debugging
        console.log('📱 Mobile Detection:', {
            indicators: indicators,
            score: mobileScore + '/6',
            isMobile: mobileScore >= 2
        });
        
        // If 2 or more indicators suggest mobile, treat as mobile
        return mobileScore >= 2;
    },
    
    /**
     * Check if user explicitly requested desktop version
     */
    shouldBypassRedirect() {
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get(this.BYPASS_PARAM) === 'true') {
            // Save preference
            localStorage.setItem(this.REDIRECT_KEY, 'desktop');
            return true;
        }
        
        // Check saved preference
        const preference = localStorage.getItem(this.REDIRECT_KEY);
        if (preference === 'desktop') {
            return true;
        }
        
        return false;
    },
    
    /**
     * Perform the redirect to mobile interface
     */
    redirectToMobile() {
        // Preserve any existing URL parameters
        const currentParams = window.location.search;
        const currentHash = window.location.hash;
        
        // Build mobile URL
        let mobileUrl = this.MOBILE_URL;
        
        // Add parameters if they exist
        if (currentParams) {
            mobileUrl += currentParams;
        }
        
        // Add hash if it exists (for deep linking)
        if (currentHash) {
            mobileUrl += currentHash;
        }
        
        console.log('📱 Redirecting to mobile interface:', mobileUrl);
        
        // Perform redirect
        window.location.replace(mobileUrl);
    },
    
    /**
     * Add a banner for mobile users to switch versions
     */
    addMobileBanner() {
        const banner = document.createElement('div');
        banner.id = 'mobile-redirect-banner';
        banner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.2);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        banner.innerHTML = `
            <span style="flex: 1;">📱 Mobile version available for better experience</span>
            <button onclick="MobileAutoRedirect.switchToMobile()" style="
                background: white;
                color: #667eea;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                cursor: pointer;
            ">Switch to Mobile</button>
            <button onclick="MobileAutoRedirect.dismissBanner()" style="
                background: transparent;
                color: white;
                border: 1px solid white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                cursor: pointer;
            ">Stay on Desktop</button>
        `;
        
        document.body.appendChild(banner);
    },
    
    /**
     * Switch to mobile version
     */
    switchToMobile() {
        localStorage.removeItem(this.REDIRECT_KEY);
        window.location.href = this.MOBILE_URL;
    },
    
    /**
     * Dismiss the mobile banner
     */
    dismissBanner() {
        const banner = document.getElementById('mobile-redirect-banner');
        if (banner) {
            banner.style.display = 'none';
            // Remember choice for this session
            sessionStorage.setItem('mobile_banner_dismissed', 'true');
        }
    },
    
    /**
     * Check if on mobile interface and provide desktop option
     */
    addDesktopOption() {
        // Only run this on the mobile interface
        if (!window.location.pathname.includes('blockserved-mobile')) {
            return;
        }
        
        // Add a small "View Desktop Version" link
        const desktopLink = document.createElement('div');
        desktopLink.style.cssText = `
            text-align: center;
            padding: 10px;
            background: #f0f0f0;
            font-size: 12px;
        `;
        
        desktopLink.innerHTML = `
            <a href="${this.DESKTOP_URL}?desktop=true" style="
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            ">
                <i class="fas fa-desktop"></i> View Desktop Version
            </a>
        `;
        
        // Add to bottom of page
        document.body.appendChild(desktopLink);
    },
    
    /**
     * Initialize the auto-redirect system
     */
    init() {
        // Don't run on localhost during development (optional)
        const isDevelopment = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1';
        
        if (isDevelopment) {
            console.log('📱 Mobile redirect disabled in development');
            return;
        }
        
        // Check if we're on the desktop version
        const isDesktopVersion = !window.location.pathname.includes('blockserved-mobile');
        
        if (isDesktopVersion) {
            // Check if mobile device
            if (this.isMobileDevice()) {
                // Check if should bypass
                if (!this.shouldBypassRedirect()) {
                    // Check if banner was already dismissed this session
                    const bannerDismissed = sessionStorage.getItem('mobile_banner_dismissed');
                    
                    if (!bannerDismissed) {
                        // Option 1: Auto-redirect immediately
                        // this.redirectToMobile();
                        
                        // Option 2: Show banner to let user choose
                        this.addMobileBanner();
                    }
                }
            }
        } else {
            // We're on mobile version, add desktop option
            this.addDesktopOption();
        }
    },
    
    /**
     * Force redirect to mobile (can be called manually)
     */
    forceRedirectToMobile() {
        localStorage.removeItem(this.REDIRECT_KEY);
        this.redirectToMobile();
    },
    
    /**
     * Get redirect statistics
     */
    getStats() {
        return {
            isMobile: this.isMobileDevice(),
            preference: localStorage.getItem(this.REDIRECT_KEY),
            currentPage: window.location.pathname,
            shouldRedirect: this.isMobileDevice() && !this.shouldBypassRedirect()
        };
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        MobileAutoRedirect.init();
    });
} else {
    // DOM already loaded
    MobileAutoRedirect.init();
}

// Make it globally available for debugging
window.MobileAutoRedirect = MobileAutoRedirect;

console.log('✅ Mobile Auto-Redirect System loaded');
console.log('📱 Mobile detection:', MobileAutoRedirect.isMobileDevice() ? 'Yes' : 'No');