import { describe, expect, it, vi } from 'vitest';
import { initializeAmbientParticles, createAmbientParticle } from './core.js';

describe('ambient particle dimensions', () => {
    it('spreads ambient particles across the system logical dimensions', () => {
        // Pin randomness so positions are deterministic: x = 0.999 * width.
        const rand = vi.spyOn(Math, 'random').mockReturnValue(0.999);

        const system = { logicalWidth: 400, logicalHeight: 300 };
        initializeAmbientParticles(system);

        rand.mockRestore();

        expect(system.ambientParticles.length).toBeGreaterThan(0);
        for (const p of system.ambientParticles) {
            // Bug: hardcoded 800x600 would yield x≈799 (> 400) and y≈599 (>300).
            expect(p.x).toBeLessThan(400);
            expect(p.y).toBeLessThan(300);
        }
    });

    it('falls back to 800x600 when logical dimensions are absent', () => {
        const rand = vi.spyOn(Math, 'random').mockReturnValue(0.999);

        const system = {};
        initializeAmbientParticles(system);

        rand.mockRestore();

        for (const p of system.ambientParticles) {
            expect(p.x).toBeLessThan(800);
            expect(p.y).toBeLessThan(600);
        }
    });

    it('createAmbientParticle honors explicit width/height', () => {
        const rand = vi.spyOn(Math, 'random').mockReturnValue(0.999);
        const p = createAmbientParticle(false, 200, 150);
        rand.mockRestore();

        expect(p.x).toBeLessThan(200);
        expect(p.y).toBeLessThan(150);
    });
});
