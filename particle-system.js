/**
 * ShapeKeeper - Particle System
 * Particle creation and management for visual effects
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { GAME_CONSTANTS } from './constants.js';

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.ambientParticles = [];
        this.initializeAmbientParticles();
    }

    /**
     * Initialize ambient floating particles
     */
    initializeAmbientParticles() {
        this.ambientParticles = [];
        for (let i = 0; i < GAME_CONSTANTS.AMBIENT_PARTICLE_COUNT; i++) {
            this.ambientParticles.push(this.createAmbientParticle());
        }
    }

    /**
     * Create a single ambient particle
     */
    createAmbientParticle(atEdge = false) {
        const w = 800; // Default width, will be updated by game
        const h = 600; // Default height, will be updated by game

        return {
            x: atEdge ? (Math.random() < 0.5 ? 0 : w) : Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: 1 + Math.random() * 2,
            opacity: 0.1 + Math.random() * 0.15,
            phase: Math.random() * Math.PI * 2, // For sine wave motion
        };
    }

    /**
     * Update particle physics
     */
    updateParticles(logicalWidth, logicalHeight) {
        // Update ambient particles
        for (let i = 0; i < this.ambientParticles.length; i++) {
            const p = this.ambientParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            // Wrap at boundaries (branchless optimization)
            if (p.x < -10) p.x = logicalWidth + 10;
            else if (p.x > logicalWidth + 10) p.x = -10;
            if (p.y < -10) p.y = logicalHeight + 10;
            else if (p.y > logicalHeight + 10) p.y = -10;
        }

        // Update effect particles
        let writeIndex = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            // Update trail history
            if (!p.trail) p.trail = [];
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > GAME_CONSTANTS.PARTICLE_TRAIL_LENGTH) {
                p.trail.shift();
            }

            // Physics: air resistance + gravity
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;

            // Bounce at bottom boundary
            if (p.y > logicalHeight - 10 && !p.smoke) {
                p.y = logicalHeight - 10;
                p.vy *= -0.5;
                p.vx *= 0.8;
            }

            p.life -= p.decay;

            // Keep alive particles (in-place compaction)
            if (p.life > 0) {
                this.particles[writeIndex++] = p;
            }
        }
        this.particles.length = writeIndex;
    }

    /**
     * Spawn particles at a given position
     */
    spawnParticles(x, y, color, count = GAME_CONSTANTS.PARTICLE_COUNT_SQUARE) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 1 + Math.random() * 2; // Reduced from 2 + Math.random() * 3

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: 1.5 + Math.random() * 2, // Reduced from 3 + Math.random() * 4
                life: 1.0,
                decay: 0.015 + Math.random() * 0.01,
            });
        }
    }

    /**
     * Spawn sparkle emojis at a given position
     */
    spawnSparkleEmojis(x, y, count = 3, cellSize = 20) {
        for (let i = 0; i < count; i++) {
            // Random position within and around the center
            const offsetRange = cellSize * 1.5;
            const randomX = x + (Math.random() - 0.5) * offsetRange;
            const randomY = y + (Math.random() - 0.5) * offsetRange;

            // Pick a random star/sparkle emoji
            const emojiIndex = Math.floor(Math.random() * GAME_CONSTANTS.SPARKLE_EMOJIS.length);
            const emoji = GAME_CONSTANTS.SPARKLE_EMOJIS[emojiIndex];

            this.sparkleEmojis.push({
                x: randomX,
                y: randomY,
                emoji: emoji,
                startTime: Date.now() + Math.random() * 150,
                duration: GAME_CONSTANTS.ANIMATION_KISS_DURATION + Math.random() * 300,
                scale: 0.4 + Math.random() * 0.4,
            });
        }
    }

    /**
     * Create multiplier effect particles
     */
    createMultiplierParticles(x, y, multiplierValue) {
        // Create sparks effect
        const sparkCount = GAME_CONSTANTS.PARTICLE_COUNT_MULTIPLIER_SPARKS;
        for (let i = 0; i < sparkCount; i++) {
            const angle = (Math.PI * 2 * i) / sparkCount;
            const speed = 2 + Math.random() * 3;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1, // Slight upward bias
                color: '#FFD700', // Gold color for multipliers
                size: 2 + Math.random() * 3,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.01,
                spark: true,
            });
        }

        // Create smoke effect
        const smokeCount = GAME_CONSTANTS.PARTICLE_COUNT_MULTIPLIER_SMOKE;
        for (let i = 0; i < smokeCount; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random() * 1.5,
                color: '#888888',
                size: 5 + Math.random() * 5,
                life: 1.0,
                decay: 0.008,
                smoke: true,
            });
        }
    }

    /**
     * Create effect-specific particles
     */
    createEffectParticles(squareKey, effectData, parseSquareKey) {
        const { row, col } = parseSquareKey(squareKey);
        const centerX = 20 + (col + 0.5) * 20; // Approximate cell size
        const centerY = 20 + (row + 0.5) * 20;
        const color = effectData.effect.color;

        // Burst of themed particles
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const speed = 2 + Math.random() * 2;

            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.02,
                trail: [],
                spark: effectData.type === 'powerup',
            });
        }
    }

    /**
     * Create landmine explosion particles
     */
    createLandmineParticles(squareKey, parseSquareKey) {
        const { row, col } = parseSquareKey(squareKey);
        const centerX = 20 + (col + 0.5) * 20;
        const centerY = 20 + (row + 0.5) * 20;

        // Explosion particles
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;

            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: ['#FF4444', '#FF8800', '#FFDD00'][Math.floor(Math.random() * 3)],
                size: 4 + Math.random() * 6,
                life: 1.0,
                decay: 0.02,
                trail: [],
            });
        }

        // Smoke particles
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: centerX + (Math.random() - 0.5) * 20,
                y: centerY + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 2,
                vy: -2 - Math.random() * 2,
                color: '#333333',
                size: 8 + Math.random() * 8,
                life: 1.0,
                decay: 0.01,
                smoke: true,
            });
        }
    }

    /**
     * Create freeze animation particles
     */
    createFreezeParticles() {
        // Ice blue particles across the screen
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: Math.random() * 800,
                y: -20,
                vx: (Math.random() - 0.5) * 2,
                vy: 2 + Math.random() * 2,
                color: '#03A9F4',
                size: 3 + Math.random() * 4,
                life: 1.0,
                decay: 0.01,
                spark: true,
            });
        }
    }

    /**
     * Create score swap animation particles
     */
    createSwapParticles() {
        // Swirling particles
        for (let i = 0; i < 40; i++) {
            const angle = (Math.PI * 2 * i) / 40;
            const radius = 50 + Math.random() * 50;

            this.particles.push({
                x: 400 + Math.cos(angle) * radius,
                y: 300 + Math.sin(angle) * radius,
                vx: Math.cos(angle + Math.PI / 2) * 3,
                vy: Math.sin(angle + Math.PI / 2) * 3,
                color: '#673AB7',
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.015,
                trail: [],
            });
        }
    }

    /**
     * Create reverse turn animation particles
     */
    createReverseParticles() {
        // Spinning arrow particles
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;

            this.particles.push({
                x: 400,
                y: 300,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                color: '#E91E63',
                size: 4,
                life: 1.0,
                decay: 0.02,
                trail: [],
            });
        }
    }

    /**
     * Create chaos storm particles
     */
    createChaosParticles() {
        // Tornado particles
        for (let i = 0; i < 60; i++) {
            const angle = (Math.PI * 2 * i) / 60;
            const radius = 30 + i * 2;

            this.particles.push({
                x: 400 + Math.cos(angle) * radius,
                y: 300 + Math.sin(angle) * radius,
                vx: Math.cos(angle + Math.PI / 2) * 5,
                vy: Math.sin(angle + Math.PI / 2) * 5 - 1,
                color: '#FF5722',
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.015,
                trail: [],
            });
        }
    }

    /**
     * Create generic powerup particles
     */
    createPowerupParticles(squareKey, color, parseSquareKey) {
        const { row, col } = parseSquareKey(squareKey);
        const centerX = 20 + (col + 0.5) * 20;
        const centerY = 20 + (row + 0.5) * 20;

        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;

            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                color: color,
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.015,
                spark: true,
                trail: [],
            });
        }
    }

    /**
     * Create shield animation particles
     */
    createShieldParticles() {
        // Blue shield particles
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: 400,
                y: 300,
                vx: Math.cos(Math.random() * Math.PI * 2) * 2,
                vy: Math.sin(Math.random() * Math.PI * 2) * 2,
                color: '#3F51B5',
                size: 4,
                life: 1.0,
                decay: 0.02,
                spark: true,
            });
        }
    }

    /**
     * Create lightning animation particles
     */
    createLightningParticles() {
        // Yellow electric particles
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: Math.random() * 800,
                y: 0,
                vx: (Math.random() - 0.5) * 4,
                vy: 5 + Math.random() * 5,
                color: '#FFEB3B',
                size: 2 + Math.random() * 3,
                life: 1.0,
                decay: 0.03,
                spark: true,
                trail: [],
            });
        }
    }

    /**
     * Create gift animation particles
     */
    createGiftParticles() {
        // Hearts floating up
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: 400 + (Math.random() - 0.5) * 100,
                y: 300,
                vx: (Math.random() - 0.5) * 2,
                vy: -2 - Math.random() * 2,
                color: '#E91E63',
                size: 4,
                life: 1.0,
                decay: 0.015,
                spark: true,
            });
        }
    }

    /**
     * Create steal territory animation particles
     */
    createStealParticles(squareKey, parseSquareKey) {
        const { row, col } = parseSquareKey(squareKey);
        const centerX = 20 + (col + 0.5) * 20;
        const centerY = 20 + (row + 0.5) * 20;

        // Pirate-themed particles
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;

            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: '#2196F3',
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.02,
                trail: [],
            });
        }
    }

    /**
     * Create wildcard animation particles
     */
    createWildcardParticles(squareKey, parseSquareKey) {
        const { row, col } = parseSquareKey(squareKey);
        const centerX = 20 + (col + 0.5) * 20;
        const centerY = 20 + (row + 0.5) * 20;

        // Rainbow particles
        const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'];
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;

            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 3 + Math.random() * 4,
                life: 1.0,
                decay: 0.015,
                spark: true,
                trail: [],
            });
        }
    }

    /**
     * Create bonus turn visual particles
     */
    createBonusTurnParticles() {
        // Sparkle particles
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;

            this.particles.push({
                x: 400,
                y: 300,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: '#FFD700',
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.02,
                spark: true,
            });
        }
    }

    /**
     * Create skip turn visual particles
     */
    createSkipTurnParticles() {
        // Ice particles
        for (let i = 0; i < 25; i++) {
            this.particles.push({
                x: Math.random() * 800,
                y: -10,
                vx: (Math.random() - 0.5) * 2,
                vy: 3 + Math.random() * 2,
                color: '#03A9F4',
                size: 3 + Math.random() * 3,
                life: 1.0,
                decay: 0.015,
                spark: true,
            });
        }
    }

    /**
     * Create double points visual particles
     */
    createDoublePointsParticles() {
        // Golden sparkle particles
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;

            this.particles.push({
                x: 400,
                y: 300,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                color: '#FFD700',
                size: 3 + Math.random() * 4,
                life: 1.0,
                decay: 0.015,
                spark: true,
                trail: [],
            });
        }
    }

    /**
     * Create double line reminder particles
     */
    createDoubleLineParticles() {
        // Electric yellow particles
        for (let i = 0; i < 25; i++) {
            this.particles.push({
                x: Math.random() * 800,
                y: -10,
                vx: (Math.random() - 0.5) * 3,
                vy: 4 + Math.random() * 3,
                color: '#FFEB3B',
                size: 2 + Math.random() * 3,
                life: 1.0,
                decay: 0.02,
                spark: true,
                trail: [],
            });
        }
    }

    /**
     * Create epic combo particles
     */
    createEpicParticles() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#FFD93D', '#6BCB77'];

        for (let i = 0; i < 50; i++) {
            const angle = (Math.PI * 2 * i) / 50;
            const speed = 3 + Math.random() * 4;
            const color = colors[Math.floor(Math.random() * colors.length)];

            this.particles.push({
                x: 400,
                y: 300,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                color,
                size: 2 + Math.random() * 3,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.01,
                trail: [],
            });
        }
    }
}