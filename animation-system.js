/**
 * ShapeKeeper - Animation System
 * Animation management for squares, triangles, and effects
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { GAME_CONSTANTS } from './constants.js';
import { compactAnimationArray } from './utils.js';

export class AnimationSystem {
    constructor() {
        this.squareAnimations = [];
        this.sparkleEmojis = [];
        this.multiplierAnimations = [];
        this.effectAnimations = [];
        this.lineDrawings = [];
        this.touchVisuals = [];
        this.pulsatingLines = [];
        this.invalidLineFlash = null;
    }

    /**
     * Update all animations
     */
    updateAnimations(now) {
        // Clean up completed animations
        compactAnimationArray(
            this.pulsatingLines,
            now,
            (item) => now - item.time < GAME_CONSTANTS.ANIMATION_PULSATING_DURATION
        );
        compactAnimationArray(
            this.squareAnimations,
            now,
            (item) => now - item.startTime < item.duration
        );
        compactAnimationArray(
            this.touchVisuals,
            now,
            (item) => now - item.startTime < item.duration
        );
        compactAnimationArray(
            this.sparkleEmojis,
            now,
            (item) => now - item.startTime < item.duration
        );
        compactAnimationArray(
            this.lineDrawings,
            now,
            (item) => now - item.startTime < item.duration
        );

        if (this.multiplierAnimations?.length > 0) {
            compactAnimationArray(
                this.multiplierAnimations,
                now,
                (item) => now - item.startTime < item.duration
            );
        }

        // Clean up invalid line flash
        if (
            this.invalidLineFlash &&
            now - this.invalidLineFlash.startTime >= GAME_CONSTANTS.ANIMATION_INVALID_FLASH_DURATION
        ) {
            this.invalidLineFlash = null;
        }
    }

    /**
     * Trigger square animation
     */
    triggerSquareAnimation(
        squareKey,
        parseSquareKey,
        offsetX,
        offsetY,
        cellSize,
        playerColor,
        spawnParticles,
        spawnSparkleEmojis
    ) {
        const { row, col } = parseSquareKey(squareKey);
        const centerX = offsetX + (col + 0.5) * cellSize;
        const centerY = offsetY + (row + 0.5) * cellSize;

        // Add MULTIPLE star/sparkle emoji animations
        const sparkleCount =
            GAME_CONSTANTS.SPARKLE_EMOJI_MIN +
            Math.floor(
                Math.random() *
                    (GAME_CONSTANTS.SPARKLE_EMOJI_MAX - GAME_CONSTANTS.SPARKLE_EMOJI_MIN)
            );
        for (let i = 0; i < sparkleCount; i++) {
            // Random position within and around the square
            const offsetRange = cellSize * 2;
            const randomX = centerX + (Math.random() - 0.5) * offsetRange;
            const randomY = centerY + (Math.random() - 0.5) * offsetRange;

            // Pick a random star/sparkle emoji
            const emojiIndex = Math.floor(Math.random() * GAME_CONSTANTS.SPARKLE_EMOJIS.length);
            const emoji = GAME_CONSTANTS.SPARKLE_EMOJIS[emojiIndex];

            this.sparkleEmojis.push({
                x: randomX,
                y: randomY,
                emoji: emoji,
                startTime: Date.now() + Math.random() * 200, // Stagger start times
                duration: GAME_CONSTANTS.ANIMATION_KISS_DURATION + Math.random() * 500, // Varied durations
                scale: 0.5 + Math.random() * 0.5, // Varied sizes
            });
        }

        // Add square scale animation
        this.squareAnimations.push({
            squareKey,
            startTime: Date.now(),
            duration: GAME_CONSTANTS.ANIMATION_SQUARE_DURATION,
            centerX,
            centerY,
        });

        // Create particle burst
        spawnParticles(centerX, centerY, playerColor, GAME_CONSTANTS.PARTICLE_COUNT_SQUARE);
    }

    /**
     * Trigger triangle animation
     */
    triggerTriangleAnimation(triangleKey, triangleData, playerColor, spawnParticles) {
        // Calculate center of triangle for animation
        const v = triangleData.vertices;
        const centerX = (v[0].x + v[1].x + v[2].x) / 3;
        const centerY = (v[0].y + v[1].y + v[2].y) / 3;

        // Add triangle animation (similar to square but with different color)
        this.squareAnimations.push({
            type: 'triangle',
            key: triangleKey,
            vertices: triangleData.vertices,
            centerX,
            centerY,
            startTime: Date.now(),
            duration: GAME_CONSTANTS.ANIMATION_SQUARE_DURATION,
            player: triangleData.player,
        });

        // Spawn particles at triangle center
        spawnParticles(centerX, centerY, playerColor, 10);
    }

    /**
     * Trigger multiplier animation
     */
    triggerMultiplierAnimation(
        squareKey,
        multiplierValue,
        parseSquareKey,
        offsetX,
        offsetY,
        cellSize,
        createMultiplierParticles
    ) {
        const { row, col } = parseSquareKey(squareKey);
        const centerX = offsetX + (col + 0.5) * cellSize;
        const centerY = offsetY + (row + 0.5) * cellSize;

        // Add multiplier text animation with sparks and smoke
        this.multiplierAnimations = this.multiplierAnimations || [];
        this.multiplierAnimations.push({
            squareKey,
            value: multiplierValue,
            startTime: Date.now(),
            duration: GAME_CONSTANTS.ANIMATION_MULTIPLIER_DURATION,
            centerX,
            centerY,
        });

        // Create multiplier particles
        createMultiplierParticles(centerX, centerY, multiplierValue);
    }

    /**
     * Trigger invalid line flash
     */
    triggerInvalidLineFlash(dot1, dot2, offsetX, offsetY, cellSize) {
        this.invalidLineFlash = {
            dot1,
            dot2,
            startTime: Date.now(),
            duration: GAME_CONSTANTS.ANIMATION_INVALID_FLASH_DURATION,
        };
    }

    /**
     * Add touch visual
     */
    addTouchVisual(x, y) {
        this.touchVisuals.push({
            x,
            y,
            id: Date.now(), // Simple ID for cleanup
            startTime: Date.now(),
            duration: 300,
        });
    }

    /**
     * Add line drawing animation
     */
    addLineDrawing(lineKey, startDot, endDot, player, ghost, offsetX, offsetY, cellSize) {
        this.lineDrawings.push({
            lineKey,
            startDot: {
                x: offsetX + startDot.col * cellSize,
                y: offsetY + startDot.row * cellSize,
            },
            endDot: {
                x: offsetX + endDot.col * cellSize,
                y: offsetY + endDot.row * cellSize,
            },
            player,
            startTime: Date.now(),
            duration: GAME_CONSTANTS.ANIMATION_LINE_DRAW_DURATION,
            ghost,
        });
    }

    /**
     * Add pulsating line
     */
    addPulsatingLine(lineKey, player, ghost) {
        this.pulsatingLines.push({
            line: lineKey,
            player,
            time: Date.now(),
            ghost,
        });
    }

    /**
     * Trigger effect animation
     */
    triggerEffectAnimation(type, player, duration = 2000) {
        this.effectAnimations.push({
            type,
            player,
            startTime: Date.now(),
            duration,
        });
    }

    /**
     * Get active animations for rendering
     */
    getActiveAnimations() {
        return {
            squareAnimations: this.squareAnimations,
            sparkleEmojis: this.sparkleEmojis,
            multiplierAnimations: this.multiplierAnimations,
            effectAnimations: this.effectAnimations,
            lineDrawings: this.lineDrawings,
            touchVisuals: this.touchVisuals,
            pulsatingLines: this.pulsatingLines,
            invalidLineFlash: this.invalidLineFlash,
        };
    }
}
