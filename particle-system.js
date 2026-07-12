/**
 * ShapeKeeper - Particle System
 * Particle creation and management for visual effects
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { GAME_CONSTANTS } from './constants.js';
import {
    createAmbientParticle,
    createParticlePool,
    initializeAmbientParticles,
    spawnParticlesFromPool,
    updateParticles,
} from './particle-system/core.js';
import {
    createBonusTurnParticles,
    createChaosParticles,
    createDoubleLineParticles,
    createDoublePointsParticles,
    createEffectParticles,
    createEpicParticles,
    createFreezeParticles,
    createGiftParticles,
    createLandmineParticles,
    createLightningParticles,
    createPowerupParticles,
    createReverseParticles,
    createShieldParticles,
    createSkipTurnParticles,
    createStealParticles,
    createSwapParticles,
    createWildcardParticles,
} from './particle-system/effects.js';
import { createMultiplierParticles, spawnSparkleEmojis } from './particle-system/spawners.js';

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.ambientParticles = [];
        this.sparkleEmojis = [];
        // Object pool reuses dead particles to avoid per-burst GC churn.
        this.pool = createParticlePool(GAME_CONSTANTS.PARTICLE_POOL_SIZE);
        this.initializeAmbientParticles();
    }

    /**
     * Initialize ambient floating particles
     */
    initializeAmbientParticles() {
        initializeAmbientParticles(this);
    }

    /**
     * Create a single ambient particle
     */
    createAmbientParticle(atEdge = false) {
        return createAmbientParticle(atEdge);
    }

    /**
     * Update particle physics
     */
    updateParticles(logicalWidth, logicalHeight) {
        updateParticles(this, logicalWidth, logicalHeight);
    }

    /**
     * Spawn particles at a given position
     */
    spawnParticles(x, y, color, count = GAME_CONSTANTS.PARTICLE_COUNT_SQUARE) {
        spawnParticlesFromPool(this.pool, x, y, color, count);
        // Mirror pooled particles into the legacy array the renderer reads.
        // Use a Set for membership so this stays O(n) instead of O(n^2)
        // (the old `this.particles.includes(p)` scan was per active particle).
        const existing = new Set(this.particles);
        for (const p of this.pool.active) {
            if (!existing.has(p)) this.particles.push(p);
        }
    }

    /**
     * Spawn sparkle emojis at a given position
     */
    spawnSparkleEmojis(x, y, count = 3, cellSize = 20) {
        spawnSparkleEmojis(this, x, y, count, cellSize);
    }

    /**
     * Create multiplier effect particles
     */
    createMultiplierParticles(x, y, multiplierValue) {
        createMultiplierParticles(this, x, y, multiplierValue);
    }

    /**
     * Create effect-specific particles
     */
    createEffectParticles(squareKey, effectData, parseSquareKey) {
        createEffectParticles(this, squareKey, effectData, parseSquareKey);
    }

    /**
     * Create landmine explosion particles
     */
    createLandmineParticles(squareKey, parseSquareKey) {
        createLandmineParticles(this, squareKey, parseSquareKey);
    }

    /**
     * Create freeze animation particles
     */
    createFreezeParticles() {
        createFreezeParticles(this);
    }

    /**
     * Create score swap animation particles
     */
    createSwapParticles() {
        createSwapParticles(this);
    }

    /**
     * Create reverse turn animation particles
     */
    createReverseParticles() {
        createReverseParticles(this);
    }

    /**
     * Create chaos storm particles
     */
    createChaosParticles() {
        createChaosParticles(this);
    }

    /**
     * Create generic powerup particles
     */
    createPowerupParticles(squareKey, color, parseSquareKey) {
        createPowerupParticles(this, squareKey, color, parseSquareKey);
    }

    /**
     * Create shield animation particles
     */
    createShieldParticles() {
        createShieldParticles(this);
    }

    /**
     * Create lightning animation particles
     */
    createLightningParticles() {
        createLightningParticles(this);
    }

    /**
     * Create gift animation particles
     */
    createGiftParticles() {
        createGiftParticles(this);
    }

    /**
     * Create steal territory animation particles
     */
    createStealParticles(squareKey, parseSquareKey) {
        createStealParticles(this, squareKey, parseSquareKey);
    }

    /**
     * Create wildcard animation particles
     */
    createWildcardParticles(squareKey, parseSquareKey) {
        createWildcardParticles(this, squareKey, parseSquareKey);
    }

    /**
     * Create bonus turn visual particles
     */
    createBonusTurnParticles() {
        createBonusTurnParticles(this);
    }

    /**
     * Create skip turn visual particles
     */
    createSkipTurnParticles() {
        createSkipTurnParticles(this);
    }

    /**
     * Create double points visual particles
     */
    createDoublePointsParticles() {
        createDoublePointsParticles(this);
    }

    /**
     * Create double line reminder particles
     */
    createDoubleLineParticles() {
        createDoubleLineParticles(this);
    }

    /**
     * Create epic combo particles
     */
    createEpicParticles() {
        createEpicParticles(this);
    }
}
