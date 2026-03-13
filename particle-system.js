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
    initializeAmbientParticles,
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
import {
    createMultiplierParticles,
    spawnParticles,
    spawnSparkleEmojis,
} from './particle-system/spawners.js';

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.ambientParticles = [];
        this.sparkleEmojis = [];
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
        spawnParticles(this, x, y, color, count);
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
