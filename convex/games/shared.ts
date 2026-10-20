import { log, errorLog, warn } from '../log';

export const POPULATE_PLAYER_INDEX = 2;

export function normalizeLineKey(r1: number, c1: number, r2: number, c2: number): string {
    if (r1 < r2 || (r1 === r2 && c1 < c2)) {
        return `${r1},${c1}-${r2},${c2}`;
    }
    return `${r2},${c2}-${r1},${c1}`;
}

export function getAllLineKeys(gridSize: number): string[] {
    const lines: string[] = [];
    if (!Number.isInteger(gridSize) || gridSize < 2) return lines;

    // Horizontal lines
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize - 1; c++) {
            lines.push(`${r},${c}-${r},${c + 1}`);
        }
    }
    // Vertical lines
    for (let r = 0; r < gridSize - 1; r++) {
        for (let c = 0; c < gridSize; c++) {
            lines.push(`${r},${c}-${r + 1},${c}`);
        }
    }
    return lines;
}

export function pickRandomFreeLine(
    allLines: string[],
    drawnLines: Set<string> | string[],
    rng: () => number = Math.random
): string | null {
    const drawnSet = drawnLines instanceof Set ? drawnLines : new Set(drawnLines);
    const free = allLines.filter((line) => !drawnSet.has(line));
    if (free.length === 0) return null;
    return free[Math.floor(rng() * free.length)] || null;
}

export function generateMultiplier():
    | { type: 'multiplier' | 'truthOrDare'; value?: number }
    | undefined {
    const rand = Math.random() * 100;

    if (rand < 60) return { type: 'multiplier', value: 2 };
    if (rand < 80) return { type: 'multiplier', value: 3 };
    if (rand < 90) return { type: 'multiplier', value: 4 };
    if (rand < 95) return { type: 'multiplier', value: 5 };
    if (rand < 96) return { type: 'multiplier', value: 10 };
    if (rand < 100) return { type: 'truthOrDare' };

    return undefined;
}
