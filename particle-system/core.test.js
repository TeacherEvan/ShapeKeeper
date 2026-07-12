import { describe, expect, it } from 'vitest';
import { createParticlePool, spawnParticlesFromPool, updateParticlesFromPool } from './core.js';

describe('particle object pool', () => {
    it('reuses dead particles instead of allocating new ones', () => {
        const pool = createParticlePool(10);
        const a = pool.acquire();
        const b = pool.acquire();
        expect(pool.activeCount()).toBe(2);
        expect(pool.poolSize()).toBe(2);

        // kill both and return to pool
        a.life = -1;
        b.life = -1;
        updateParticlesFromPool(pool, 800, 600);

        const _c = pool.acquire(); // should reuse, not grow pool
        expect(pool.activeCount()).toBe(1);
        expect(pool.poolSize()).toBe(2);
    });

    it('spawnParticlesFromPool returns particles to the pool after death', () => {
        const pool = createParticlePool(50);
        spawnParticlesFromPool(pool, 100, 100, '#FF0000', 15);
        expect(pool.activeCount()).toBe(15);
        // kill all
        for (const p of pool.active) p.life = -1;
        updateParticlesFromPool(pool, 800, 600);
        expect(pool.activeCount()).toBe(0);
        // reuse: spawning again should not grow total pool size beyond 15
        spawnParticlesFromPool(pool, 100, 100, '#FF0000', 15);
        expect(pool.poolSize()).toBe(15);
        expect(pool.activeCount()).toBe(15);
    });

    it('grows free list only up to capacity, then discards excess on release', () => {
        const pool = createParticlePool(2);
        const a = pool.acquire();
        const b = pool.acquire();
        const c = pool.acquire(); // 3rd exceeds capacity
        expect(pool.poolSize()).toBe(3);
        // release all; free list capped at 2, 3rd is discarded
        a.life = -1;
        b.life = -1;
        c.life = -1;
        updateParticlesFromPool(pool, 800, 600);
        expect(pool.poolSize()).toBe(2);
    });
});
