/**
 * ShapeKeeper Tile Effects System
 * Handles traps, powerups, and special tile behaviors
 * @module effects/TileEffects
 */

import { DARES, HYPOTHETICALS, PHYSICAL_CHALLENGES, TILE_EFFECTS, TRUTHS } from '../core/constants.js';

/**
 * Effect result from activation
 * @typedef {Object} EffectResult
 * @property {string} message - Result message
 * @property {boolean} success - Whether effect was applied
 * @property {Object} [stateChanges] - Any state changes to apply
 */

/**
 * Tile effect data
 * @typedef {Object} TileEffect
 * @property {string} type - 'trap' or 'powerup'
 * @property {string} name - Effect name
 * @property {string} description - Effect description
 * @property {string} icon - Effect emoji icon
 * @property {function} apply - Effect application function
 */

export class TileEffectsManager {
    constructor() {
        this.tileEffects = {}; // squareKey -> effect
        this.playerEffects = {
            frozen: 0,
            shield: false,
            shieldCount: 0,
            extraTurns: 0,
            oracleActive: false,
            lightningActive: false
        };
        this.revealedEffects = new Set();
    }

    /**
     * Initialize tile effects for a grid
     * @param {number} gridRows - Number of grid rows
     * @param {number} gridCols - Number of grid columns
     * @param {number} effectChance - Chance of effect per tile (0-1)
     */
    initializeEffects(gridRows, gridCols, effectChance = TILE_EFFECTS.EFFECT_CHANCE) {
        this.tileEffects = {};
        this.revealedEffects.clear();
        
        for (let row = 0; row < gridRows - 1; row++) {
            for (let col = 0; col < gridCols - 1; col++) {
                if (Math.random() < effectChance) {
                    const squareKey = `${row},${col}`;
                    this.tileEffects[squareKey] = this.generateRandomEffect();
                }
            }
        }
    }

    /**
     * Generate a random tile effect
     * @returns {TileEffect}
     */
    generateRandomEffect() {
        const isTrap = Math.random() < TILE_EFFECTS.TRAP_CHANCE;
        const effects = isTrap ? this.getTraps() : this.getPowerups();
        const effect = effects[Math.floor(Math.random() * effects.length)];
        
        return {
            ...effect,
            type: isTrap ? 'trap' : 'powerup',
            revealed: false
        };
    }

    /**
     * Get all trap definitions
     * @returns {Array<TileEffect>}
     */
    getTraps() {
        return [
            {
                name: 'Landmine',
                description: 'Lose 3 points!',
                icon: '💣',
                apply: (state) => ({ scoreChange: -3 })
            },
            {
                name: 'Freeze',
                description: 'Skip your next turn!',
                icon: '🧊',
                apply: (state) => {
                    this.playerEffects.frozen = 1;
                    return { frozen: true };
                }
            },
            {
                name: 'Score Swap',
                description: 'Swap scores with opponent!',
                icon: '🔄',
                apply: (state) => ({ swapScores: true })
            },
            {
                name: 'Chaos Storm',
                description: 'Randomize multipliers!',
                icon: '🌀',
                apply: (state) => ({ chaosStorm: true })
            },
            {
                name: 'Hypothetical',
                description: this.getRandomHypothetical(),
                icon: '🤔',
                apply: (state) => ({ social: true, text: this.getRandomHypothetical() })
            },
            {
                name: 'Dare',
                description: this.getRandomDare(),
                icon: '🎯',
                apply: (state) => ({ social: true, text: this.getRandomDare() })
            },
            {
                name: 'Truth',
                description: this.getRandomTruth(),
                icon: '🔥',
                apply: (state) => ({ social: true, text: this.getRandomTruth() })
            },
            {
                name: 'Physical Challenge',
                description: this.getRandomPhysicalChallenge(),
                icon: '💪',
                apply: (state) => ({ social: true, text: this.getRandomPhysicalChallenge() })
            }
        ];
    }

    /**
     * Get all powerup definitions
     * @returns {Array<TileEffect>}
     */
    getPowerups() {
        return [
            {
                name: 'Extra Turn',
                description: 'Take another turn!',
                icon: '🎁',
                apply: (state) => {
                    this.playerEffects.extraTurns++;
                    return { extraTurn: true };
                }
            },
            {
                name: 'Steal Territory',
                description: 'Steal a random opponent square!',
                icon: '🏴‍☠️',
                apply: (state) => ({ stealSquare: true })
            },
            {
                name: 'Shield',
                description: 'Block the next trap!',
                icon: '🛡️',
                apply: (state) => {
                    this.playerEffects.shield = true;
                    this.playerEffects.shieldCount = 1;
                    return { shieldActive: true };
                }
            },
            {
                name: 'Lightning',
                description: 'Complete a random nearby line!',
                icon: '⚡',
                apply: (state) => {
                    this.playerEffects.lightningActive = true;
                    return { lightning: true };
                }
            },
            {
                name: "Oracle's Vision",
                description: 'Reveal all adjacent tile effects!',
                icon: '👁️',
                apply: (state) => {
                    this.playerEffects.oracleActive = true;
                    return { revealAdjacent: true };
                }
            },
            {
                name: 'Double Points',
                description: 'This square is worth double!',
                icon: '✨',
                apply: (state) => ({ pointsMultiplier: 2 })
            },
            {
                name: 'Bonus Points',
                description: 'Gain 2 extra points!',
                icon: '🌟',
                apply: (state) => ({ scoreChange: 2 })
            }
        ];
    }

