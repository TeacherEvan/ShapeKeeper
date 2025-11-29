/**
 * ShapeKeeper Square Animation System
 * Handles square completion animations and visual feedback
 * @module animations/SquareAnimations
 */

import { ANIMATION } from '../core/constants.js';

/**
 * Square animation data
 * @typedef {Object} SquareAnimation
 * @property {string} key - Square key "row,col"
 * @property {number} startTime - Animation start timestamp
 * @property {number} duration - Animation duration (ms)
 * @property {number} progress - Current progress (0-1)
 * @property {string} color - Square color
 * @property {string} type - Animation type ('scale', 'pulse', 'glow')
 */

/**
 * Pulsating line animation data
 * @typedef {Object} PulsatingLine
 * @property {string} key - Line key
 * @property {number} startTime - Animation start timestamp
 * @property {number} duration - Animation duration (ms)
 * @property {string} color - Line color
 */

export class SquareAnimationSystem {
    constructor() {
        this.squareAnimations = [];
        this.pulsatingLines = [];
        this.screenShake = { x: 0, y: 0, intensity: 0 };
        this.comboCount = 0;
        this.lastSquareTime = 0;
    }

    /**
     * Start a square completion animation
     * @param {string} squareKey - Square key "row,col"
     * @param {string} color - Square color
     * @param {number} comboMultiplier - Current combo count
     */
    addSquareAnimation(squareKey, color, comboMultiplier = 1) {
        const now = performance.now();
        
        // Update combo
        if (now - this.lastSquareTime < 2000) {
            this.comboCount++;
        } else {
            this.comboCount = 1;
        }
        this.lastSquareTime = now;

        this.squareAnimations.push({
            key: squareKey,
            startTime: now,
            duration: ANIMATION.SQUARE_DURATION,
            progress: 0,
            color,
            type: 'scale',
            combo: this.comboCount
        });

        // Add screen shake for multi-completions
        if (comboMultiplier > 1 || this.comboCount > 2) {
            this.triggerScreenShake(Math.min(this.comboCount * 2, 10));
        }
    }

    /**
     * Add pulsating line animation
     * @param {string} lineKey - Line key
     * @param {string} color - Line color
     */
    addPulsatingLine(lineKey, color) {
        this.pulsatingLines.push({
            key: lineKey,
            startTime: performance.now(),
            duration: ANIMATION.LINE_PULSE_DURATION,
            color
        });
    }

    /**
     * Trigger screen shake effect
     * @param {number} intensity - Shake intensity (1-10)
     */
    triggerScreenShake(intensity = 5) {
        this.screenShake.intensity = intensity;
    }

    /**
     * Update all animations
     * @param {number} currentTime - Current timestamp (performance.now())
     */
    update(currentTime = performance.now()) {
        // Update square animations
        for (let i = this.squareAnimations.length - 1; i >= 0; i--) {
            const anim = this.squareAnimations[i];
            const elapsed = currentTime - anim.startTime;
            anim.progress = Math.min(elapsed / anim.duration, 1);
            
            if (anim.progress >= 1) {
                this.squareAnimations.splice(i, 1);
            }
        }

        // Update pulsating lines
        for (let i = this.pulsatingLines.length - 1; i >= 0; i--) {
            const line = this.pulsatingLines[i];
            const elapsed = currentTime - line.startTime;
            
            if (elapsed >= line.duration) {
                this.pulsatingLines.splice(i, 1);
            }
        }

        // Update screen shake
        if (this.screenShake.intensity > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
            this.screenShake.intensity *= 0.9; // Decay
            
            if (this.screenShake.intensity < 0.5) {
                this.screenShake.intensity = 0;
                this.screenShake.x = 0;
                this.screenShake.y = 0;
            }
        }
    }

    /**
     * Get scale for animating square
     * @param {string} squareKey - Square key
     * @returns {number} Scale factor (0-1)
     */
    getSquareScale(squareKey) {
        const anim = this.squareAnimations.find(a => a.key === squareKey);
        if (!anim) return 1;
        
        // Ease out bounce effect
        const t = anim.progress;
        if (t < 0.4) {
            // Scale up with overshoot
            return this.easeOutBack(t / 0.4) * 1.1;
        } else {
            // Settle to 1
            return 1.1 - 0.1 * ((t - 0.4) / 0.6);
        }
    }

    /**
     * Get glow intensity for pulsating line
     * @param {string} lineKey - Line key
     * @returns {number} Glow intensity (0-1)
     */
    getLineGlow(lineKey) {
        const line = this.pulsatingLines.find(l => l.key === lineKey);
        if (!line) return 0;
        
        const elapsed = performance.now() - line.startTime;
        const progress = elapsed / line.duration;
        
        // Pulse effect
        return Math.sin(progress * Math.PI) * (1 - progress);
    }

    /**
     * Check if line is pulsating
     * @param {string} lineKey - Line key
     * @returns {boolean}
     */
    isLinePulsating(lineKey) {
        return this.pulsatingLines.some(l => l.key === lineKey);
    }

    /**
     * Get screen shake offset
     * @returns {{x: number, y: number}}
     */
    getScreenShake() {
        return { x: this.screenShake.x, y: this.screenShake.y };
    }

    /**
     * Get current combo count
     * @returns {number}
     */
    getComboCount() {
        return this.comboCount;
    }

    /**
     * Reset combo counter
     */
    resetCombo() {
        this.comboCount = 0;
    }

    /**
     * Ease out back function for bounce effect
     * @param {number} t - Progress (0-1)
     * @returns {number}
     */
    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    /**
     * Ease out elastic for extra bounce
     * @param {number} t - Progress (0-1)
     * @returns {number}
     */
    easeOutElastic(t) {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    }

    /**
     * Clear all animations
     */
    clear() {
        this.squareAnimations = [];
        this.pulsatingLines = [];
        this.screenShake = { x: 0, y: 0, intensity: 0 };
        this.comboCount = 0;
    }

    /**
     * Get stats for debugging
     * @returns {Object}
     */
    getStats() {
        return {
            squares: this.squareAnimations.length,
            lines: this.pulsatingLines.length,
            combo: this.comboCount,
            shaking: this.screenShake.intensity > 0
        };
    }
}
