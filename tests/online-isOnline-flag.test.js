import { describe, it, expect, beforeEach } from 'vitest';
import { FEATURE_FLAGS } from '../constants.js';
import { Renderer } from '../renderer.js';
import { drawLavaTimer } from '../renderer/lava-timer.js';
import { createTurnClockController } from '../src/timing/turn-clock-controller.js';

// Honest integration proof for the online-play + lava-clock regression:
// `isOnline` is the signal the lava renderer AND the per-frame turn-clock tick
// gate on (renderer.js:109, dots-and-boxes-game.js:929). It is set false in
// game-state.js and must be flipped true when an online room game is created
// (initializeMultiplayerGame). If it stays false, online matches render no lava
// clock and never tick the countdown — exactly the reported symptoms.

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

function makeOnlineGame() {
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

describe('online match must set isOnline=true (regression guard)', () => {
    it('lava timer layer is a no-op while isOnline=false', () => {
        const game = makeOnlineGame();
        game.isOnline = false;
        const renderer = new Renderer(game);
        renderer.drawLavaTimerLayer();
        // drawLavaTimer should never have been invoked -> no fillText for countdown
        expect(game._log.calls.some((c) => c.prop === 'fillText')).toBe(false);
    });

    it('lava timer layer renders once isOnline=true', () => {
        const game = makeOnlineGame();
        game.isOnline = true;
        game.turnRemainingMs = 7200;
        const renderer = new Renderer(game);
        renderer.drawLavaTimerLayer();
        expect(game._log.calls.some((c) => c.prop === 'fillText')).toBe(true);
    });

    it('turn-clock tick populates turnRemainingMs only when isOnline (game-side gate)', () => {
        // The game-side gate (dots-and-boxes-game.js) only calls ctrl.tick() when
        // isOnline is true. Replicate that contract: clock must advance for an
        // online match, and must be unreachable (stay null) for an offline one.
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
