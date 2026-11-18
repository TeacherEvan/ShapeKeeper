import { describe, expect, it, vi } from 'vitest';
import { SPARK_CAPACITY, SpriteSparks } from './sprite-sparks.js';

describe('SpriteSparks', () => {
    it('emits the requested count and never exceeds its capacity', () => {
        const sparks = new SpriteSparks(10);
        sparks.burst(0, 0, '#fff', { count: 6 });
        expect(sparks.length).toBe(6);
        sparks.burst(0, 0, '#fff', { count: 50 });
        expect(sparks.length).toBe(10);
        expect(new SpriteSparks().capacity).toBe(SPARK_CAPACITY);
    });

    it('moves, decelerates and removes sparks once their life is spent', () => {
        const sparks = new SpriteSparks();
        sparks.burst(100, 100, '#fff', { count: 4, speed: 4, rng: () => 0.5 });
        const before = sparks.items.map((s) => Math.hypot(s.vx, s.vy));
        sparks.update();
        const after = sparks.items.map((s) => Math.hypot(s.vx, s.vy));
        after.forEach((v, i) => expect(v).toBeLessThan(before[i]));

        for (let i = 0; i < 60; i++) sparks.update();
        expect(sparks.length).toBe(0);
    });

    it('draws additively only when asked and always restores the context', () => {
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            globalCompositeOperation: 'source-over',
        };
        const sparks = new SpriteSparks();
        sparks.render(ctx);
        expect(ctx.save).not.toHaveBeenCalled(); // empty pool costs nothing

        sparks.burst(5, 5, '#0ff', { count: 3 });
        sparks.render(ctx, { additive: true });
        expect(ctx.globalCompositeOperation).toBe('lighter');
        expect(ctx.arc).toHaveBeenCalledTimes(3);
        expect(ctx.restore).toHaveBeenCalledTimes(1);

        ctx.globalCompositeOperation = 'source-over';
        sparks.render(ctx);
        expect(ctx.globalCompositeOperation).toBe('source-over');
    });
});
