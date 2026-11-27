import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTurnClockController } from '../src/timing/turn-clock-controller.js';
import { FEATURE_FLAGS } from '../constants.js';

// Use a fixed "now" so the absolute-epoch model is deterministic.
const NOW = 1_700_000_000_000;
let realNow;
let prevLavaFlag;
let prevSyncFlag;

beforeEach(() => {
    realNow = Date.now;
    Date.now = () => NOW;
    prevLavaFlag = FEATURE_FLAGS.FEATURE_LAVA_TIMER;
    prevSyncFlag = FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE;
    FEATURE_FLAGS.FEATURE_LAVA_TIMER = true;
    FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE = true;
});

afterEach(() => {
    Date.now = realNow;
    FEATURE_FLAGS.FEATURE_LAVA_TIMER = prevLavaFlag;
    FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE = prevSyncFlag;
});

describe('createTurnClockController (FR-2 / FR-3 client integration)', () => {
    function makeGame() {
        return { turnRemainingMs: null, isOnline: true };
    }

    it('derives a live, decreasing countdown from server turnEndTime', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        // Server turnEndTime is an absolute epoch 10s ahead of now.
        ctrl.onAuthoritativeRoom({ turnEndTime: NOW + 10000 });
        expect(ctrl.tick()).toBe(10000);
        expect(game.turnRemainingMs).toBe(10000);

        // Advance the clock by 2s.
        Date.now = () => NOW + 2000;
        expect(ctrl.tick()).toBe(8000);
        expect(game.turnRemainingMs).toBe(8000);
    });

    it('seeds the clock offset from a local move RTT sample (latency = 100ms, no pause)', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        ctrl.markLocalMoveSent(NOW);
        Date.now = () => NOW + 100;
        ctrl.onAuthoritativeRoom({
            turnEndTime: NOW + 5000,
            lastTurnClientSentAt: NOW,
            lastTurnServerReceivedAt: NOW + 50,
        });
        expect(ctrl.getLastLatency()).toBe(100);
        expect(ctrl.clock.isPaused()).toBe(false);
    });

    it('pauses the clock when local move RTT exceeds the lag threshold (FR-3)', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        ctrl.markLocalMoveSent(NOW);
        Date.now = () => NOW + 1000;
        ctrl.onAuthoritativeRoom({
            turnEndTime: NOW + 10000,
            lastTurnClientSentAt: NOW,
            lastTurnServerReceivedAt: NOW + 500,
        });
        expect(ctrl.getLastLatency()).toBe(1000);
        expect(ctrl.clock.isPaused()).toBe(true);
        expect(ctrl.clock.getDelayBuffer()).toBe(400);
    });

    it('ignores remote opponent clock timestamps so remote skew never poisons offset or triggers lag pause', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        // markLocalMoveSent was NOT called — this update came from an opponent's move
        // whose wall clock is skewed by 5 seconds.
        ctrl.onAuthoritativeRoom({
            turnEndTime: NOW + 10000,
            lastTurnClientSentAt: NOW - 5000,
            lastTurnServerReceivedAt: NOW,
        });
        expect(ctrl.getLastLatency()).toBe(0);
        expect(ctrl.clock.getOffset()).toBe(0);
        expect(ctrl.clock.isPaused()).toBe(false);
    });

    it('returns null remaining when no authoritative turn is active', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        expect(ctrl.tick()).toBeNull();
        expect(game.turnRemainingMs).toBeNull();
    });

    it('clear() resets turn state', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        ctrl.onAuthoritativeRoom({ turnEndTime: NOW + 9000 });
        ctrl.tick();
        ctrl.clear();
        expect(game.turnRemainingMs).toBeNull();
        expect(ctrl.tick()).toBeNull();
    });

    it('turnEndTime removed -> tick() returns null', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        ctrl.onAuthoritativeRoom({ turnEndTime: NOW + 9000, turnDurationMs: 15000 });
        expect(ctrl.tick()).toBe(9000);
        expect(ctrl.getDurationMs()).toBe(15000);
        expect(ctrl.getTurnKey()).toBe(NOW + 9000);

        // Room update with no turnEndTime (e.g. game paused or reset or untimed)
        ctrl.onAuthoritativeRoom({ turnEndTime: undefined, turnDurationMs: 0 });
        expect(ctrl.tick()).toBeNull();
        expect(game.turnRemainingMs).toBeNull();
        expect(ctrl.getDurationMs()).toBe(0);
        expect(ctrl.getTurnKey()).toBeNull();
    });
});
