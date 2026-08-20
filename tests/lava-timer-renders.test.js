import { describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from '../renderer.js';
import { FEATURE_FLAGS, GAME_CONSTANTS } from '../constants.js';

/**
 * Honest integration proof (second-pass fix): the feature is only useful if the
 * lava clock actually DRAWS behind the dots in an online match — not merely if a
 * flag boolean flips. Renderer.drawLavaTimerLayer() (renderer.js:107) is the real
 * gate; it is skipped for non-online games, so we exercise it with isOnline=true
 * and a turn countdown, using an injected mock 2D context (jsdom has no canvas).
 */

function makeMockCtx() {
    const log = { alpha: [], text: [] };
    const ctx = {
        globalAlpha: 1,
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        save() {},
        restore() {},
        beginPath() {},
        arc() {},
        fill() {},
        createRadialGradient() {
            return { addColorStop() {} };
        },
        fillText(t) {
            log.text.push(String(t));
        },
    };
    Object.defineProperty(ctx, 'globalAlpha', {
        configurable: true,
        get() {
            return this._a ?? 1;
        },
        set(v) {
            log.alpha.push(v);
            this._a = v;
        },
    });
    return { ctx, log };
}

function makeGame() {
    const { ctx, log } = makeMockCtx();
    return {
        isOnline: true,
        offsetX: 20,
        offsetY: 20,
        cellSize: 40,
        gridCols: 10,
        gridRows: 10,
        logicalWidth: 400,
        logicalHeight: 400,
        ctx,
        canvas: { width: 400, height: 400 },
        turnRemainingMs: 7200, // 7.2s -> countdown should read "7.2s"
        lava: null,
        _log: log,
    };
}

describe('lava timer actually renders behind dots (online match)', () => {
    beforeEach(() => {
        FEATURE_FLAGS.FEATURE_LAVA_TIMER = true;
    });

    it('draws the lava layer at 40% opacity with a centered countdown when online + flag on', () => {
        const game = makeGame();
        const renderer = new Renderer(game);
        renderer.drawLavaTimerLayer();

        // NFR-2: lava never obscures dots — opacity hard-capped at 0.4.
        expect(game._log.alpha).toContain(GAME_CONSTANTS.LAVA_OPACITY);
        expect(GAME_CONSTANTS.LAVA_OPACITY).toBe(0.4);
        // The centered countdown text must have been painted.
        expect(game._log.text.some((t) => t.includes('7.2s'))).toBe(true);
        // Particles were seeded inside the board (real physics ran).
        expect(game.lava).not.toBeNull();
        expect(game.lava.particles.length).toBeGreaterThan(0);
    });

    it('does NOT render lava for a local (non-online) game even with flag on', () => {
        const game = makeGame();
        game.isOnline = false;
        const renderer = new Renderer(game);
        renderer.drawLavaTimerLayer();
        expect(game._log.text.length).toBe(0);
        expect(game._log.alpha.length).toBe(0);
    });

    it('does NOT render lava when the feature flag is off', () => {
        FEATURE_FLAGS.FEATURE_LAVA_TIMER = false;
        const game = makeGame();
        const renderer = new Renderer(game);
        renderer.drawLavaTimerLayer();
        expect(game._log.text.length).toBe(0);
    });
});
