/**
 * Enhanced Device and Connection Tracking
 * Captures comprehensive metadata for audit logging
 */

class DeviceTracker {
    constructor() {
        this.deviceInfo = {};
        this.collectDeviceInfo();
    }

    /**
     * Collect comprehensive device information
     */
    collectDeviceInfo() {
        // Basic browser info
        this.deviceInfo.userAgent = navigator.userAgent;
        this.deviceInfo.platform = navigator.platform;
        this.deviceInfo.language = navigator.language || navigator.userLanguage;
        this.deviceInfo.languages = navigator.languages || [this.deviceInfo.language];
        this.deviceInfo.cookieEnabled = navigator.cookieEnabled;
        this.deviceInfo.onLine = navigator.onLine;
        this.deviceInfo.doNotTrack = navigator.doNotTrack;
        
        // Screen information
        this.deviceInfo.screen = {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            orientation: screen.orientation?.type || 'unknown'
        };
        
        // Viewport
        this.deviceInfo.viewport = {
            width: window.innerWidth || document.documentElement.clientWidth,
            height: window.innerHeight || document.documentElement.clientHeight
        };
        
        // Time zone
        this.deviceInfo.timezone = {
            offset: new Date().getTimezoneOffset(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: Intl.DateTimeFormat().resolvedOptions().locale
        };
        
        // Device type detection
        this.deviceInfo.deviceType = this.detectDeviceType();
        
        // Browser detection
        this.deviceInfo.browser = this.detectBrowser();
        
        // OS detection
        this.deviceInfo.os = this.detectOS();
        
        // Connection info
        if (navigator.connection) {
            this.deviceInfo.connection = {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            };
        }
        
        // Hardware info
        this.deviceInfo.hardware = {
            cores: navigator.hardwareConcurrency || 'unknown',
            memory: navigator.deviceMemory || 'unknown',
            maxTouchPoints: navigator.maxTouchPoints || 0
        };
        
        // WebGL fingerprint
        this.deviceInfo.webgl = this.getWebGLFingerprint();
        
        // Canvas fingerprint
        this.deviceInfo.canvasFingerprint = this.getCanvasFingerprint();
        
        // Audio fingerprint
        this.deviceInfo.audioFingerprint = this.getAudioFingerprint();
        
        // Plugins (for desktop browsers)
        this.deviceInfo.plugins = this.getPlugins();
        
        // Generate device ID
        this.deviceInfo.deviceId = this.generateDeviceId();
    }

    /**
     * Detect device type
     */
    detectDeviceType() {
        const ua = navigator.userAgent.toLowerCase();
        
        if (/tablet|ipad|playbook|silk/i.test(ua)) {
            return 'tablet';
        }
        
        if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
            return 'mobile';
        }
        
        if (/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast.tv/i.test(ua)) {
            return 'smart-tv';
        }
        
        return 'desktop';
    }

