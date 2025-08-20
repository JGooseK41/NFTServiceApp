/**
 * TronGrid API Rate Limiter
 * Prevents 429 errors by limiting API calls
 */
class TronRateLimiter {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.lastCallTime = 0;
        this.minDelay = 100; // Minimum 100ms between calls
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second retry delay
    }

    async execute(fn, retries = 0) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                fn,
                resolve,
                reject,
                retries
            });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const { fn, resolve, reject, retries } = this.queue.shift();
            
            // Ensure minimum delay between calls
            const now = Date.now();
            const timeSinceLastCall = now - this.lastCallTime;
            if (timeSinceLastCall < this.minDelay) {
                await this.sleep(this.minDelay - timeSinceLastCall);
            }

            try {
                this.lastCallTime = Date.now();
                const result = await fn();
                resolve(result);
            } catch (error) {
                // Check if it's a rate limit error
                if (error.message && error.message.includes('429')) {
                    console.log('Rate limit hit, retrying after delay...');
                    if (retries < this.maxRetries) {
                        // Re-queue with increased retry count
                        setTimeout(() => {
                            this.queue.unshift({
                                fn,
                                resolve,
                                reject,
                                retries: retries + 1
                            });
                            this.process();
                        }, this.retryDelay * (retries + 1));
                    } else {
                        reject(new Error('Max retries exceeded for TronGrid API call'));
                    }
                } else {
                    reject(error);
                }
            }
        }

        this.processing = false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Create global instance
window.tronRateLimiter = new TronRateLimiter();

// Wrap TronWeb calls
if (window.tronWeb) {
    const originalContract = window.tronWeb.contract;
    window.tronWeb.contract = function(...args) {
        const contractInstance = originalContract.apply(this, args);
        
        // Wrap all contract methods
        const handler = {
            get(target, prop) {
                const original = target[prop];
                if (typeof original === 'function') {
                    return function(...methodArgs) {
                        // Check if it's a call() method
                        const result = original.apply(this, methodArgs);
                        if (result && typeof result.call === 'function') {
                            const originalCall = result.call;
                            result.call = function(...callArgs) {
                                return window.tronRateLimiter.execute(() => 
                                    originalCall.apply(this, callArgs)
                                );
                            };
                        }
                        return result;
                    };
                }
                return original;
            }
        };
        
        return new Proxy(contractInstance, handler);
    };
}

console.log('✅ TronGrid Rate Limiter initialized');