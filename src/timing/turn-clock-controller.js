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
    let lastDurationMs = 0;
    let turnKey = null;
    let pendingLocalSendAt = null;
    let lastSampledServerReceivedAt = null;
    let pauseResumeTimeout = null;

    function clearPauseTimer() {
        if (pauseResumeTimeout !== null) {
            clearTimeout(pauseResumeTimeout);
            pauseResumeTimeout = null;
        }
    }

    return {
        clock,

        markLocalMoveSent(ts = Date.now()) {
            pendingLocalSendAt = ts;
        },

        /**
         * Feed an authoritative room update.
         * @param {object} room - must contain turnEndTime, optional
         *        lastTurnClientSentAt / lastTurnServerReceivedAt
         */
        onAuthoritativeRoom(room) {
            if (!room) return;
            lastDurationMs = room.turnDurationMs ?? 0;
            const nextTurnKey = room.turnEndTime ?? null;
            if (nextTurnKey !== turnKey) {
                clearPauseTimer();
                clock.resetTurnBuffer();
            }
            turnKey = nextTurnKey;

            // Seed the clock offset ONLY from our own move's RTT sample (FR-2).
            // Comparing a remote opponent's wall clock against server time mixes
            // two unsynchronized clocks and triggers false lag pauses.
            if (
                pendingLocalSendAt !== null &&
                typeof room.lastTurnClientSentAt === 'number' &&
                typeof room.lastTurnServerReceivedAt === 'number' &&
                room.lastTurnClientSentAt === pendingLocalSendAt &&
                room.lastTurnServerReceivedAt !== lastSampledServerReceivedAt
            ) {
                lastSampledServerReceivedAt = room.lastTurnServerReceivedAt;
                const receiveTime = Date.now();
                const latency = Math.max(0, receiveTime - room.lastTurnClientSentAt);
                pendingLocalSendAt = null;
                lastLatencySampleMs = latency;
                clock.sample(room.lastTurnClientSentAt, room.lastTurnServerReceivedAt, receiveTime);

                if (
                    FEATURE_FLAGS.FEATURE_SYNC_RESILIENCE &&
                    latency > TIMING_CONSTANTS.LAG_PAUSE_THRESHOLD_MS
                ) {
                    clock.beginPause(latency);
                    clearPauseTimer();
                    pauseResumeTimeout = setTimeout(
                        () => {
                            clock.endPause();
                            pauseResumeTimeout = null;
                        },
                        Math.min(Math.max(latency, 300), 1500)
                    );
                }
            }

            lastTurnEndTime = typeof room.turnEndTime === 'number' ? room.turnEndTime : null;
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

        getDurationMs() {
            return lastDurationMs;
        },

        getTurnKey() {
            return turnKey;
        },

        /** Clear turn state (match finished / left). */
        clear() {
            clearPauseTimer();
            lastTurnEndTime = null;
            lastDurationMs = 0;
            turnKey = null;
            pendingLocalSendAt = null;
            lastSampledServerReceivedAt = null;
            game.turnRemainingMs = null;
            clock.reset();
        },
    };
}
