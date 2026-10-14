/**
 * Turn duration resolution (Allowed Time feature).
 *
 * Pure helper so the rule is unit-testable without a Convex deployment.
 * The room's `turnDurationSeconds` (host-configured in the lobby) decides
 * how long each turn lasts:
 *   - undefined  -> legacy rooms: default 10s (TIMING_CONSTANTS default)
 *   - 0          -> no limit (the turn clock is not armed)
 *   - n > 0      -> n seconds
 *
 * Returns the duration in MILLISECONDS, or 0 for "no limit".
 */

export const DEFAULT_TURN_DURATION_SECONDS = 10;
export const MAX_TURN_DURATION_SECONDS = 600; // 10 minutes ceiling
export const MIN_TURN_DURATION_SECONDS = 0; // 0 = no limit

/**
 * Resolve a room's configured turn duration to milliseconds.
 * @param {{ turnDurationSeconds?: number }} room
 * @returns {number} duration in ms; 0 means "no limit"
 */
export function resolveTurnDurationMs(room) {
    const seconds = room?.turnDurationSeconds;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
        return DEFAULT_TURN_DURATION_SECONDS * 1000;
    }
    if (seconds <= 0) return 0;
    return Math.round(seconds * 1000);
}

/**
 * Validate a host-supplied turn duration (seconds) for the lobby control.
 * @param {unknown} seconds
 * @returns {{ ok: true, seconds: number } | { ok: false, error: string }}
 */
export function validateTurnDurationSeconds(seconds) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
        return { ok: false, error: 'Turn duration must be a number of seconds' };
    }
    if (!Number.isInteger(seconds)) {
        return { ok: false, error: 'Turn duration must be a whole number of seconds' };
    }
    if (seconds < MIN_TURN_DURATION_SECONDS || seconds > MAX_TURN_DURATION_SECONDS) {
        return {
            ok: false,
            error: `Turn duration must be between ${MIN_TURN_DURATION_SECONDS} and ${MAX_TURN_DURATION_SECONDS} seconds`,
        };
    }
    return { ok: true, seconds };
}

/**
 * Compute the absolute server turn-end epoch for a turn starting now.
 * Returns null when the room has no time limit (duration 0).
 * @param {{ turnDurationSeconds?: number }} room
 * @param {number} [now] server epoch ms
 * @returns {number|null}
 */
export function computeTurnEndTime(room, now = Date.now()) {
    const durationMs = resolveTurnDurationMs(room);
    if (durationMs <= 0) return null;
    return now + durationMs;
}
