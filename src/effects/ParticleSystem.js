/**
 * ShapeKeeper Particle System
 * Handles particle effects, ambient particles, and visual bursts
 * @module effects/ParticleSystem
 */

import { PARTICLES } from '../core/constants.js';

/**
 * Individual particle data structure
 * @typedef {Object} Particle
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} vx - X velocity
 * @property {number} vy - Y velocity
 * @property {number} radius - Current radius
 * @property {number} maxRadius - Maximum radius
 * @property {number} life - Remaining life (0-1)
 * @property {number} decay - Life decay rate
 * @property {string} color - Particle color
 * @property {number} opacity - Current opacity
 * @property {boolean} hasTrail - Whether particle has trail
 * @property {Array<{x: number, y: number}>} trail - Trail positions
 */

/**
 * Ambient particle data structure
 * @typedef {Object} AmbientParticle
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} vx - X velocity
 * @property {number} vy - Y velocity
 * @property {number} radius - Particle radius
 * @property {number} opacity - Current opacity
 * @property {number} maxOpacity - Maximum opacity
 * @property {number} phase - Animation phase
 */

export class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.particles = [];
        this.ambientParticles = [];
        this.isActive = true;
    }

    /**
     * Initialize ambient background particles
     * @param {number} count - Number of ambient particles
     */
    initAmbientParticles(count = PARTICLES.AMBIENT_COUNT) {
        this.ambientParticles = [];
        for (let i = 0; i < count; i++) {
            this.ambientParticles.push(this.createAmbientParticle());
        }
    }

    /**
     * Create a single ambient particle
     * @returns {AmbientParticle}
     */
    createAmbientParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: Math.random() * 3 + 1,
            opacity: 0,
            maxOpacity: Math.random() * 0.3 + 0.1,
            phase: Math.random() * Math.PI * 2
        };
    }

    /**
     * Create particle burst at position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} color - Base color for particles
     * @param {number} count - Number of particles
     * @param {number} comboMultiplier - Multiplier based on combo
     */
    createBurst(x, y, color, count = PARTICLES.BURST_COUNT, comboMultiplier = 1) {
        const particleCount = Math.floor(count * Math.min(comboMultiplier, 3));
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
            const speed = PARTICLES.SPEED_MIN + Math.random() * (PARTICLES.SPEED_MAX - PARTICLES.SPEED_MIN);
            const speedMultiplier = 1 + (comboMultiplier - 1) * 0.3;
            
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed * speedMultiplier,
                vy: Math.sin(angle) * speed * speedMultiplier,
                radius: PARTICLES.RADIUS_MIN + Math.random() * (PARTICLES.RADIUS_MAX - PARTICLES.RADIUS_MIN),
                maxRadius: PARTICLES.RADIUS_MAX * 1.5,
                life: 1,
                decay: PARTICLES.DECAY_MIN + Math.random() * (PARTICLES.DECAY_MAX - PARTICLES.DECAY_MIN),
                color: this.varyColor(color),
                opacity: 1,
                hasTrail: Math.random() > 0.5,
                trail: []
            });
        }
    }

    /**
     * Create sparkle effect at position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} color - Sparkle color
     * @param {number} count - Number of sparkles
     */
    createSparkles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 30;
            
            this.particles.push({
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3 - 1,
                radius: 2 + Math.random() * 2,
                maxRadius: 4,
                life: 1,
                decay: 0.03 + Math.random() * 0.02,
                color: color,
                opacity: 1,
                hasTrail: false,
                trail: [],
                isSparkle: true
            });
        }
    }

    /**
     * Create trail effect for line drawing
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {string} color - Trail color
     */
    createLineTrail(x1, y1, x2, y2, color) {
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const count = Math.floor(distance / 15);
        
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            
            setTimeout(() => {
                this.createSparkles(x, y, color, 3);
            }, i * 20);
        }
    }

    /**
     * Update all particles
     * @param {number} deltaTime - Time since last update (ms)
     */
    update(deltaTime = 16) {
        // Update burst particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Update trail
            if (p.hasTrail && p.trail) {
                p.trail.unshift({ x: p.x, y: p.y });
                if (p.trail.length > PARTICLES.TRAIL_LENGTH) {
                    p.trail.pop();
                }
            }
            
            // Apply physics
            p.x += p.vx;
            p.y += p.vy;
            p.vy += PARTICLES.GRAVITY;
            p.vx *= PARTICLES.FRICTION;
            p.vy *= PARTICLES.FRICTION;
            
            // Update life
            p.life -= p.decay;
            p.opacity = p.life;
            p.radius = p.maxRadius * p.life;
            
            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update ambient particles
        this.updateAmbient();
    }

    /**
     * Update ambient background particles
     */
    updateAmbient() {
        for (const p of this.ambientParticles) {
            p.x += p.vx;
            p.y += p.vy;
            p.phase += 0.02;
            p.opacity = p.maxOpacity * (0.5 + 0.5 * Math.sin(p.phase));
            
            // Wrap around screen
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
        }
    }

    /**
     * Draw all particles
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        // Draw ambient particles first (background)
        this.drawAmbient(ctx);
        
        // Draw burst particles
        for (const p of this.particles) {
            // Draw trail
            if (p.hasTrail && p.trail && p.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let j = 1; j < p.trail.length; j++) {
                    ctx.lineTo(p.trail[j].x, p.trail[j].y);
                }
                ctx.strokeStyle = `rgba(${this.hexToRgb(p.color)}, ${p.opacity * 0.3})`;
                ctx.lineWidth = p.radius * 0.5;
                ctx.stroke();
            }
            
            // Draw particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, p.radius), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.hexToRgb(p.color)}, ${p.opacity})`;
            ctx.fill();
            
            // Add glow for sparkles
            if (p.isSparkle) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    }

    /**
     * Draw ambient particles
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    drawAmbient(ctx) {
        for (const p of this.ambientParticles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 200, 220, ${p.opacity})`;
            ctx.fill();
        }
    }

    /**
     * Vary a color slightly for visual variety
     * @param {string} baseColor - Base hex color
     * @returns {string} Varied hex color
     */
    varyColor(baseColor) {
        const variation = 30;
        const rgb = this.hexToRgb(baseColor);
        if (!rgb) return baseColor;
        
        const parts = rgb.split(',').map(n => parseInt(n.trim()));
        const varied = parts.map(c => 
            Math.max(0, Math.min(255, c + (Math.random() - 0.5) * variation))
        );
        
        return `#${varied.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
    }

    /**
     * Convert hex color to RGB string
     * @param {string} hex - Hex color
     * @returns {string} RGB values as "r, g, b"
     */
    hexToRgb(hex) {
        if (!hex) return '255, 255, 255';
        
        // Handle rgba format
        if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
            const match = hex.match(/\d+/g);
            if (match && match.length >= 3) {
                return `${match[0]}, ${match[1]}, ${match[2]}`;
            }
        }
        
        // Handle hex format
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
        }
        
        return '255, 255, 255';
    }

    /**
     * Clear all particles
     */
    clear() {
        this.particles = [];
    }

    /**
     * Clear all including ambient
     */
    clearAll() {
        this.particles = [];
        this.ambientParticles = [];
    }

    /**
     * Resize handler - reinitialize ambient particles
     */
    onResize() {
        this.initAmbientParticles();
    }

    /**
     * Get particle count for debugging
     * @returns {{burst: number, ambient: number}}
     */
    getStats() {
        return {
            burst: this.particles.length,
            ambient: this.ambientParticles.length
        };
    }
}
