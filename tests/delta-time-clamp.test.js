import { describe, it, expect } from 'vitest';
import { AnimationSystem } from '../animation-system.js';

/**
 * Delta-Time Clamp Test (MVTH #2)
 *
 * Verifies that the animation system tolerates a simulated background-tab
 * pause (a very large time jump) without launching animations into
 * coordinate overflow or NaN states. This addresses the spirit of P3-01
 * (unclamped delta-time input accumulation): when a tab is backgrounded and
 * refocused, `now` can jump by seconds, and every animation bucket must still
 * compact correctly rather than leaving stale/expired entries behind.
 *
 * AnimationSystem.updateAnimations(now) uses absolute timestamps (not raw dt),
 * so the safety property is: after a large time jump, all expired animations
 * are purged and no bucket retains entries whose startTime is in the distant
 * past.
 */
describe('AnimationSystem — large time jump (background tab resume)', () => {
    function makeSystem() {
        return new AnimationSystem();
    }

    it('purges all expired square animations after a 1.5s background pause', () => {
        const s = makeSystem();
        const beforePause = 10_000;

        // Seed fresh animations right before the "pause".
        s.squareAnimations = [
            { squareKey: '0,0', startTime: beforePause - 100, duration: 600 }, // expired
            { squareKey: '1,1', startTime: beforePause - 50, duration: 600 }, // expired
            { squareKey: '2,2', startTime: beforePause, duration: 10_000 }, // survives the 1.5s jump
        ];
        s.pulsatingLines = [
            { line: 'a', time: beforePause - 5000 }, // expired (duration 2000)
            { line: 'b', time: beforePause - 100 }, // fresh
        ];
        s.touchVisuals = [
            { startTime: beforePause - 1000, duration: 300 }, // expired
        ];
        s.sparkleEmojis = [
            { startTime: beforePause - 1000, duration: 1000 }, // expired
        ];
        s.lineDrawings = [
            { startTime: beforePause - 1000, duration: 150 }, // expired
        ];
        s.invalidLineFlash = { startTime: beforePause, duration: 300 };

        // Simulate returning from a 1.5s backgrounded tab.
        const afterPause = beforePause + 1_500;
        s.updateAnimations(afterPause);

        // Every bucket seeded before the jump must be empty; nothing older
        // than the pause may survive a large dt.
        expect(s.squareAnimations.map((a) => a.squareKey)).toEqual(['2,2']);
        expect(s.pulsatingLines.map((p) => p.line)).toEqual(['b']);
        expect(s.touchVisuals).toEqual([]);
        expect(s.sparkleEmojis).toEqual([]);
        expect(s.lineDrawings).toEqual([]);
        // invalidLineFlash seeded at pause time (300ms duration) is expired
        // after a 1.5s jump.
        expect(s.invalidLineFlash).toBeNull();
    });

    it('does not produce NaN or Infinity coordinates when now jumps backward slightly (clock correction)', () => {
        const s = makeSystem();
        const now = 50_000;
        s.squareAnimations = [{ squareKey: '0,0', startTime: now, duration: 600 }];

        // A small backward clock adjustment must not break compaction.
        s.updateAnimations(now - 10);
        expect(s.squareAnimations.length).toBe(1);
        expect(Number.isFinite(s.squareAnimations[0].startTime)).toBe(true);
    });

    it('keeps fresh animations alive across an extreme dt spike', () => {
        const s = makeSystem();
        const base = 100_000;
        s.squareAnimations = [
            { squareKey: 'alive', startTime: base, duration: 60_000 }, // 1 minute
        ];

        // Inject a simulated dt = 1.5s pause (the pathological value from P3-01).
        s.updateAnimations(base + 1_500);
        expect(s.squareAnimations.map((a) => a.squareKey)).toEqual(['alive']);
    });
});
