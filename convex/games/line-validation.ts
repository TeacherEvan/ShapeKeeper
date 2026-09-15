import { normalizeLineKey } from './shared';
import { log, errorLog, warn } from '../log';

/**
 * Validate and canonicalize a line key against the room's dot grid.
 * Client-side validation is UX only; this function is the trust boundary.
 */
export function validateLineKey(lineKey: unknown, gridSize: number): string | null {
    if (typeof lineKey !== 'string' || !Number.isInteger(gridSize) || gridSize < 2) return null;

    const match = /^(\d+),(\d+)-(\d+),(\d+)$/.exec(lineKey);
    if (!match) return null;

    const [, r1s, c1s, r2s, c2s] = match;
    const r1 = Number(r1s);
    const c1 = Number(c1s);
    const r2 = Number(r2s);
    const c2 = Number(c2s);

    if (![r1, c1, r2, c2].every(Number.isSafeInteger)) return null;
    if ([r1, c1, r2, c2].some((value) => value < 0 || value >= gridSize)) return null;

    const adjacent =
        (Math.abs(r1 - r2) === 1 && c1 === c2) ||
        (Math.abs(c1 - c2) === 1 && r1 === r2);
    if (!adjacent) return null;

    const normalized = normalizeLineKey(r1, c1, r2, c2);
    return normalized === lineKey ? lineKey : null;
}
