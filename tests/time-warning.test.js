import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maybeAnnounceTimeLow } from '../src/timing/time-warning.js';
import * as announcer from '../src/ui/AccessibilityAnnouncer.js';

vi.mock('../src/ui/AccessibilityAnnouncer.js', () => ({
    announceAlert: vi.fn(),
    announceStatus: vi.fn(),
}));

describe('maybeAnnounceTimeLow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('announces once at 10s for a 30s turn', () => {
        const owner = {};
        const turnKey = 1;
        const durationMs = 30000;

        // Above threshold (10000) -> no announcement
        maybeAnnounceTimeLow(owner, turnKey, 15000, durationMs);
        expect(announcer.announceAlert).not.toHaveBeenCalled();

        // At threshold (10000) -> announces
        maybeAnnounceTimeLow(owner, turnKey, 10000, durationMs);
        expect(announcer.announceAlert).toHaveBeenCalledTimes(1);
        expect(announcer.announceAlert).toHaveBeenCalledWith('10 seconds left');

        // Repeated tick below threshold on same turnKey -> no second announcement
        maybeAnnounceTimeLow(owner, turnKey, 8000, durationMs);
        expect(announcer.announceAlert).toHaveBeenCalledTimes(1);
    });

    it('announces once at 5s for a 10s turn (half duration)', () => {
        const owner = {};
        const turnKey = 1;
        const durationMs = 10000;

        // Threshold is min(10000, floor(10000 / 2)) = 5000
        maybeAnnounceTimeLow(owner, turnKey, 6000, durationMs);
        expect(announcer.announceAlert).not.toHaveBeenCalled();

        maybeAnnounceTimeLow(owner, turnKey, 5000, durationMs);
        expect(announcer.announceAlert).toHaveBeenCalledTimes(1);
        expect(announcer.announceAlert).toHaveBeenCalledWith('5 seconds left');
    });

    it('announces again for a new turnKey', () => {
        const owner = {};
        const durationMs = 15000; // threshold = min(10000, 7500) = 7500

        maybeAnnounceTimeLow(owner, 1, 7000, durationMs);
        expect(announcer.announceAlert).toHaveBeenCalledTimes(1);
        expect(announcer.announceAlert).toHaveBeenCalledWith('8 seconds left');

        // New turn
        maybeAnnounceTimeLow(owner, 2, 7000, durationMs);
        expect(announcer.announceAlert).toHaveBeenCalledTimes(2);
    });

    it('does nothing when disabled, infinite, or not finite', () => {
        const owner = {};
        maybeAnnounceTimeLow(owner, 1, NaN, 15000);
        maybeAnnounceTimeLow(owner, 1, 5000, 0);
        maybeAnnounceTimeLow(owner, 1, 5000, -1000);
        expect(announcer.announceAlert).not.toHaveBeenCalled();
    });
});
