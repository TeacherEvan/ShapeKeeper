/**
 * Turn Clock Synchronization & Lag Compensation Engine (FR-2 / FR-3 / NFR-3)
 *
 * Pure, framework-free, unit-testable under vitest. No DOM, no network, no
 * Convex dependency. The client uses this to:
 *   - estimate the server's current time via an EMA-smoothed clock offset
 *   - compute a monotonic, drift-compensated turn countdown
 *   - pause the clock and grant delay buffer when a packet/heartbeat latency
 *     exceeds LAG_PAUSE_THRESHOLD_MS (so the lagging peer is never unfairly
 *     timed out)
 *
 * Time source is injectable (`now()`) for deterministic tests.
 */

import { TIMING_CONSTANTS } from '../../constants.js';

export function createClockSync(opts = {}) {
    const now = opts.now || (() => Date.now());
    const alpha = TIMING_CONSTANTS.CLOCK_OFFSET_EMA_ALPHA;
    let offsetMs = 0; // estimated serverTime - localTime
    let hasOffset = false;
    let paused = false;
    let pausedServerAtStart = 0; // server time (est) when the pause began
    let delayBufferMs = 0; // total granted buffer from lag pauses

    return {
        /**
         * Feed a round-trip sample. t0 = local send time, tServer = server
         * recorded time, t1 = local receive time.
         * @returns {{rtt:number, rawOffset:number, smoothedOffset:number}}
         */
        sample(t0, tServer, t1) {
            const rtt = t1 - t0;
            const rawOffset = tServer - (t0 + t1) / 2;
            if (!hasOffset) {
                offsetMs = rawOffset;
                hasOffset = true;
            } else {
                offsetMs = (1 - alpha) * offsetMs + alpha * rawOffset;
            }
            return { rtt, rawOffset, smoothedOffset: offsetMs };
        },

        /** Estimated current SERVER time. */
        estimatedServerNow() {
            return now() + offsetMs;
        },

        /** Current smoothed offset in ms. */
        getOffset() {
            return offsetMs;
        },

        hasOffset() {
            return hasOffset;
        },

        /**
         * Begin a lag pause. While paused, the countdown is frozen (time does
         * not decrement for the lagging peer). Grants delay buffer proportional
         * to the latency above LAG_PAUSE_THRESHOLD_MS so unfair timeouts are
         * avoided (FR-3 / NFR-3).
         * @param {number} latencyMs - measured packet/heartbeat latency
         */
        beginPause(latencyMs) {
            if (!paused) {
                paused = true;
                pausedServerAtStart = this.estimatedServerNow();
            }
            const excess = Math.max(0, latencyMs - TIMING_CONSTANTS.LAG_PAUSE_THRESHOLD_MS);
            if (excess > 0) delayBufferMs += excess;
            return { paused: true, grantedBufferMs: excess };
        },

        /** End a lag pause. */
        endPause() {
            paused = false;
        },

        isPaused() {
            return paused;
        },

        /**
         * Remaining turn time in ms, monotonic and drift-compensated.
         * @param {number} turnEndServerTime - absolute server timestamp when turn ends
         * @returns {number} remaining ms (>= 0)
         */
        remaining(turnEndServerTime) {
            if (paused) {
                // Frozen at the server time captured when the pause began.
                // Buffer is NOT applied while paused; it extends the budget on resume.
                return Math.max(0, turnEndServerTime - pausedServerAtStart);
            }
            return Math.max(0, turnEndServerTime - this.estimatedServerNow() + delayBufferMs);
        },

        /** Total delay buffer granted (ms). */
        getDelayBuffer() {
            return delayBufferMs;
        },

        /** Reset all state (new match). */
        reset() {
            offsetMs = 0;
            hasOffset = false;
            paused = false;
            delayBufferMs = 0;
        },
    };
}

/**
 * Compute the server turn-end epoch from a server start time + duration.
 * @param {number} turnStartServerTime
 * @param {number} [durationMs]
 * @returns {number}
 */
export function computeTurnEnd(
    turnStartServerTime,
    durationMs = TIMING_CONSTANTS.TURN_DURATION_MS
) {
    return turnStartServerTime + durationMs;
}
