import { describe, expect, it } from 'vitest';

import { isTurnExpired } from '../convex/games/turn-deadline.js';

describe('isTurnExpired', () => {
    it('returns false when no turnEndTime is set on the room', () => {
        expect(isTurnExpired({})).toBe(false);
    });

    it('returns false when turnEndTime is undefined', () => {
        expect(isTurnExpired({ turnEndTime: undefined })).toBe(false);
    });

    it('returns false when turnEndTime is in the future', () => {
        const now = 1_000_000;
        expect(isTurnExpired({ turnEndTime: now + 5_000 }, now)).toBe(false);
    });

    it('returns true when turnEndTime is in the past', () => {
        const now = 1_000_000;
        expect(isTurnExpired({ turnEndTime: now - 1 }, now)).toBe(true);
    });

    it('returns false at the exact turnEndTime (boundary — player still has the final millisecond)', () => {
        const now = 1_000_000;
        expect(isTurnExpired({ turnEndTime: now }, now)).toBe(false);
    });

    it('returns true one millisecond past turnEndTime', () => {
        const now = 1_000_001;
        expect(isTurnExpired({ turnEndTime: 1_000_000 }, now)).toBe(true);
    });

    it('handles null room defensively', () => {
        expect(isTurnExpired(null)).toBe(false);
    });

    it('ignores non-number turnEndTime', () => {
        expect(isTurnExpired({ turnEndTime: 'soon' })).toBe(false);
        expect(isTurnExpired({ turnEndTime: NaN })).toBe(false);
    });
});