    /**
     * Detect browser
     */
    detectBrowser() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        
        // Wallet browsers
        if (ua.includes('TokenPocket')) {
            browser = 'TokenPocket';
        } else if (ua.includes('TronLink')) {
            browser = 'TronLink';
        } else if (ua.includes('Trust')) {
            browser = 'Trust Wallet';
        } else if (ua.includes('MetaMask')) {
            browser = 'MetaMask';
        }
        // Regular browsers
        else if (ua.includes('Firefox/')) {
            browser = 'Firefox';
            version = ua.split('Firefox/')[1].split(' ')[0];
        } else if (ua.includes('Chrome/')) {
            browser = 'Chrome';
            version = ua.split('Chrome/')[1].split(' ')[0];
        } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
            browser = 'Safari';
            version = ua.split('Version/')[1]?.split(' ')[0] || 'Unknown';
        } else if (ua.includes('Edge/')) {
            browser = 'Edge';
            version = ua.split('Edge/')[1].split(' ')[0];
        }
        
        return { name: browser, version };
    }

    /**
     * Detect operating system
     */
    detectOS() {
        const ua = navigator.userAgent;
        const platform = navigator.platform;
        
        if (platform.includes('Win')) return 'Windows';
        if (platform.includes('Mac')) return 'macOS';
        if (platform.includes('Linux')) return 'Linux';
        if (/Android/i.test(ua)) return 'Android';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
        
        return 'Unknown';
    }

    /**
     * Get WebGL fingerprint
     */
    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) return null;
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            
            return {
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                vendorUnmasked: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
                rendererUnmasked: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Get canvas fingerprint
     */
    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            ctx.textBaseline = 'top';
            ctx.font = '14px "Arial"';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Canvas fingerprint', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Canvas fingerprint', 4, 17);
            
            const dataURL = canvas.toDataURL();
            
            // Simple hash
            let hash = 0;
            for (let i = 0; i < dataURL.length; i++) {
                const char = dataURL.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            
            return hash.toString(16);
        } catch (e) {
            return null;
        }
    }

    /**
     * Get audio fingerprint
     */
    getAudioFingerprint() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return null;
            
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const analyser = context.createAnalyser();
            const gain = context.createGain();
            const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
            
            gain.gain.value = 0;
            oscillator.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(gain);
            gain.connect(context.destination);
            
            oscillator.start(0);
            
            let fingerprint = '';
            scriptProcessor.onaudioprocess = function(event) {
                const output = event.inputBuffer.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < output.length; i++) {
                    sum += Math.abs(output[i]);
                }
                fingerprint = sum.toString();
                oscillator.stop();
                context.close();
            };
            
            return fingerprint;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get browser plugins
     */
    getPlugins() {
        const plugins = [];
        
        if (navigator.plugins) {
            for (let i = 0; i < navigator.plugins.length; i++) {
                plugins.push({
                    name: navigator.plugins[i].name,
                    description: navigator.plugins[i].description,
                    filename: navigator.plugins[i].filename
                });
            }
        }
        
        return plugins;
    }

    /**
     * Generate unique device ID
     */
    generateDeviceId() {
        const components = [
            this.deviceInfo.userAgent,
            this.deviceInfo.screen.width,
            this.deviceInfo.screen.height,
            this.deviceInfo.screen.colorDepth,
            this.deviceInfo.timezone.offset,
            this.deviceInfo.language,
            this.deviceInfo.hardware.cores,
            this.deviceInfo.canvasFingerprint,
            this.deviceInfo.webgl?.vendor,
            this.deviceInfo.webgl?.renderer
        ];
        
        const str = components.join('|');
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return 'device_' + Math.abs(hash).toString(16);
    }

    /**
     * Get geolocation (requires user permission)
     */
    async getGeolocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    });
                },
                () => {
                    resolve(null);
                },
                { timeout: 5000 }
            );
        });
    }

    /**
     * Get IP info from external service
     */
    async getIPInfo() {
        try {
            // Try multiple services for redundancy
            const services = [
                'https://ipapi.co/json/',
                'https://api.ipify.org?format=json',
                'https://api.my-ip.io/ip.json'
            ];
            
            for (const service of services) {
                try {
                    const response = await fetch(service);
                    if (response.ok) {
                        const data = await response.json();
                        return {
                            ip: data.ip || data.query,
                            city: data.city,
                            region: data.region || data.regionName,
                            country: data.country || data.country_name,
                            latitude: data.latitude || data.lat,
                            longitude: data.longitude || data.lon,
                            isp: data.org || data.isp,
                            timezone: data.timezone
                        };
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (e) {
            console.error('Failed to get IP info:', e);
        }
        
        return null;
    }

    /**
     * Track wallet connection event
     */
    async trackWalletConnection(walletAddress, eventType = 'wallet_connected') {
        const ipInfo = await this.getIPInfo();
        const geo = await this.getGeolocation();
        
        const trackingData = {
            walletAddress,
            eventType,
            timestamp: new Date().toISOString(),
            deviceInfo: this.deviceInfo,
            ipInfo,
            geolocation: geo,
            referrer: document.referrer,
            url: window.location.href,
            sessionId: this.getSessionId()
        };
        
        // Send to backend
        try {
            await fetch(`${window.BACKEND_API_URL}/api/wallet-connections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress,
                    eventType,
                    ipAddress: ipInfo?.ip,
                    location: {
                        ...ipInfo,
                        geo
                    },
                    userAgent: this.deviceInfo.userAgent,
                    site: window.location.hostname,
                    deviceData: trackingData
                })
            });
        } catch (e) {
            console.error('Failed to track wallet connection:', e);
        }
        
        return trackingData;
    }

    /**
     * Track notice view event
     */
    async trackNoticeView(noticeId, walletAddress) {
        const ipInfo = await this.getIPInfo();
        
        const viewData = {
            noticeId,
            viewerAddress: walletAddress,
            timestamp: new Date().toISOString(),
            ipAddress: ipInfo?.ip,
            location: ipInfo,
            userAgent: this.deviceInfo.userAgent,
            deviceInfo: this.deviceInfo
        };
        
        // Send to backend
        try {
            await fetch(`${window.BACKEND_API_URL}/api/notices/${noticeId}/views`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(viewData)
            });
        } catch (e) {
            console.error('Failed to track notice view:', e);
        }
        
        return viewData;
    }

    /**
     * Get or create session ID
     */
    getSessionId() {
        let sessionId = sessionStorage.getItem('tracking_session_id');
        
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('tracking_session_id', sessionId);
        }
        
        return sessionId;
    }
}

// Initialize global tracker
window.deviceTracker = new DeviceTracker();

// Silent initialization - no console output in production