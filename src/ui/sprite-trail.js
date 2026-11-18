/**
 * ShapeKeeper — Sprite Trail Geometry
 *
 * A sprite's motion trail is a short ring buffer of past positions. The buffer
 * is drawn as a polyline, so any discontinuity stored in it becomes a visible
 * straight line in the sprite's colour.
 *
 * Sprites teleport when they wrap around a viewport edge (`x < 0 -> width`),
 * when a pointer drags them, and when the viewport resizes. Storing those
 * positions next to the pre-teleport ones painted full-width/full-height
 * colour streaks across the menu and game backgrounds. The ring buffer alone
 * cannot know which jumps are legitimate, so `forEachRun()` splits the buffer
 * into runs and drops every segment longer than `maxSegment`.
 *
 * Pure module: no DOM, no canvas, no allocation on the steady-state path.
 *
 * @module ui/sprite-trail
 */

/** Trail history length (matches the previous `maxTrailLength` default). */
export const TRAIL_CAPACITY = 8;

/**
 * Longest trail segment that may be drawn, in CSS pixels.
 *
 * A sprite moves at most a few px per frame (maxSpeed is 1.8), so anything
 * above this can only be a teleport: edge wrap, grab-drag, or resize.
 */
export const TRAIL_MAX_SEGMENT = 160;

export class SpriteTrail {
    /**
     * @param {number} [capacity] Ring-buffer size (number of past positions kept).
     */
    constructor(capacity = TRAIL_CAPACITY) {
        this.capacity = Math.max(2, Math.floor(capacity));
        this.points = [];
        this.head = 0;
        this.length = 0;
        this._run = [];
    }

    /** Append a position. Reuses a pooled point object, so no per-frame allocation. */
    push(x, y) {
        let point = this.points[this.head];
        if (!point) {
            point = { x: 0, y: 0 };
            this.points[this.head] = point;
        }
        point.x = x;
        point.y = y;

        this.head = (this.head + 1) % this.capacity;
        if (this.length < this.capacity) this.length += 1;
    }

    /** Drop the whole history. Call after any teleport so no streak is drawn. */
    clear() {
        this.length = 0;
        this.head = 0;
    }

    /** Oldest-first index of the i-th stored point. */
    _indexAt(i) {
        return (this.head - this.length + i + this.capacity * 2) % this.capacity;
    }

    /**
     * Visit every contiguous run of points as a polyline.
     *
     * Runs are split wherever consecutive points are further apart than
     * `maxSegment`, which is what makes a teleport harmless. The array passed to
     * `visit` is reused between calls: read it, do not retain it.
     *
     * @param {(run: Array<{x: number, y: number}>) => void} visit
     * @param {number} [maxSegment]
     */
    forEachRun(visit, maxSegment = TRAIL_MAX_SEGMENT) {
        const run = this._run;
        run.length = 0;

        for (let i = 0; i < this.length; i++) {
            const point = this.points[this._indexAt(i)];
            const previous = run.length > 0 ? run[run.length - 1] : null;

            if (
                previous &&
                (Math.abs(point.x - previous.x) > maxSegment ||
                    Math.abs(point.y - previous.y) > maxSegment)
            ) {
                visit(run);
                run.length = 0;
            }

            run.push(point);
        }

        if (run.length > 1) visit(run);
        run.length = 0;
    }
}
