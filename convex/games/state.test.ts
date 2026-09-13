/**
 * Unit tests for the pure helper `computeEffectiveMultiplier` in
 * `convex/games/state.ts`. The opponent-tap mechanic collapses any
 * non-truthOrDare multiplier to 0.5x after one or more taps. This is the
 * invariant we want to lock in: subsequent taps are idempotent, the value
 * never halves further, and truthOrDare is immune.
 */
import { describe, it, expect } from 'vitest';
import { computeEffectiveMultiplier } from './state';

describe('computeEffectiveMultiplier — initial state', () => {
    it('returns the raw multiplier when taps = 0', () => {
        expect(computeEffectiveMultiplier({ type: 'multiplier', value: 2 }, 0)).toEqual({
            type: 'multiplier',
            value: 2,
        });
        expect(computeEffectiveMultiplier({ type: 'multiplier', value: 10 }, 0)).toEqual({
            type: 'multiplier',
            value: 10,
        });
    });

    it('returns the raw multiplier when taps is undefined', () => {
        expect(computeEffectiveMultiplier({ type: 'multiplier', value: 3 }, undefined)).toEqual({
            type: 'multiplier',
            value: 3,
        });
    });
});

describe('computeEffectiveMultiplier — tap collapse', () => {
    it('2x collapses to 0.5x after one tap', () => {
        expect(computeEffectiveMultiplier({ type: 'multiplier', value: 2 }, 1)).toEqual({
            type: 'multiplier',
            value: 0.5,
        });
    });

    it('3x collapses to 0.5x after one tap (not 1.5x — design says: collapse, not halve)', () => {
        expect(computeEffectiveMultiplier({ type: 'multiplier', value: 3 }, 1)).toEqual({
            type: 'multiplier',
            value: 0.5,
        });
    });

    it('10x collapses to 0.5x after one tap', () => {
        expect(computeEffectiveMultiplier({ type: 'multiplier', value: 10 }, 1)).toEqual({
            type: 'multiplier',
            value: 0.5,
        });
    });

    it('multiple taps are idempotent — the value stays at 0.5x', () => {
        const v1 = computeEffectiveMultiplier({ type: 'multiplier', value: 2 }, 1);
        const v2 = computeEffectiveMultiplier({ type: 'multiplier', value: 2 }, 2);
        const v3 = computeEffectiveMultiplier({ type: 'multiplier', value: 2 }, 10);
        expect(v1).toEqual(v2);
        expect(v2).toEqual(v3);
        expect(v1).toEqual({ type: 'multiplier', value: 0.5 });
    });
});

describe('computeEffectiveMultiplier — truthOrDare immunity', () => {
    it('truthOrDare is never affected by taps', () => {
        const tod = { type: 'truthOrDare' };
        expect(computeEffectiveMultiplier(tod, 0)).toEqual(tod);
        expect(computeEffectiveMultiplier(tod, 1)).toEqual(tod);
        expect(computeEffectiveMultiplier(tod, 100)).toEqual(tod);
    });
});

describe('computeEffectiveMultiplier — null/undefined', () => {
    it('returns null when multiplier is null', () => {
        expect(computeEffectiveMultiplier(null, 0)).toBeNull();
        expect(computeEffectiveMultiplier(null, 5)).toBeNull();
    });

    it('returns undefined when multiplier is undefined', () => {
        expect(computeEffectiveMultiplier(undefined, 0)).toBeUndefined();
    });
});
