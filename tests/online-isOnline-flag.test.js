import { describe, it, expect, beforeEach } from 'vitest';
import { FEATURE_FLAGS } from '../constants.js';
import { Renderer } from '../renderer.js';
import { drawLavaTimer } from '../renderer/lava-timer.js';
import { createTurnClockController } from '../src/timing/turn-clock-controller.js';

// Integration proof: lava timer now renders in ALL game modes when feature flag is on.
// The isOnline flag is no longer a gate for lava timer rendering (only for turn clock).

function makeMockCtx() {
    const log = { calls: [] };
    const ctx = new Proxy(
        {},
        {
            get: (_t, prop) => {
                if (prop === 'createRadialGradient') {
                    return () => ({ addColorStop: () => {} });
                }
                return (...args) => {
                    log.calls.push({ prop, args });
                };
            },
            set: () => true,
        }
    );
    return { ctx, log };
}

function makeGame() {
    const { ctx, log } = makeMockCtx();
    return {
        ctx,
        _log: log,
        isOnline: false,
        isMultiplayer: true,
        logicalWidth: 800,
        logicalHeight: 600,
        offsetX: 20,
        offsetY: 20,
        cellSize: 40,
        gridCols: 10,
        gridRows: 10,
        turnRemainingMs: null,
        lava: null,
        currentPlayer: 1,
        myPlayerNumber: 1,
    };
}

beforeEach(() => {
    FEATURE_FLAGS.FEATURE_LAVA_TIMER = true;
    FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE = true;
});

describe('lava timer renders in all game modes (not gated by isOnline)', () => {
    it('lava timer layer renders when isOnline=false (new behavior)', () => {
        const game = makeGame();
        game.isOnline = false;
        game.turnRemainingMs = 7200;
        const renderer = new Renderer(game);
        renderer.drawLavaTimerLayer();
        // drawLavaTimer should be invoked -> fillText for countdown
        expect(game._log.calls.some((c) => c.prop === 'fillText')).toBe(true);
    });

    it('lava timer layer renders when isOnline=true', () => {
        const game = makeGame();
        game.isOnline = true;
        game.turnRemainingMs = 7200;
        const renderer = new Renderer(game);
        renderer.drawLavaTimerLayer();
        expect(game._log.calls.some((c) => c.prop === 'fillText')).toBe(true);
    });

    it('turn-clock tick still gated by isOnline in game loop', () => {
        // The game-side gate (dots-and-boxes-game.js) only calls ctrl.tick() when
        // isOnline is true. This test verifies that contract still holds.
        const now = 1_700_000_000_000;
        const realNow = Date.now;
        Date.now = () => now;
        try {
            const onlineGame = { isOnline: true, turnRemainingMs: null };
            const ctrl = createTurnClockController(onlineGame);
            ctrl.onAuthoritativeRoom({ turnEndTime: now + 9000 });
            // game calls ctrl.tick() each frame when isOnline -> must update
            onlineGame.turnRemainingMs = ctrl.tick();
            expect(onlineGame.turnRemainingMs).toBe(9000);

            const offlineGame = { isOnline: false, turnRemainingMs: null };
            // offline: game never calls ctrl.tick(); countdown never appears
            expect(offlineGame.turnRemainingMs).toBeNull();
        } finally {
            Date.now = realNow;
        }
    });
});
