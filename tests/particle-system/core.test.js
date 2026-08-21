import { describe, it, expect } from 'vitest';
import {
    initializeAmbientParticles,
    createAmbientParticle,
    createParticlePool,
    spawnParticlesFromPool,
    updateParticlesFromPool,
    updateParticles,
} from '../../particle-system/core.js';
import { GAME_CONSTANTS } from '../../constants.js';

describe('particle-system/core', () => {
    it('initializeAmbientParticles spans the real board dimensions (AUD-3 fix)', () => {
        const system = { logicalWidth: 1200, logicalHeight: 900 };
        initializeAmbientParticles(system);
        expect(system.ambientParticles.length).toBe(GAME_CONSTANTS.AMBIENT_PARTICLE_COUNT);
        // Every ambient particle must live inside the configured board box,
        // not the old hardcoded 800x600.
        const outOfBounds = system.ambientParticles.filter((p) => p.x > 1200 || p.y > 900);
        expect(outOfBounds.length).toBe(0);
    });

    it('falls back to 800x600 only when dimensions are absent', () => {
        const system = {};
        initializeAmbientParticles(system);
        const outOfBounds = system.ambientParticles.filter((p) => p.x > 800 || p.y > 600);
        expect(outOfBounds.length).toBe(0);
    });

    it('particle pool acquires and releases objects without leaking', () => {
        const pool = createParticlePool(200);
        const p = pool.acquire();
        expect(pool.activeCount()).toBe(1);
        pool.release(p);
        expect(pool.activeCount()).toBe(0);
        expect(pool.poolSize()).toBeGreaterThanOrEqual(1); // recycled, not discarded
    });

    it('spawnParticlesFromPool honours the requested count and stays in active set', () => {
        const pool = createParticlePool(200);
        const spawned = spawnParticlesFromPool(pool, 10, 10, '#fff', 12);
        expect(spawned).toBe(12);
        expect(pool.activeCount()).toBe(12);
    });

    it('updateParticlesFromPool prunes dead particles (life<=0) by releasing them', () => {
        const pool = createParticlePool(200);
        spawnParticlesFromPool(pool, 10, 10, '#fff', 5);
        // Force every active particle to be expired.
        for (const p of pool.active) {
            p.life = 0;
            p.decay = 1;
        }
        updateParticlesFromPool(pool, 800, 600);
        expect(pool.activeCount()).toBe(0);
    });

    it('updateParticles compacts the system.particles array in place (no per-frame alloc)', () => {
        const system = {
            logicalWidth: 800,
            logicalHeight: 600,
            ambientParticles: [],
            particles: [
                { x: 1, y: 1, vx: 0, vy: 0, life: 0, decay: 1, trail: [] }, // dead
                { x: 2, y: 2, vx: 0, vy: 0, life: 1, decay: 0.01, trail: [] }, // alive
            ],
        };
        updateParticles(system, 800, 600);
        expect(system.particles.length).toBe(1);
        // The surviving particle had its life decayed by decay (0.01) this frame.
        expect(system.particles[0].life).toBeCloseTo(0.99, 5);
    });

    it('createAmbientParticle honours an explicit edge position', () => {
        const atEdge = createAmbientParticle(true, 800, 600);
        expect(atEdge.x === 0 || atEdge.x === 800).toBe(true);
    });
});
