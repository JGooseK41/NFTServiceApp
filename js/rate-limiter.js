/**
 * Rate Limiter for TronGrid API calls
 * Implements exponential backoff and request queuing
 */
class RateLimiter {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.lastRequestTime = 0;
        this.minDelay = 500; // Minimum 500ms between requests
        this.maxRetries = 3;
        this.backoffMultiplier = 2;
        this.currentDelay = this.minDelay;
    }

    /**
     * Execute a function with rate limiting
     */
    async execute(fn, context = null, retries = 0) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                fn,
                context,
                resolve,
                reject,
                retries
            });
            
            if (!this.processing) {
                this.processQueue();
            }
        });
    }

    /**
     * Process the queue of requests
     */
    async processQueue() {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }

        this.processing = true;
        const item = this.queue.shift();

        // Calculate delay needed
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const delayNeeded = Math.max(0, this.currentDelay - timeSinceLastRequest);

        if (delayNeeded > 0) {
            await new Promise(resolve => setTimeout(resolve, delayNeeded));
        }

        this.lastRequestTime = Date.now();

        try {
            const result = await item.fn.call(item.context);
            item.resolve(result);
            
            // Success - reset delay
            this.currentDelay = this.minDelay;
        } catch (error) {
            // Check if it's a rate limit error
            if (error.message && error.message.includes('429')) {
                console.warn('Rate limit hit, backing off...');
                
                if (item.retries < this.maxRetries) {
                    // Exponential backoff
                    this.currentDelay = Math.min(10000, this.currentDelay * this.backoffMultiplier);
                    console.log(`Retrying in ${this.currentDelay}ms (attempt ${item.retries + 1}/${this.maxRetries})`);
                    
                    // Re-queue with increased retry count
                    this.queue.unshift({
                        ...item,
                        retries: item.retries + 1
                    });
                } else {
                    console.error('Max retries reached for request');
                    item.reject(error);
                }
            } else {
                // Non-rate-limit error
                item.reject(error);
            }
        }

        // Process next item
        setTimeout(() => this.processQueue(), 100);
    }

    /**
     * Clear the queue
     */
    clearQueue() {
        this.queue = [];
        this.processing = false;
    }
}

// Create global rate limiter instance
window.rateLimiter = new RateLimiter();

/**
 * Wrapper for TronWeb contract calls with rate limiting
 */
window.rateLimitedContractCall = async function(contractMethod, ...args) {
    return window.rateLimiter.execute(async () => {
        return await contractMethod(...args).call();
    });
};

/**
 * Wrapper for fetch requests with rate limiting
 */
window.rateLimitedFetch = async function(url, options = {}) {
    return window.rateLimiter.execute(async () => {
        const response = await fetch(url, options);
        
        if (response.status === 429) {
            throw new Error('429 Rate Limit');
        }
        
        return response;
    });
};

console.log('Rate limiter initialized');