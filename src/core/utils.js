/**
 * ShapeKeeper Utility Functions
 * Shared utility functions used throughout the application
 * @module core/utils
 */

// =============================================================================
// LINE KEY UTILITIES
// =============================================================================

/**
 * Normalize line key to prevent duplicates
 * Always sorts coordinates to ensure consistent key format
 * @param {Object} dot1 - {row, col}
 * @param {Object} dot2 - {row, col}
 * @returns {string} Normalized line key "row,col-row,col"
 */
export function getLineKey(dot1, dot2) {
    const [first, second] = [dot1, dot2].sort((a, b) =>
        a.row === b.row ? a.col - b.col : a.row - b.row
    );
    return `${first.row},${first.col}-${second.row},${second.col}`;
}

/**
 * Parse a line key string into start and end dot objects
 * @param {string} lineKey - Format: "row,col-row,col"
 * @returns {Array} [startDot, endDot]
 */
export function parseLineKey(lineKey) {
    const [start, end] = lineKey.split('-').map(s => {
        const [row, col] = s.split(',').map(Number);
        return { row, col };
    });
    return [start, end];
}

/**
 * Parse a square key string into row and col
 * @param {string} squareKey - Format: "row,col"
 * @returns {Object} {row, col}
 */
export function parseSquareKey(squareKey) {
    const [row, col] = squareKey.split(',').map(Number);
    return { row, col };
}

// =============================================================================
// DOT UTILITIES
// =============================================================================

/**
 * Check if two dots are adjacent (horizontal or vertical only)
 * Diagonal connections are NOT allowed in standard Dots and Boxes
 * @param {Object} dot1 - {row, col}
 * @param {Object} dot2 - {row, col}
 * @returns {boolean} True if dots are horizontally or vertically adjacent
 */
export function areAdjacent(dot1, dot2) {
    const rowDiff = Math.abs(dot1.row - dot2.row);
    const colDiff = Math.abs(dot1.col - dot2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

/**
 * Calculate distance between two points
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number} Euclidean distance
 */
export function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Generate a random hex color
 * @returns {string} Hex color string like "#FF00FF"
 */
export function generateRandomColor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const toHex = (val) => val.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert hex color to RGBA
 * @param {string} hex - Hex color like "#FF00FF"
 * @param {number} alpha - Alpha value 0-1
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Lighten or darken a hex color
 * @param {string} hex - Hex color
 * @param {number} amount - Positive to lighten, negative to darken (-255 to 255)
 * @returns {string} Modified hex color
 */
export function adjustColor(hex, amount) {
    const clamp = (n) => Math.min(255, Math.max(0, n));
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    
    r = clamp(r + amount);
    g = clamp(g + amount);
    b = clamp(b + amount);
    
    const toHex = (val) => val.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// =============================================================================
// ARRAY UTILITIES
// =============================================================================

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} The same array, shuffled
 */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Generate a distribution map for items across positions
 * Used for multipliers, tile effects, etc.
 * @param {Array} positions - Array of position keys to fill
 * @param {Object} distribution - Map of value -> count (e.g., {x2: 10, x3: 5})
 * @param {*} defaultValue - Value for positions not covered by distribution
 * @returns {Object} Map of position -> value
 */
export function distributeOverPositions(positions, distribution, defaultValue = null) {
    const shuffled = shuffleArray([...positions]);
    const result = {};
    let index = 0;
    
    for (const [value, count] of Object.entries(distribution)) {
        for (let i = 0; i < count && index < shuffled.length; i++) {
            result[shuffled[index++]] = value;
        }
    }
    
    // Fill remaining with default
    while (index < shuffled.length) {
        result[shuffled[index++]] = defaultValue;
    }
    
    return result;
}

/**
 * Clamp a value between min and max
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Progress (0-1)
 * @returns {number}
 */
export function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Pick a random element from an array
 * @param {Array} array 
 * @returns {*} Random element
 */
export function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// =============================================================================
// DOM UTILITIES
// =============================================================================

/**
 * Get cached DOM element (creates cache on first call)
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
const domCache = new Map();
export function getElement(id) {
    if (!domCache.has(id)) {
        domCache.set(id, document.getElementById(id));
    }
    return domCache.get(id);
}

/**
 * Clear DOM element cache (call after dynamic content changes)
 */
export function clearDomCache() {
    domCache.clear();
}

// =============================================================================
// TIMING UTILITIES
// =============================================================================

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum milliseconds between calls
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// =============================================================================
// FULLSCREEN UTILITIES
// =============================================================================

/**
 * Request fullscreen mode
 */
export function requestFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
    }
}

/**
 * Exit fullscreen mode
 */
export function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    }
}

// =============================================================================
// ROOM CODE UTILITIES
// =============================================================================

/**
 * Generate a random 6-character room code
 * Uses characters that are easy to read and distinguish
 * Excludes I, O, 1, 0 to avoid confusion
 * @returns {string} 6-character room code
 */
export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// =============================================================================
// STORAGE UTILITIES
// =============================================================================

/**
 * Get item from localStorage with fallback
 * @param {string} key 
 * @param {*} defaultValue 
 * @returns {*}
 */
export function getStorageItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item !== null ? JSON.parse(item) : defaultValue;
    } catch {
        return defaultValue;
    }
}

/**
 * Set item in localStorage
 * @param {string} key 
 * @param {*} value 
 */
export function setStorageItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('[Storage] Failed to save:', e);
    }
}
