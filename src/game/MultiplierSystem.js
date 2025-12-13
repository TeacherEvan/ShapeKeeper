/**
 * ShapeKeeper Multiplier System
 * Handles score multipliers with weighted random distribution
 * @module game/MultiplierSystem
 */

/**
 * Multiplier distribution weights
 * @constant
 */
const MULTIPLIER_WEIGHTS = {
    2: 65, // 65% chance
    3: 20, // 20% chance
    4: 10, // 10% chance
    5: 4, // 4% chance
    10: 1, // 1% chance
};

export class MultiplierSystem {
    constructor() {
        this.multipliers = {}; // squareKey -> multiplier value
        this.revealedMultipliers = new Set();
    }

    /**
     * Initialize multipliers for a grid
     * @param {number} gridRows - Number of grid rows
     * @param {number} gridCols - Number of grid columns
     */
    initialize(gridRows, gridCols) {
        this.multipliers = {};
        this.revealedMultipliers.clear();

        for (let row = 0; row < gridRows - 1; row++) {
            for (let col = 0; col < gridCols - 1; col++) {
                const squareKey = `${row},${col}`;
                this.multipliers[squareKey] = this.generateMultiplier();
            }
        }
    }

    /**
     * Generate a weighted random multiplier
     * @returns {number}
     */
    generateMultiplier() {
        const totalWeight = Object.values(MULTIPLIER_WEIGHTS).reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (const [multiplier, weight] of Object.entries(MULTIPLIER_WEIGHTS)) {
            random -= weight;
            if (random <= 0) {
                return parseInt(multiplier);
            }
        }

        return 2; // Default fallback
    }

    /**
     * Get multiplier for a square
     * @param {string} squareKey - Square key "row,col"
     * @returns {number}
     */
    getMultiplier(squareKey) {
        return this.multipliers[squareKey] || 1;
    }

    /**
     * Reveal multiplier for a square
     * @param {string} squareKey - Square key
     * @returns {number} The multiplier value
     */
    revealMultiplier(squareKey) {
        this.revealedMultipliers.add(squareKey);
        return this.multipliers[squareKey] || 1;
    }

    /**
     * Check if multiplier is revealed
     * @param {string} squareKey - Square key
     * @returns {boolean}
     */
    isRevealed(squareKey) {
        return this.revealedMultipliers.has(squareKey);
    }

    /**
     * Randomize all multipliers (Chaos Storm effect)
     */
    randomizeAll() {
        for (const key of Object.keys(this.multipliers)) {
            this.multipliers[key] = this.generateMultiplier();
        }
        // Keep revealed status
    }

    /**
     * Get multiplier color for rendering
     * @param {number} multiplier - Multiplier value
     * @returns {string} Hex color
     */
    getMultiplierColor(multiplier) {
        switch (multiplier) {
            case 2:
                return '#4CAF50'; // Green
            case 3:
                return '#2196F3'; // Blue
            case 4:
                return '#9C27B0'; // Purple
            case 5:
                return '#FF9800'; // Orange
            case 10:
                return '#FFD700'; // Gold
            default:
                return '#666666'; // Gray
        }
    }

    /**
     * Get multiplier display text
     * @param {number} multiplier - Multiplier value
     * @returns {string}
     */
    getMultiplierText(multiplier) {
        return `×${multiplier}`;
    }

    /**
     * Clear all multipliers
     */
    clear() {
        this.multipliers = {};
        this.revealedMultipliers.clear();
    }

    /**
     * Get stats for debugging
     * @returns {Object}
     */
    getStats() {
        const counts = { 2: 0, 3: 0, 4: 0, 5: 0, 10: 0 };
        for (const mult of Object.values(this.multipliers)) {
            if (counts.hasOwnProperty(mult)) {
                counts[mult]++;
            }
        }
        return {
            total: Object.keys(this.multipliers).length,
            revealed: this.revealedMultipliers.size,
            distribution: counts,
        };
    }

    /**
     * Set specific multiplier (for testing or sync)
     * @param {string} squareKey - Square key
     * @param {number} value - Multiplier value
     */
    setMultiplier(squareKey, value) {
        this.multipliers[squareKey] = value;
    }

    /**
     * Export state for sync
     * @returns {Object}
     */
    exportState() {
        return {
            multipliers: { ...this.multipliers },
            revealed: Array.from(this.revealedMultipliers),
        };
    }

    /**
     * Import state from sync
     * @param {Object} state - Exported state
     */
    importState(state) {
        if (state.multipliers) {
            this.multipliers = { ...state.multipliers };
        }
        if (state.revealed) {
            this.revealedMultipliers = new Set(state.revealed);
        }
    }
}