    /**
     * Get random hypothetical question
     * @returns {string}
     */
    getRandomHypothetical() {
        return HYPOTHETICALS[Math.floor(Math.random() * HYPOTHETICALS.length)];
    }

    /**
     * Get random dare
     * @returns {string}
     */
    getRandomDare() {
        return DARES[Math.floor(Math.random() * DARES.length)];
    }

    /**
     * Get random truth prompt
     * @returns {string}
     */
    getRandomTruth() {
        return TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
    }

    /**
     * Get random physical challenge
     * @returns {string}
     */
    getRandomPhysicalChallenge() {
        return PHYSICAL_CHALLENGES[Math.floor(Math.random() * PHYSICAL_CHALLENGES.length)];
    }

    /**
     * Check if tile has an effect
     * @param {string} squareKey - Square key "row,col"
     * @returns {boolean}
     */
    hasEffect(squareKey) {
        return this.tileEffects.hasOwnProperty(squareKey);
    }

    /**
     * Get effect for a tile
     * @param {string} squareKey - Square key
     * @returns {TileEffect|null}
     */
    getEffect(squareKey) {
        return this.tileEffects[squareKey] || null;
    }

    /**
     * Reveal an effect
     * @param {string} squareKey - Square key
     * @returns {TileEffect|null}
     */
    revealEffect(squareKey) {
        const effect = this.tileEffects[squareKey];
        if (effect) {
            effect.revealed = true;
            this.revealedEffects.add(squareKey);
        }
        return effect;
    }

    /**
     * Apply an effect
     * @param {string} squareKey - Square key
     * @param {Object} gameState - Current game state
     * @returns {EffectResult|null}
     */
    applyEffect(squareKey, gameState) {
        const effect = this.tileEffects[squareKey];
        if (!effect) return null;

        // Check for shield blocking traps
        if (effect.type === 'trap' && this.playerEffects.shield) {
            this.playerEffects.shield = false;
            this.playerEffects.shieldCount = 0;
            return {
                message: '🛡️ Shield blocked the trap!',
                success: false,
                blocked: true
            };
        }

        const result = effect.apply(gameState);
        return {
            message: `${effect.icon} ${effect.name}: ${effect.description}`,
            success: true,
            ...result
        };
    }

    /**
     * Reveal adjacent tiles (Oracle's Vision)
     * @param {string} squareKey - Center square key
     * @returns {Array<string>} Revealed square keys
     */
    revealAdjacentEffects(squareKey) {
        const [row, col] = squareKey.split(',').map(Number);
        const revealed = [];
        
        const adjacentOffsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dRow, dCol] of adjacentOffsets) {
            const adjKey = `${row + dRow},${col + dCol}`;
            if (this.hasEffect(adjKey) && !this.revealedEffects.has(adjKey)) {
                this.revealEffect(adjKey);
                revealed.push(adjKey);
            }
        }

        return revealed;
    }

    /**
     * Process frozen turn
     * @returns {boolean} True if player is frozen
     */
    processFrozenTurn() {
        if (this.playerEffects.frozen > 0) {
            this.playerEffects.frozen--;
            return true;
        }
        return false;
    }

    /**
     * Check and consume extra turn
     * @returns {boolean} True if extra turn available
     */
    consumeExtraTurn() {
        if (this.playerEffects.extraTurns > 0) {
            this.playerEffects.extraTurns--;
            return true;
        }
        return false;
    }

    /**
     * Reset all player effects
     */
    resetPlayerEffects() {
        this.playerEffects = {
            frozen: 0,
            shield: false,
            shieldCount: 0,
            extraTurns: 0,
            oracleActive: false,
            lightningActive: false
        };
    }

    /**
     * Get current player effects status
     * @returns {Object}
     */
    getPlayerEffectsStatus() {
        return { ...this.playerEffects };
    }

    /**
     * Get effect colors for rendering
     * @param {string} type - 'trap' or 'powerup'
     * @returns {{bg: string, border: string}}
     */
    getEffectColors(type) {
        return type === 'trap' 
            ? { bg: 'rgba(255, 0, 0, 0.2)', border: '#ff4444' }
            : { bg: 'rgba(0, 150, 255, 0.2)', border: '#4488ff' };
    }

    /**
     * Clear all effects (for new game)
     */
    clear() {
        this.tileEffects = {};
        this.revealedEffects.clear();
        this.resetPlayerEffects();
    }

    /**
     * Get stats for debugging
     * @returns {Object}
     */
    getStats() {
        const traps = Object.values(this.tileEffects).filter(e => e.type === 'trap').length;
        const powerups = Object.values(this.tileEffects).filter(e => e.type === 'powerup').length;
        return {
            total: Object.keys(this.tileEffects).length,
            traps,
            powerups,
            revealed: this.revealedEffects.size
        };
    }
}
