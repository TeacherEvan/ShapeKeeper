/**
 * Turn Clock Controller (FR-2 / FR-3 / NFR-3)
 *
 * Bridges authoritative Convex room timing into the client:
 *  - seeds the monotonic ClockSync offset from each authoritative state
 *    (using lastTurnClientSentAt / lastTurnServerReceivedAt as an RTT sample)
 *  - derives game.turnRemainingMs from the server's turnEndTime
 *  - exposes a tick() the render loop calls to keep the countdown live
 *  - triggers the lag pause when measured round-trip latency exceeds threshold
 *
 * Framework-free and unit-tested (tests/client-sync-integration.test.js).
 */

import { createClockSync } from './clock-sync.js';
import { TIMING_CONSTANTS, FEATURE_FLAGS } from '../../constants.js';

export function createTurnClockController(game) {
    const clock = createClockSync();
    let lastTurnEndTime = null;
    let lastLatencySampleMs = 0;

    return {
        clock,

        /**
         * Feed an authoritative room update.
         * @param {object} room - must contain turnEndTime, optional
         *        lastTurnClientSentAt / lastTurnServerReceivedAt
         */
        onAuthoritativeRoom(room) {
            if (!room) return;

            // Seed the clock offset from the last move's RTT sample (FR-2).
            if (
                typeof room.lastTurnClientSentAt === 'number' &&
                typeof room.lastTurnServerReceivedAt === 'number'
            ) {
                // Server-measured one-way up-leg latency (what the backend
                // actually recorded). Used for the lag-pause decision (FR-3).
                const latency = room.lastTurnServerReceivedAt - room.lastTurnClientSentAt;
                lastLatencySampleMs = latency;
                // Offset smoothing sample: t0 = client send, tServer = server
                // receive, t1 = our local now (proxy for client receive).
                clock.sample(room.lastTurnClientSentAt, room.lastTurnServerReceivedAt, Date.now());

                // Auto-pause when the up-leg latency exceeded the threshold (FR-3).
                if (
                    FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE &&
                    latency > TIMING_CONSTANTS.LAG_PAUSE_THRESHOLD_MS
                ) {
                    clock.beginPause(latency);
                }
            }

            if (typeof room.turnEndTime === 'number') {
                lastTurnEndTime = room.turnEndTime;
            }
        },

        /**
         * Per-frame tick: refresh game.turnRemainingMs from the clock.
         * @returns {number|null} remaining ms (null when no active turn)
         */
        tick() {
            if (!FEATURE_FLAGS.FEATURE_LAVA_TIMER && !FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE) {
                return null;
            }
            if (lastTurnEndTime == null) {
                game.turnRemainingMs = null;
                return null;
            }
            const remaining = clock.remaining(lastTurnEndTime);
            game.turnRemainingMs = remaining;
            return remaining;
        },

        /** Last measured round-trip latency (ms). */
        getLastLatency() {
            return lastLatencySampleMs;
        },

        /** Clear turn state (match finished / left). */
        clear() {
            lastTurnEndTime = null;
            game.turnRemainingMs = null;
            clock.reset();
        },
    };
}
