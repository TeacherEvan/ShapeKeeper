import { describe, expect, it } from 'vitest';

import {
    DEFAULT_TURN_DURATION_SECONDS,
    MAX_TURN_DURATION_SECONDS,
    MIN_TURN_DURATION_SECONDS,
    computeTurnEndTime,
    resolveTurnDurationMs,
    validateTurnDurationSeconds,
} from '../convex/games/turn_duration.js';

describe('resolveTurnDurationMs', () => {
    it('falls back to the 10s default for legacy rooms (unset)', () => {
        expect(resolveTurnDurationMs({})).toBe(10000);
        expect(resolveTurnDurationMs(undefined)).toBe(10000);
        expect(DEFAULT_TURN_DURATION_SECONDS).toBe(10);
    });

    it('treats 0 as "no limit" (0 ms)', () => {
        expect(resolveTurnDurationMs({ turnDurationSeconds: 0 })).toBe(0);
    });

    it('converts seconds to milliseconds', () => {
        expect(resolveTurnDurationMs({ turnDurationSeconds: 45 })).toBe(45000);
        expect(resolveTurnDurationMs({ turnDurationSeconds: 600 })).toBe(600000);
    });

    it('ignores non-numeric values (defaults)', () => {
        expect(resolveTurnDurationMs({ turnDurationSeconds: null })).toBe(10000);
        expect(resolveTurnDurationMs({ turnDurationSeconds: '30' })).toBe(10000);
        expect(resolveTurnDurationMs({ turnDurationSeconds: NaN })).toBe(10000);
    });
});

describe('validateTurnDurationSeconds', () => {
    it('accepts 0 (no limit) through the max (600s)', () => {
        expect(validateTurnDurationSeconds(0)).toEqual({ ok: true, seconds: 0 });
        expect(validateTurnDurationSeconds(45)).toEqual({ ok: true, seconds: 45 });
        expect(validateTurnDurationSeconds(MAX_TURN_DURATION_SECONDS).ok).toBe(true);
        expect(MIN_TURN_DURATION_SECONDS).toBe(0);
    });

    it('rejects out-of-range values', () => {
        expect(validateTurnDurationSeconds(-1).ok).toBe(false);
        expect(validateTurnDurationSeconds(601).ok).toBe(false);
        expect(validateTurnDurationSeconds(9999).ok).toBe(false);
    });

    it('rejects non-integers and non-numbers', () => {
        expect(validateTurnDurationSeconds(10.5).ok).toBe(false);
        expect(validateTurnDurationSeconds('30').ok).toBe(false);
        expect(validateTurnDurationSeconds(null).ok).toBe(false);
        expect(validateTurnDurationSeconds(undefined).ok).toBe(false);
    });
});

describe('computeTurnEndTime', () => {
    it('returns an absolute end epoch from a configured duration', () => {
        const now = 1_000_000;
        expect(computeTurnEndTime({ turnDurationSeconds: 30 }, now)).toBe(now + 30_000);
    });

    it('uses the default 10s for legacy rooms', () => {
        const now = 1_000_000;
        expect(computeTurnEndTime({}, now)).toBe(now + 10_000);
    });

    it('returns null when the room has no time limit (0)', () => {
        expect(computeTurnEndTime({ turnDurationSeconds: 0 }, 1_000_000)).toBeNull();
    });
});
