import { describe, it, expect } from 'vitest';
import { createClockSync, computeTurnEnd } from '../src/timing/clock-sync.js';
import { TIMING_CONSTANTS } from '../constants.js';

describe('createClockSync.sample (FR-2 EMA offset)', () => {
    it('establishes offset from the first sample', () => {
        // t0=1000, tServer=1100, t1=1000 -> rawOffset = 1100 - (1000+1000)/2 = 100
        const clk = createClockSync({ now: () => 1000 });
        const r = clk.sample(1000, 1100, 1000);
        expect(r.rawOffset).toBe(100);
        expect(clk.getOffset()).toBe(100);
        expect(clk.hasOffset()).toBe(true);
    });

    it('smooths subsequent samples with EMA alpha', () => {
        const clk = createClockSync({ now: () => 1000 });
        clk.sample(1000, 1100, 1000); // offset 100
        // second sample: t0=1000,tServer=1200,t1=1000 -> rawOffset=200
        // smoothed = 0.8*100 + 0.2*200 = 120
        clk.sample(1000, 1200, 1000);
        expect(clk.getOffset()).toBeCloseTo(120, 5);
    });
});

describe('estimatedServerNow', () => {
    it('adds the smoothed offset to local time', () => {
        const clk = createClockSync({ now: () => 5000 });
        clk.sample(1000, 1100, 1000); // offset +100
        expect(clk.estimatedServerNow()).toBe(5100);
    });
});

describe('remaining (FR-2 monotonic countdown)', () => {
    it('decreases as server time advances', () => {
        let t = 1000;
        const clk = createClockSync({ now: () => t });
        clk.sample(1000, 1100, 1000); // offset +100 -> serverNow = t+100
        const end = computeTurnEnd(1100, 1000); // server start 1100, +1000ms => 2100
        const r0 = clk.remaining(end); // end 2100 - serverNow(1100) = 1000
        expect(r0).toBe(1000);
        t = 1500;
        const r1 = clk.remaining(end); // serverNow 1600 -> 500
        expect(r1).toBe(500);
        expect(r1).toBeLessThan(r0);
    });

    it('never returns negative', () => {
        let t = 1000;
        const clk = createClockSync({ now: () => t });
        clk.sample(1000, 1100, 1000);
        const end = computeTurnEnd(1100, 50); // ends 50 units of server time later
        t = 99999; // far in the future
        expect(clk.remaining(end)).toBe(0);
    });
});

describe('lag pause (FR-3 / NFR-3)', () => {
    it('freezes the clock and grants delay buffer above threshold', () => {
        let t = 1000;
        const clk = createClockSync({ now: () => t });
        clk.sample(1000, 1100, 1000); // offset +100 -> serverNow = t+100
        const end = computeTurnEnd(1100, 1000); // server end = 2100
        const before = clk.remaining(end); // 2100 - 1100 = 1000
        expect(before).toBe(1000);
        clk.beginPause(1000); // 400ms over the 600ms threshold
        expect(clk.isPaused()).toBe(true);
        expect(clk.getDelayBuffer()).toBe(400);
        // While paused, wall-clock advances but remaining stays frozen.
        t = 3000;
        const duringPause = clk.remaining(end);
        expect(duringPause).toBe(before); // frozen
        clk.endPause();
        const after = clk.remaining(end);
        // After resume, buffer (+400) partially offsets the elapsed wall time.
        // serverNow advanced to 3100, so 2100-3100 = -1000, +400 buffer = -600 -> 0
        expect(after).toBe(0);
    });

    it('does not grant buffer below threshold', () => {
        const clk = createClockSync({ now: () => 1000 });
        clk.sample(1000, 1100, 1000);
        const res = clk.beginPause(300); // below 600ms threshold
        expect(res.grantedBufferMs).toBe(0);
        expect(clk.getDelayBuffer()).toBe(0);
    });

    it('extends the turn budget by the buffer on resume (fair play)', () => {
        let t = 1000;
        const clk = createClockSync({ now: () => t });
        clk.sample(1000, 1100, 1000);
        const end = computeTurnEnd(1100, 1000); // server end 2100
        clk.beginPause(900); // 300ms over -> +300 buffer
        expect(clk.getDelayBuffer()).toBe(300);
        clk.endPause();
        t = 1700; // 600ms of real time elapsed (serverNow 1800)
        // 2100 - 1800 + 300 buffer = 600 (would have been 300 without buffer)
        expect(clk.remaining(end)).toBe(600);
    });
});

describe('computeTurnEnd', () => {
    it('defaults to the configured 10s duration', () => {
        expect(computeTurnEnd(5000)).toBe(5000 + TIMING_CONSTANTS.TURN_DURATION_MS);
    });
});
