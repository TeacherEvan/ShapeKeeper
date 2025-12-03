/**
 * ShapeKeeper Sparkle Emoji Animation System
 * Handles animated emoji effects for square completions
 * @module animations/KissEmojiSystem
 */

/**
 * Sparkle emoji data structure
 * @typedef {Object} SparkleEmoji
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} vx - X velocity
 * @property {number} vy - Y velocity
 * @property {number} opacity - Current opacity
 * @property {number} scale - Current scale
 * @property {number} rotation - Current rotation
 * @property {number} rotationSpeed - Rotation velocity
 * @property {string} emoji - Emoji character
 */

export class KissEmojiSystem {
    constructor() {
        this.emojis = [];
        this.availableEmojis = ['✨', '⭐', '🌟', '💫', '🎇'];
    }

    /**
     * Create emoji burst at position
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} count - Number of emojis (5-8 typical)
     * @param {boolean} useSparklesOnly - Only use star/sparkle emojis
     */
    createBurst(x, y, count = 6, useSparklesOnly = true) {
        const emojisToUse = useSparklesOnly ? ['✨', '⭐', '🌟'] : this.availableEmojis;
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = 2 + Math.random() * 3;
            const delay = i * 50; // Stagger spawn
            
            setTimeout(() => {
                this.emojis.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 2, // Slight upward bias
                    opacity: 1,
                    scale: 0.5 + Math.random() * 0.5,
                    rotation: (Math.random() - 0.5) * 0.5,
                    rotationSpeed: (Math.random() - 0.5) * 0.1,
                    emoji: emojisToUse[Math.floor(Math.random() * emojisToUse.length)],
                    life: 1
                });
            }, delay);
        }
    }

    /**
     * Create celebration burst (more emojis, varied types)
     * @param {number} x - Center X
     * @param {number} y - Center Y
     */
    createCelebration(x, y) {
        this.createBurst(x, y, 12, false);
    }

    /**
     * Update all emojis
     * @param {number} deltaTime - Time since last update (ms)
     */
    update(deltaTime = 16) {
        for (let i = this.emojis.length - 1; i >= 0; i--) {
            const e = this.emojis[i];
            
            // Apply physics
            e.x += e.vx;
            e.y += e.vy;
            e.vy += 0.05; // Gentle gravity
            e.vx *= 0.98; // Friction
            e.rotation += e.rotationSpeed;
            
            // Fade out
            e.life -= 0.015;
            e.opacity = Math.max(0, e.life);
            e.scale *= 0.995; // Shrink slightly
            
            // Remove dead emojis
            if (e.life <= 0) {
                this.emojis.splice(i, 1);
            }
        }
    }

    /**
     * Draw all emojis
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        ctx.save();
        
        for (const e of this.emojis) {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.rotation);
            ctx.scale(e.scale, e.scale);
            ctx.globalAlpha = e.opacity;
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(e.emoji, 0, 0);
            ctx.restore();
        }
        
        ctx.restore();
    }

    /**
     * Clear all emojis
     */
    clear() {
        this.emojis = [];
    }

    /**
     * Get count for debugging
     * @returns {number}
     */
    getCount() {
        return this.emojis.length;
    }
}
