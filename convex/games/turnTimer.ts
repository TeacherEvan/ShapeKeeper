export const ALLOWED_TURN_DURATIONS_MS = [0, 10000, 15000, 30000, 60000] as const;
export const DEFAULT_TURN_DURATION_MS = 15000;

/** Unknown/legacy values => 0 (Off), so rooms created before this feature stay untimed. */
export function normalizeTurnDuration(value: unknown): number {
    return typeof value === 'number' && (ALLOWED_TURN_DURATIONS_MS as readonly number[]).includes(value)
        ? value
        : 0;
}
