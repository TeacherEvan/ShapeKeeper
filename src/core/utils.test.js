import { describe, expect, it } from 'vitest';
import { areAdjacent, getLineKey, parseLineKey } from './utils.js';

describe('Line Key Utilities', () => {
    it('should normalize line key regardless of dot order', () => {
        const dot1 = { row: 0, col: 0 };
        const dot2 = { row: 0, col: 1 };

        const key1 = getLineKey(dot1, dot2);
        const key2 = getLineKey(dot2, dot1);

        expect(key1).toBe('0,0-0,1');
        expect(key2).toBe('0,0-0,1');
        expect(key1).toBe(key2);
    });

    it('should parse line key back to dots', () => {
        const key = '0,0-0,1';
        const [start, end] = parseLineKey(key);

        expect(start).toEqual({ row: 0, col: 0 });
        expect(end).toEqual({ row: 0, col: 1 });
    });
});

describe('Dot Utilities', () => {
    it('should correctly identify adjacent dots', () => {
        const dot = { row: 1, col: 1 };

        expect(areAdjacent(dot, { row: 1, col: 2 })).toBe(true); // Right
        expect(areAdjacent(dot, { row: 1, col: 0 })).toBe(true); // Left
        expect(areAdjacent(dot, { row: 0, col: 1 })).toBe(true); // Up
        expect(areAdjacent(dot, { row: 2, col: 1 })).toBe(true); // Down
    });

    it('should return false for non-adjacent dots', () => {
        const dot = { row: 1, col: 1 };

        expect(areAdjacent(dot, { row: 1, col: 3 })).toBe(false); // Too far
        expect(areAdjacent(dot, { row: 2, col: 2 })).toBe(false); // Diagonal
        expect(areAdjacent(dot, { row: 1, col: 1 })).toBe(false); // Same dot
    });
});
