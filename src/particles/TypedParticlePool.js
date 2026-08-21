/**
 * Zero-Allocation Struct-of-Arrays (SoA) Typed Particle Pool
 * High-performance particle engine using contiguous TypedArrays to eliminate GC churn.
 */

// Helper to convert hex / rgba strings or numbers to packed Uint32 (ABGR / RGBA format)
function parseColorToUint32(color) {
    if (typeof color === 'number') {
        return color >>> 0;
    }
    if (typeof color === 'string') {
        if (color.startsWith('#')) {
            let hex = color.slice(1);
            if (hex.length === 3) {
                hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + 'ff';
            } else if (hex.length === 6) {
                hex = hex + 'ff';
            }
            const num = parseInt(hex, 16);
            return num >>> 0;
        }
        if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (match && match.length >= 3) {
                const r = parseInt(match[0], 10);
                const g = parseInt(match[1], 10);
                const b = parseInt(match[2], 10);
                const a = match.length >= 4 ? Math.round(parseFloat(match[3]) * 255) : 255;
                return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
            }
        }
    }
    return 0xffffffff;
}

export class TypedParticlePool {
    constructor(capacity = 500) {
        this.capacity = capacity;

        // SoA Contiguous TypedArrays
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.life = new Float32Array(capacity);
        this.decay = new Float32Array(capacity);
        this.size = new Float32Array(capacity);
        this.color = new Uint32Array(capacity);

        // Active index mapping (dense active list for O(1) swap-and-pop removal)
        this.activeIndices = new Uint16Array(capacity);
        this.activeCount = 0;

        // Free list stack for O(1) allocation
        this.freeList = new Uint16Array(capacity);
        this.freeCount = capacity;
        for (let i = 0; i < capacity; i++) {
            this.freeList[i] = capacity - 1 - i;
        }

        // Cache object pool for getActiveParticles() to avoid allocating particle wrapper objects
        this._particleProxies = [];
        for (let i = 0; i < capacity; i++) {
            this._particleProxies.push({
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                decay: 0,
                size: 0,
                color: 0,
                index: i,
            });
        }
    }

    /**
     * Get number of currently active particles
     */
    getActiveCount() {
        return this.activeCount;
    }

    /**
     * Acquire a slot for a particle. If full, safely recycles the oldest active particle.
     */
    acquire() {
        let index;
        if (this.freeCount > 0) {
            index = this.freeList[--this.freeCount];
            this.activeIndices[this.activeCount++] = index;
        } else {
            // Over-capacity: recycle oldest active particle (at index 0 in activeIndices)
            // Shift oldest to the end of active list or reuse slot
            index = this.activeIndices[0];
            // Rotate activeIndices so oldest is moved to the back
            for (let i = 0; i < this.activeCount - 1; i++) {
                this.activeIndices[i] = this.activeIndices[i + 1];
            }
            this.activeIndices[this.activeCount - 1] = index;
        }
        return index;
    }

    /**
     * Spawn a particle with attributes
     */
    spawn(options = {}) {
        const index = this.acquire();
        this.x[index] = options.x || 0;
        this.y[index] = options.y || 0;
        this.vx[index] = options.vx || 0;
        this.vy[index] = options.vy || 0;
        this.size[index] = options.size !== undefined ? options.size : 2.0;
        this.life[index] = options.life !== undefined ? options.life : 1.0;
        this.decay[index] = options.decay !== undefined ? options.decay : 0.02;
        this.color[index] = parseColorToUint32(options.color);
        return index;
    }

    /**
     * Release/kill a particle by index
     */
    release(particleIndex) {
        // Find index in activeIndices
        for (let i = 0; i < this.activeCount; i++) {
            if (this.activeIndices[i] === particleIndex) {
                // Swap with last active
                this.activeIndices[i] = this.activeIndices[this.activeCount - 1];
                this.activeCount--;
                this.freeList[this.freeCount++] = particleIndex;
                break;
            }
        }
    }

    /**
     * Update physics and life for all active particles
     */
    update(logicalWidth, logicalHeight) {
        const floor = logicalHeight - 10;
        let i = 0;
        while (i < this.activeCount) {
            const idx = this.activeIndices[i];

            // Drag
            this.vx[idx] *= 0.98;
            this.vy[idx] *= 0.98;

            // Step position
            this.x[idx] += this.vx[idx];
            this.y[idx] += this.vy[idx];

            // Gravity
            this.vy[idx] += 0.15;

            // Bottom boundary bounce
            if (this.y[idx] > floor) {
                this.y[idx] = floor;
                this.vy[idx] *= -0.5;
                this.vx[idx] *= 0.8;
            }

            // Life decay
            this.life[idx] -= this.decay[idx];

            if (this.life[idx] <= 0) {
                // Reclaim expired particle via swap with last active
                this.activeIndices[i] = this.activeIndices[this.activeCount - 1];
                this.activeCount--;
                this.freeList[this.freeCount++] = idx;
                // Do not increment i, re-evaluate swapped index
            } else {
                i++;
            }
        }
    }

    /**
     * Returns an array of active particle proxy objects without allocating new objects
     */
    getActiveParticles() {
        const result = [];
        for (let i = 0; i < this.activeCount; i++) {
            const idx = this.activeIndices[i];
            const p = this._particleProxies[idx];
            p.x = this.x[idx];
            p.y = this.y[idx];
            p.vx = this.vx[idx];
            p.vy = this.vy[idx];
            p.life = this.life[idx];
            p.decay = this.decay[idx];
            p.size = this.size[idx];
            p.color = this.color[idx];
            result.push(p);
        }
        return result;
    }

    /**
     * Reset and clear all active particles
     */
    clear() {
        this.activeCount = 0;
        this.freeCount = this.capacity;
        for (let i = 0; i < this.capacity; i++) {
            this.freeList[i] = this.capacity - 1 - i;
        }
    }
}
