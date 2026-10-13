import { describe, it, expect } from 'vitest';
import { TURN_TIMER_OPTIONS_MS, DEFAULT_TURN_DURATION_MS } from '../constants.js';
import {
    ALLOWED_TURN_DURATIONS_MS,
    DEFAULT_TURN_DURATION_MS as SERVER_DEFAULT,
    normalizeTurnDuration,
} from '../convex/games/turnTimer.ts';

describe('turn timer client/server parity', () => {
    it('shares identical duration options and defaults', () => {
        expect(Array.from(ALLOWED_TURN_DURATIONS_MS)).toEqual(TURN_TIMER_OPTIONS_MS);
        expect(SERVER_DEFAULT).toBe(DEFAULT_TURN_DURATION_MS);
    });

    it('normalizes legacy, unknown, or valid durations correctly', () => {
        expect(normalizeTurnDuration(undefined)).toBe(0);
        expect(normalizeTurnDuration(null)).toBe(0);
        expect(normalizeTurnDuration('15000')).toBe(0);
        expect(normalizeTurnDuration(12345)).toBe(0);
        expect(normalizeTurnDuration(15000)).toBe(15000);
        expect(normalizeTurnDuration(0)).toBe(0);
        expect(normalizeTurnDuration(10000)).toBe(10000);
        expect(normalizeTurnDuration(30000)).toBe(30000);
        expect(normalizeTurnDuration(60000)).toBe(60000);
    });
});
