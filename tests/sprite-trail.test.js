import { describe, expect, it } from 'vitest';
import { SpriteTrail, TRAIL_CAPACITY, TRAIL_MAX_SEGMENT } from '../src/ui/sprite-trail.js';

/**
 * Pure geometry contract for the sprite motion trail.
 *
 * The trail is a fixed-capacity ring buffer of past positions drawn as a
 * polyline. Anything that teleports a sprite (edge wrap, grab-drag, resize) must
 * never become a straight line across the canvas.
 */

const collectRuns = (trail, maxSegment = TRAIL_MAX_SEGMENT) => {
    const runs = [];
    trail.forEachRun((run) => runs.push(run.map((p) => ({ x: p.x, y: p.y }))), maxSegment);
    return runs;
};

const longestSegment = (runs) => {
    let longest = 0;
    for (const run of runs) {
        for (let i = 1; i < run.length; i++) {
            longest = Math.max(
                longest,
                Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y)
            );
        }
    }
    return longest;
};

describe('SpriteTrail', () => {
    it('keeps at most `capacity` points, oldest first', () => {
        const trail = new SpriteTrail(4);
        for (let i = 1; i <= 6; i++) trail.push(i * 10, 0);

        expect(trail.length).toBe(4);
        const runs = collectRuns(trail);
        expect(runs).toHaveLength(1);
        expect(runs[0].map((p) => p.x)).toEqual([30, 40, 50, 60]);
    });

    it(`defaults to ${TRAIL_CAPACITY} points`, () => {
        const trail = new SpriteTrail();
        for (let i = 0; i < TRAIL_CAPACITY + 5; i++) trail.push(i, i);
        expect(trail.length).toBe(TRAIL_CAPACITY);
    });

    it('reuses point objects instead of allocating per sample', () => {
        const trail = new SpriteTrail(3);
        trail.push(1, 1);
        const first = trail.points[0];
        for (let i = 0; i < 6; i++) trail.push(i, i); // wraps back over slot 0
        expect(trail.points[0]).toBe(first);
        expect(trail.points).toHaveLength(3);
    });

    it('reports a single short run while the sprite moves normally', () => {
        const trail = new SpriteTrail(6);
        for (let i = 0; i < 6; i++) trail.push(i * 1.8, 0);
        const runs = collectRuns(trail);
        expect(runs).toHaveLength(1);
        expect(longestSegment(runs)).toBeLessThanOrEqual(TRAIL_MAX_SEGMENT);
    });

    it('M1 boundary flip — splits a run exactly at the maxSegment threshold', () => {
        const trail = new SpriteTrail(6);
        trail.push(0, 0);
        trail.push(TRAIL_MAX_SEGMENT, 0); // exactly at the limit: still one run
        expect(collectRuns(trail)).toHaveLength(1);

        trail.push(TRAIL_MAX_SEGMENT * 2 + 1, 0); // one pixel over: split
        trail.push(TRAIL_MAX_SEGMENT * 2 + 1.8, 0); // a second point on the new run
        const runs = collectRuns(trail);
        expect(runs).toHaveLength(2);
        expect(runs[1][0].x).toBe(TRAIL_MAX_SEGMENT * 2 + 1);
    });

    it('M2 degenerate input — empty and single-point trails produce no drawable run', () => {
        expect(collectRuns(new SpriteTrail())).toEqual([]);

        const single = new SpriteTrail();
        single.push(10, 10);
        expect(collectRuns(single)).toEqual([]);
    });

    it('M3 side-effect deletion — clear() drops the history so no streak survives', () => {
        const trail = new SpriteTrail(8);
        for (let i = 0; i < 8; i++) trail.push(i * 1.8, 400);
        trail.clear();
        expect(trail.length).toBe(0);
        expect(collectRuns(trail)).toEqual([]);

        // A new, distant sample must not link back to the pre-clear history.
        trail.push(900, 400);
        trail.push(901.8, 400);
        const runs = collectRuns(trail);
        expect(runs).toHaveLength(1);
        expect(runs[0][0]).toEqual({ x: 900, y: 400 });
    });

    it('M4 wrap teleport — an edge wrap never yields a full-span segment', () => {
        const trail = new SpriteTrail(8);
        const width = 1440;
        for (let i = 0; i < 4; i++) trail.push(width - 4 + i * 1.8, 300);
        trail.push(1, 300); // teleport to the opposite edge

        const runs = collectRuns(trail);
        expect(longestSegment(runs)).toBeLessThanOrEqual(TRAIL_MAX_SEGMENT);
    });

    it('never mutates the buffer while a callback runs (re-entrancy safety)', () => {
        const trail = new SpriteTrail(4);
        for (let i = 0; i < 4; i++) trail.push(i, 0);
        const snapshot = collectRuns(trail);
        expect(collectRuns(trail)).toEqual(snapshot);
    });
});
