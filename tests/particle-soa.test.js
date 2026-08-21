import { describe, it, expect, beforeEach } from 'vitest';
import { TypedParticlePool } from '../src/particles/TypedParticlePool.js';

describe('TypedParticlePool (Zero-Allocation SoA)', () => {
    let pool;
    const CAPACITY = 10;

    beforeEach(() => {
        pool = new TypedParticlePool(CAPACITY);
    });

    describe('Pre-allocated fixed capacity', () => {
        it('initializes TypedArrays according to capacity', () => {
            expect(pool.capacity).toBe(CAPACITY);
            expect(pool.x).toBeInstanceOf(Float32Array);
            expect(pool.y).toBeInstanceOf(Float32Array);
            expect(pool.vx).toBeInstanceOf(Float32Array);
            expect(pool.vy).toBeInstanceOf(Float32Array);
            expect(pool.life).toBeInstanceOf(Float32Array);
            expect(pool.decay).toBeInstanceOf(Float32Array);
            expect(pool.size).toBeInstanceOf(Float32Array);
            expect(pool.color).toBeInstanceOf(Uint32Array);

            expect(pool.x.length).toBe(CAPACITY);
            expect(pool.getActiveCount()).toBe(0);
        });
    });

    describe('Spawning particles', () => {
        it('acquires and initializes particle attributes correctly', () => {
            const idx = pool.acquire();
            expect(idx).toBe(0);
            expect(pool.getActiveCount()).toBe(1);

            // spawn directly using spawn helper
            const idx2 = pool.spawn({
                x: 100,
                y: 200,
                vx: 1.5,
                vy: -2.5,
                size: 3,
                life: 1.0,
                decay: 0.05,
                color: 0xff0000ff, // RGBA packed or uint32
            });

            expect(idx2).toBe(1);
            expect(pool.getActiveCount()).toBe(2);
            expect(pool.x[idx2]).toBeCloseTo(100);
            expect(pool.y[idx2]).toBeCloseTo(200);
            expect(pool.vx[idx2]).toBeCloseTo(1.5);
            expect(pool.vy[idx2]).toBeCloseTo(-2.5);
            expect(pool.size[idx2]).toBeCloseTo(3);
            expect(pool.life[idx2]).toBeCloseTo(1.0);
            expect(pool.decay[idx2]).toBeCloseTo(0.05);
            expect(pool.color[idx2]).toBe(0xff0000ff);
        });

        it('supports color string parsing or Uint32 directly', () => {
            const idx = pool.spawn({
                x: 50,
                y: 50,
                vx: 0,
                vy: 0,
                color: '#ff0000',
            });
            expect(idx).toBe(0);
            expect(pool.color[idx]).toBeDefined();
        });
    });

    describe('Physics update steps', () => {
        it('steps position (x += vx, y += vy), applies gravity and drag, and bounces on floor', () => {
            const idx = pool.spawn({
                x: 100,
                y: 100,
                vx: 10,
                vy: 10,
                life: 1.0,
                decay: 0.1,
                size: 2,
            });

            // Before update: vx = 10, vy = 10
            // Update logic:
            // vx *= 0.98 -> 9.8
            // vy *= 0.98 -> 9.8
            // x += vx -> 100 + 9.8 = 109.8
            // y += vy -> 100 + 9.8 = 109.8
            // vy += 0.15 -> 9.8 + 0.15 = 9.95
            // life -= decay -> 1.0 - 0.1 = 0.9

            pool.update(800, 600);

            expect(pool.vx[idx]).toBeCloseTo(9.8);
            expect(pool.vy[idx]).toBeCloseTo(9.95);
            expect(pool.x[idx]).toBeCloseTo(109.8);
            expect(pool.y[idx]).toBeCloseTo(109.8);
            expect(pool.life[idx]).toBeCloseTo(0.9);
        });

        it('bounces off bottom boundary (logicalHeight - 10)', () => {
            const idx = pool.spawn({
                x: 100,
                y: 590,
                vx: 10,
                vy: 10,
                life: 1.0,
                decay: 0.01,
            });

            pool.update(800, 600);

            expect(pool.y[idx]).toBe(590);
            expect(pool.vy[idx]).toBeCloseTo(-4.975);
            expect(pool.vx[idx]).toBeCloseTo(7.84);
        });
    });

    describe('Life decay & Reclaiming expired particles', () => {
        it('reclaims expired particles seamlessly using swap-and-pop / active array', () => {
            const _idx1 = pool.spawn({ x: 10, y: 10, life: 0.1, decay: 0.2 }); // expires on update
            const _idx2 = pool.spawn({ x: 20, y: 20, life: 1.0, decay: 0.01 }); // stays alive

            expect(pool.getActiveCount()).toBe(2);

            pool.update(800, 600);

            // idx1 should have expired, active count should be 1
            expect(pool.getActiveCount()).toBe(1);

            // Iterating active particles or calling getActiveParticles()
            const active = pool.getActiveParticles();
            expect(active.length).toBe(1);
            expect(active[0].life).toBeCloseTo(0.99);
        });
    });

    describe('Overflow handling beyond max capacity', () => {
        it('safely recycles oldest or drops gracefully without allocating or throwing', () => {
            const smallPool = new TypedParticlePool(3);

            smallPool.spawn({ x: 0, y: 0, life: 1.0 });
            smallPool.spawn({ x: 1, y: 1, life: 1.0 });
            smallPool.spawn({ x: 2, y: 2, life: 1.0 });

            expect(smallPool.getActiveCount()).toBe(3);

            // 4th spawn should recycle oldest active or drop gracefully without throwing
            expect(() => {
                const p3 = smallPool.spawn({ x: 3, y: 3, life: 1.0 });
                expect(p3).toBeDefined();
            }).not.toThrow();

            expect(smallPool.getActiveCount()).toBeLessThanOrEqual(3);
        });
    });

    describe('Clear API', () => {
        it('clears all active particles immediately', () => {
            pool.spawn({ x: 1, y: 1 });
            pool.spawn({ x: 2, y: 2 });
            expect(pool.getActiveCount()).toBe(2);

            pool.clear();
            expect(pool.getActiveCount()).toBe(0);
        });
    });
});
