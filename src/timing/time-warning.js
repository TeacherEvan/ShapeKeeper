import { announceAlert } from '../ui/AccessibilityAnnouncer.js';

const announced = new WeakMap();

/** Announce "N seconds left" once per turn. `turnKey` changes every turn. */
export function maybeAnnounceTimeLow(owner, turnKey, remainingMs, durationMs) {
    if (!Number.isFinite(remainingMs) || !Number.isFinite(durationMs) || durationMs <= 0) return;
    const threshold = Math.min(10000, Math.floor(durationMs / 2));
    if (remainingMs > threshold || announced.get(owner) === turnKey) return;
    announced.set(owner, turnKey);
    announceAlert(`${Math.ceil(threshold / 1000)} seconds left`);
}
