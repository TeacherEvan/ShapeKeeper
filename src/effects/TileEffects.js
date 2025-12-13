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
                id: 'landmine',
                name: 'Landmine!',
                description: 'BOOM! The area explodes! No one scores and you lose your turn.',
                icon: '💣',
                apply: (state) => ({ scoreChange: -3, loseTurn: true })
            },
            {
                id: 'secret',
                name: 'Reveal a Secret',
                description: 'Spill the tea! Share an embarrassing secret about yourself.',
                icon: '🔮',
                apply: (state) => ({ social: true })
            },
            {
                id: 'hypothetical',
                name: 'Hypothetical',
                description: 'Answer the hypothetical question honestly!',
                icon: '🤔',
                apply: (state) => ({ social: true, text: this.getRandomHypothetical() })
            },
            {
                id: 'drink',
                name: 'Drink!',
                description: 'Take a sip of your beverage! Cheers! 🍻',
                icon: '🍺',
                apply: (state) => ({ social: true })
            },
            {
                id: 'dared',
                name: "You're DARED!",
                description: 'Complete the dare or forfeit your next turn!',
                icon: '🎯',
                apply: (state) => ({ social: true, text: this.getRandomDare() })
            },
            {
                id: 'truth',
                name: "TRUTH TIME!",
                description: 'Answer a truth honestly or face the consequences!',
                icon: '🔥',
                apply: (state) => ({ social: true, text: this.getRandomTruth() })
            },
            {
                id: 'reverse',
                name: 'Reverse!',
                description: 'Turn order is now reversed! Uno-style chaos!',
                icon: '🔄',
                apply: (state) => ({ reverseTurn: true })
            },
            {
                id: 'freeze',
                name: 'Frozen!',
                description: 'Brrr! Skip your next turn while you thaw out.',
                icon: '❄️',
                apply: (state) => {
                    this.playerEffects.frozen = 1;
                    return { frozen: true };
                }
            },
            {
                id: 'swap_scores',
                name: 'Score Swap!',
                description: 'Your score gets swapped with the player on your left!',
                icon: '🎭',
                apply: (state) => ({ swapScores: true })
            },
            {
                id: 'ghost',
                name: 'Ghost Mode',
                description: 'Your next 3 lines are invisible to opponents! Spooky!',
                icon: '👻',
                apply: (state) => ({ ghostMode: true })
            },
            {
                id: 'chaos',
                name: 'Chaos Storm!',
                description: 'All unclaimed squares are randomly redistributed!',
                icon: '🌪️',
                apply: (state) => ({ chaosStorm: true })
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
                id: 'extra_turns',
                name: '+2 Extra Moves!',
                description: 'Lucky you! Take 2 additional turns right now!',
                icon: '➕',
                apply: (state) => {
                    this.playerEffects.extraTurns += 2;
                    return { extraTurn: true };
                }
            },
            {
                id: 'steal_territory',
                name: "Pirate's Plunder",
                description: 'Steal one of your opponent\'s squares and all connected to it!',
                icon: '🏴‍☠️',
                apply: (state) => ({ stealSquare: true })
            },
            {
                id: 'dare_left',
                name: 'Dare Left!',
                description: 'You get to DARE the player on your left! Make it good!',
                icon: '👈',
                apply: (state) => ({ social: true })
            },
            {
                id: 'physical_challenge',
                name: 'Physical Challenge!',
                description: 'The player on your right must do a silly physical challenge!',
                icon: '🤸',
                apply: (state) => ({ social: true, text: this.getRandomPhysicalChallenge() })
            },
            {
                id: 'shield',
                name: 'Shield Up!',
                description: 'Your next 3 completed squares are protected from stealing!',
                icon: '🛡️',
                apply: (state) => {
                    this.playerEffects.shield = true;
                    this.playerEffects.shieldCount = 3;
                    return { shieldActive: true };
                }
            },
            {
                id: 'lightning',
                name: 'Lightning Strike!',
                description: 'POWER! Draw 2 lines at once on your next turn!',
                icon: '⚡',
                apply: (state) => {
                    this.playerEffects.lightningActive = true;
                    return { lightning: true };
                }
            },
            {
                id: 'gift',
                name: 'Gift of Giving',
                description: 'Feeling generous? Give one of your squares to any player!',
                icon: '🎁',
                apply: (state) => ({ giftSquare: true })
            },
            {
                id: 'oracle',
                name: "Oracle's Vision",
                description: 'See all hidden tile effects on the board for 10 seconds!',
                icon: '🔍',
                apply: (state) => {
                    this.playerEffects.oracleActive = true;
                    return { revealAdjacent: true };
                }
            },
            {
                id: 'double_points',
                name: 'Lucky Star!',
                description: 'Your next 3 squares are worth DOUBLE points!',
                icon: '✨',
                apply: (state) => ({ pointsMultiplier: 2 })
            },
            {
                id: 'wildcard',
                name: 'Wildcard!',
                description: 'Choose ANY powerup effect! The power is yours!',
                icon: '🌟',
                apply: (state) => ({ wildcard: true })
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
