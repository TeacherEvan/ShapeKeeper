/**
 * Server-side turn-deadline check.
 *
 * Pure helper so the rule is unit-testable without spinning up a Convex
 * deployment. The drawLine mutation calls this and short-circuits with
 * "Turn deadline expired" when the room's turnEndTime has passed.
 *
 * Boundary semantics: at the exact turnEndTime the turn is NOT yet expired
 * (the player has the final millisecond to make their move). Strict `>`
 * comparison.
 *
 * @param {{ turnEndTime?: number }} room
 * @param {number} [now=Date.now()]
 * @returns {boolean}
 */
export function isTurnExpired(room, now = Date.now()) {
    return typeof room?.turnEndTime === 'number' && now > room.turnEndTime;
}
