import { describe, it, expect } from 'vitest';
import { formatCountdown, ensureLavaSystem, initLavaSystem } from '../renderer/lava-timer.js';
import { TIMING_CONSTANTS } from '../constants.js';

describe('formatCountdown (AC-002 jitter-free quantization)', () => {
    it('quantizes to 0.1s with one decimal', () => {
        expect(formatCountdown(7200)).toBe('7.2s');
        expect(formatCountdown(7000)).toBe('7.0s');
        expect(formatCountdown(999)).toBe('0.9s');
    });

    it('floors partial quanta (never rounds up)', () => {
        // 7249 -> floor(7249/100)*100 = 7200 -> "7.2s"
        expect(formatCountdown(7249)).toBe('7.2s');
        // 7250 -> floor(7250/100)*100 = 7200 -> "7.2s" (true flooring, not rounding)
        expect(formatCountdown(7250)).toBe('7.2s');
    });

    it('clamps negatives to 0.0s', () => {
        expect(formatCountdown(-500)).toBe('0.0s');
        expect(formatCountdown(0)).toBe('0.0s');
    });

    it('respects the configured quantize step', () => {
        expect(TIMING_CONSTANTS.COUNTDOWN_QUANTIZE_MS).toBe(100);
    });
});

describe('lava system lifecycle on game object', () => {
    function makeGame() {
        return {
            offsetX: 20,
            offsetY: 20,
            cellSize: 40,
            gridCols: 10,
            gridRows: 10,
            ctx: null,
            logicalWidth: 400,
            logicalHeight: 400,
        };
    }

    it('ensureLavaSystem lazily attaches a lava holder', () => {
        const game = makeGame();
        const lava = ensureLavaSystem(game);
        expect(game.lava).toBe(lava);
        expect(lava.initialized).toBe(false);
    });

    it('initLavaSystem seeds particles inside the board', () => {
        const game = makeGame();
        const lava = initLavaSystem(game);
        expect(lava.initialized).toBe(true);
        expect(lava.particles.length).toBeGreaterThan(0);
        // every particle within board bounds (uses shared physics invariant)
        const b = { minX: 20, minY: 20, maxX: 20 + 9 * 40, maxY: 20 + 9 * 40 };
        for (const p of lava.particles) {
            expect(p.x - p.r).toBeGreaterThanOrEqual(b.minX - 1e-6);
            expect(p.x + p.r).toBeLessThanOrEqual(b.maxX + 1e-6);
        }
    });
});
