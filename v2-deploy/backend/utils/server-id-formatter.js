/**
 * Server ID Formatter
 * Ensures consistent server ID format across the application
 * 
 * Blockchain stores simple numeric IDs (1, 2, 3, etc.)
 * Display format: PS-0001, PS-0002, PS-0003, etc.
 */

/**
 * Format a numeric server ID from blockchain to display format
 * @param {number|string} numericId - The numeric ID from blockchain (1, 2, 3, etc.)
 * @returns {string} Formatted ID like PS-0001
 */
function formatServerId(numericId) {
    if (!numericId || numericId === '0' || numericId === 0) {
        return null;
    }
    
    // Convert to number if string
    const id = parseInt(numericId.toString());
    
    // Format as PS-XXXX (4 digits, padded with zeros)
    return `PS-${id.toString().padStart(4, '0')}`;
}

/**
 * Extract numeric ID from formatted server ID
 * @param {string} formattedId - Formatted ID like PS-0001
 * @returns {number} Numeric ID like 1
 */
function extractNumericId(formattedId) {
    if (!formattedId) return 0;
    
    // Handle various formats
    if (typeof formattedId === 'number') return formattedId;
    
    // Extract number from PS-XXXX format
    const match = formattedId.match(/PS-(\d+)/);
    if (match) {
        return parseInt(match[1]);
    }
    
    // Try to parse as direct number
    const parsed = parseInt(formattedId);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Generate a temporary ID for servers not yet on blockchain
 * @returns {string} Temporary ID like PS-TEMP-XXXX
 */
function generateTempId() {
    const random = Math.floor(Math.random() * 10000);
    return `PS-TEMP-${random.toString().padStart(4, '0')}`;
}

module.exports = {
    formatServerId,
    extractNumericId,
    generateTempId
};