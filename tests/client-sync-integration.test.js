import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTurnClockController } from '../src/timing/turn-clock-controller.js';
import { FEATURE_FLAGS } from '../constants.js';

// Use a fixed "now" so the absolute-epoch model is deterministic.
const NOW = 1_700_000_000_000;
let realNow;

beforeEach(() => {
    realNow = Date.now;
    Date.now = () => NOW;
    FEATURE_FLAGS.FEATURE_LAVA_TIMER = true;
    FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE = true;
});

afterEach(() => {
    Date.now = realNow;
    FEATURE_FLAGS.FEATURE_LAVA_TIMER = false;
    FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE = false;
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

    it('seeds the clock offset from an RTT sample (latency = 100ms, no pause)', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        // client sends at NOW, server receives at NOW+100 (up-leg latency 100ms).
        ctrl.onAuthoritativeRoom({
            turnEndTime: NOW + 5000,
            lastTurnClientSentAt: NOW,
            lastTurnServerReceivedAt: NOW + 100,
        });
        expect(ctrl.getLastLatency()).toBe(100);
        expect(ctrl.clock.isPaused()).toBe(false);
    });

    it('pauses the clock when up-leg latency exceeds the lag threshold (FR-3)', () => {
        const game = makeGame();
        const ctrl = createTurnClockController(game);
        // up-leg latency 1000ms (> 600ms threshold) -> pause + 400ms buffer.
        ctrl.onAuthoritativeRoom({
            turnEndTime: NOW + 10000,
            lastTurnClientSentAt: NOW,
            lastTurnServerReceivedAt: NOW + 1000,
        });
        expect(ctrl.getLastLatency()).toBe(1000);
        expect(ctrl.clock.isPaused()).toBe(true);
        expect(ctrl.clock.getDelayBuffer()).toBe(400);
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
});
