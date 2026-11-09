/**
 * SpriteSparks - tiny pooled spark burst for the home sprite playground.
 *
 * Game-feel "juice": a tap, grab or fling answers with a quick shower of
 * sparks so the touch is acknowledged on the frame it happens, not only by
 * sound. Fixed capacity (no unbounded growth), no per-frame allocation once
 * the pool is warm, and it draws with plain `arc`/`fill` only.
 *
 * @module ui/sprite-sparks
 */

export const SPARK_CAPACITY = 160;

/** Per-step velocity retention (60 Hz step). Lower = sparks stop sooner. */
const DRAG = 0.93;

export class SpriteSparks {
    constructor(capacity = SPARK_CAPACITY) {
        this.capacity = Math.max(1, capacity | 0);
        this.items = [];
        this.cursor = 0;
    }

    get length() {
        return this.items.length;
    }

    /**
     * Emit `count` sparks from a point.
     *
     * @param {number} x
     * @param {number} y
     * @param {string} color CSS colour (already contrast-checked by the caller)
     * @param {{count?: number, speed?: number, driftX?: number, driftY?: number, rng?: () => number}} [opts]
     */
    burst(x, y, color, opts = {}) {
        const { count = 8, speed = 3, driftX = 0, driftY = 0, rng = Math.random } = opts;
        for (let i = 0; i < count; i++) {
            const angle = rng() * Math.PI * 2;
            const v = speed * (0.35 + rng() * 0.65);
            this.#place({
                x,
                y,
                vx: Math.cos(angle) * v + driftX,
                vy: Math.sin(angle) * v + driftY,
                life: 1,
                decay: 0.03 + rng() * 0.03,
                size: 1.2 + rng() * 1.8,
                color,
            });
        }
    }

    #place(spark) {
        if (this.items.length < this.capacity) {
            this.items.push(spark);
            return;
        }
        // Pool is full: recycle the oldest slot rather than grow.
        this.items[this.cursor] = spark;
        this.cursor = (this.cursor + 1) % this.capacity;
    }

    /** Advance one fixed 60 Hz step and drop the dead. */
    update() {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const s = this.items[i];
            s.x += s.vx;
            s.y += s.vy;
            s.vx *= DRAG;
            s.vy *= DRAG;
            s.life -= s.decay;
            if (s.life <= 0) {
                const last = this.items.pop();
                if (i < this.items.length) this.items[i] = last;
            }
        }
        if (this.cursor >= this.items.length) this.cursor = 0;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{additive?: boolean}} [opts] additive glow reads on the dark
     *   backdrop only; on the light theme it would bleach to white.
     */
    render(ctx, { additive = false } = {}) {
        if (this.items.length === 0) return;
        ctx.save();
        if (additive) ctx.globalCompositeOperation = 'lighter';
        for (const s of this.items) {
            ctx.globalAlpha = Math.max(0, s.life * s.life);
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * (0.4 + 0.6 * s.life), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    clear() {
        this.items.length = 0;
        this.cursor = 0;
    }
}

/** Safe haptic vibration wrapper (vibrates only when hardware/browser allows). */
export function triggerHaptic(pattern = 10) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
            navigator.vibrate(pattern);
        } catch (_e) {
            // Ignore devices without haptics
        }
    }
}
