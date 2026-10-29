import { describe, expect, it, vi } from 'vitest';

import { EffectSystem } from '../effect-system.js';
import {
    BASE_MINE_COUNT,
    FIRST_MINE_LEVEL,
    countHiddenMines,
    getMineCountForLevel,
    isMineMultiplier,
    placeMines,
} from '../effect-system/mines.js';
import { drawSquaresWithAnimations } from '../renderer/board.js';

/** Deterministic RNG (mulberry32) so placement assertions are stable. */
function seededRng(seed = 1) {
    let a = seed >>> 0;
    return () => {
        a += 0x6d2b79f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeGame(overrides = {}) {
    return {
        gridRows: 5,
        gridCols: 5,
        currentLevel: 1,
        squareMultipliers: {},
        revealedMultipliers: new Set(),
        ...overrides,
    };
}

describe('mine policy — level gate and doubling', () => {
    it('has no mines below level 15', () => {
        expect(FIRST_MINE_LEVEL).toBe(15);
        for (const level of [1, 5, 10, 14]) {
            expect(getMineCountForLevel(level, 40)).toBe(0);
        }
    });

    it('starts at 2 mines on level 15', () => {
        expect(getMineCountForLevel(15, 40)).toBe(BASE_MINE_COUNT);
        expect(getMineCountForLevel(24, 40)).toBe(2);
    });

    it('doubles every 10 levels', () => {
        expect(getMineCountForLevel(25, 400)).toBe(4);
        expect(getMineCountForLevel(35, 400)).toBe(8);
        expect(getMineCountForLevel(45, 400)).toBe(16);
        expect(getMineCountForLevel(55, 400)).toBe(32);
    });

    it('caps density so late boards never become all mines', () => {
        // Level 55 on a real 8x8 board is 49 boxes; 25% = 12.
        expect(getMineCountForLevel(55, 49)).toBe(12);
        // Level 100 on a 10x15 board is 126 boxes; 25% = 31.
        expect(getMineCountForLevel(100, 126)).toBe(31);
        // Never more mines than boxes, even on a tiny board.
        expect(getMineCountForLevel(100, 2)).toBe(2);
    });

    it('returns 0 for junk input', () => {
        expect(getMineCountForLevel(undefined, 40)).toBe(0);
        expect(getMineCountForLevel(20, 0)).toBe(0);
        expect(getMineCountForLevel(20, -5)).toBe(0);
    });
});

describe('mine placement', () => {
    it('returns exactly the requested number of distinct keys', () => {
        const keys = Array.from({ length: 49 }, (_, i) => `${Math.floor(i / 7)},${i % 7}`);
        const mines = placeMines(keys, 12, seededRng(7));

        expect(mines).toHaveLength(12);
        expect(new Set(mines).size).toBe(12);
        for (const key of mines) {
            expect(keys).toContain(key);
        }
    });

    it('is deterministic under an injected rng', () => {
        const keys = ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2'];
        expect(placeMines(keys, 2, seededRng(3))).toEqual(placeMines(keys, 2, seededRng(3)));
    });

    it('handles empty boards and zero counts', () => {
        expect(placeMines([], 5)).toEqual([]);
        expect(placeMines(['0,0'], 0)).toEqual([]);
        expect(placeMines(['0,0'], 99)).toEqual(['0,0']);
    });
});

describe('isMineMultiplier', () => {
    it('accepts the tagged mine shape and the legacy 0.2 value', () => {
        expect(isMineMultiplier({ type: 'multiplier', value: 0.2, isMine: true })).toBe(true);
        expect(isMineMultiplier({ type: 'multiplier', value: 0.2 })).toBe(true);
    });

    it('rejects rewards and empty entries', () => {
        expect(isMineMultiplier({ type: 'multiplier', value: 5 })).toBe(false);
        expect(isMineMultiplier({ type: 'multiplier', value: 0.5 })).toBe(false);
        expect(isMineMultiplier(undefined)).toBe(false);
        expect(isMineMultiplier({ type: 'truthOrDare' })).toBe(false);
    });
});

describe('countHiddenMines', () => {
    const board = {
        '0,0': { type: 'multiplier', value: 0.2, isMine: true },
        '0,1': { type: 'multiplier', value: 0.2, isMine: true },
        '1,0': { type: 'multiplier', value: 5 },
    };

    it('counts mines that have not fired', () => {
        expect(countHiddenMines(board, new Set())).toBe(2);
        expect(countHiddenMines(board, new Set(['0,0']))).toBe(1);
        expect(countHiddenMines(board, new Set(['0,0', '0,1']))).toBe(0);
    });

    it('accepts an array of revealed keys and tolerates empty stores', () => {
        expect(countHiddenMines(board, ['0,1'])).toBe(1);
        expect(countHiddenMines(null, new Set())).toBe(0);
        expect(countHiddenMines({}, new Set())).toBe(0);
    });
});

describe('EffectSystem — seeding', () => {
    it('seeds nothing on a level-1 board', () => {
        const game = makeGame({ currentLevel: 1 });
        new EffectSystem(game).initializeMultipliers();

        expect(Object.keys(game.squareMultipliers)).toHaveLength(0);
        expect(game.mineCount).toBe(0);
    });

    it('seeds 2 mines on level 15 and resets any previous table', () => {
        const game = makeGame({
            currentLevel: 15,
            squareMultipliers: { '9,9': { type: 'multiplier', value: 0.2 } },
        });
        new EffectSystem(game).initializeMultipliers();

        const keys = Object.keys(game.squareMultipliers);
        expect(keys).toHaveLength(2);
        expect(game.mineCount).toBe(2);
        expect(game.squareMultipliers['9,9']).toBeUndefined();
        for (const key of keys) {
            expect(game.squareMultipliers[key]).toEqual({
                type: 'multiplier',
                value: 0.2,
                isMine: true,
            });
        }
    });

    it('seeds the level-100 count on a 10x15 board', () => {
        const game = makeGame({ currentLevel: 100, gridRows: 15, gridCols: 10 });
        new EffectSystem(game).initializeMultipliers();

        expect(game.mineCount).toBe(31);
        expect(Object.keys(game.squareMultipliers)).toHaveLength(31);
    });
});

describe('board rendering — the fired mine keeps a 💣', () => {
    function makeCanvasGame(overrides = {}) {
        const fillText = vi.fn();
        const ctx = {
            fillRect: vi.fn(),
            fillText,
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
            setLineDash: vi.fn(),
        };

        return {
            fillText,
            game: {
                ctx,
                cellSize: 50,
                offsetX: 0,
                offsetY: 0,
                player1Color: '#ff0000',
                player2Color: '#0000ff',
                squares: { '0,0': 2 },
                squareAnimations: [],
                squareTaps: {},
                revealedMultipliers: new Set(['0,0']),
                squareMultipliers: {
                    '0,0': { type: 'multiplier', value: 0.2, isMine: true },
                },
                gameLogic: {
                    parseSquareKey: (key) => {
                        const [row, col] = key.split(',').map(Number);
                        return { row, col };
                    },
                },
                ...overrides,
            },
        };
    }

    it('draws the bomb glyph plus the ×0.2 value once revealed', () => {
        const { game, fillText } = makeCanvasGame();
        drawSquaresWithAnimations(game);

        const glyphs = fillText.mock.calls.map((call) => call[0]);
        expect(glyphs).toContain('💣');
        expect(glyphs).toContain('×0.2');
    });

    it('draws no bomb before the mine fires', () => {
        const { game, fillText } = makeCanvasGame({ revealedMultipliers: new Set() });
        drawSquaresWithAnimations(game);

        const glyphs = fillText.mock.calls.map((call) => call[0]);
        expect(glyphs).not.toContain('💣');
        expect(glyphs).not.toContain('×0.2');
    });
});
