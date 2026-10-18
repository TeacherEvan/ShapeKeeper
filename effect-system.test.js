import { describe, expect, it, vi } from 'vitest';

import { EffectSystem } from './effect-system.js';

function makeGame(overrides = {}) {
    return {
        gridRows: 6,
        gridCols: 6,
        squareMultipliers: {},
        revealedMultipliers: new Set(),
        scores: { 1: 5, 2: 3 },
        squares: { '0,0': 1 },
        draw: vi.fn(),
        uiManager: { updateUI: vi.fn() },
        animationSystem: { triggerMultiplierAnimation: vi.fn() },
        particleSystem: { createMultiplierParticles: vi.fn() },
        gameLogic: { parseSquareKey: (_k) => ({ row: 0, col: 0 }) },
        offsetX: 0,
        offsetY: 0,
        cellSize: 50,
        ...overrides,
    };
}

describe('EffectSystem — delegation', () => {
    it('constructs and sets game reference', () => {
        const game = makeGame();
        const sys = new EffectSystem(game);
        expect(sys.game).toBe(game);
    });

    it('initializeMultipliers delegates to the game multiplier store with 20% 0.2x multipliers', () => {
        const game = makeGame();
        const sys = new EffectSystem(game);
        sys.initializeMultipliers();
        // 5x5 grid of squares => 25 squares; 20% of 25 => 5 squares get 0.2x multiplier
        const keys = Object.keys(game.squareMultipliers);
        expect(keys.length).toBe(5);
        for (const k of keys) {
            expect(game.squareMultipliers[k]).toEqual({ type: 'multiplier', value: 0.2 });
        }
    });

    it('revealMultiplier applies multiplier in local mode', async () => {
        const game = makeGame({
            squareMultipliers: { '0,0': { type: 'multiplier', value: 2 } },
        });
        const sys = new EffectSystem(game);
        await sys.revealMultiplier('0,0');
        expect(game.revealedMultipliers.has('0,0')).toBe(true);
        expect(game.scores[1]).toBe(10); // 5 * 2
        expect(game.draw).toHaveBeenCalled();
    });

    it('tapSquare collapses opponent square multiplier in local mode', async () => {
        const game = makeGame({
            squareMultipliers: { '0,0': { type: 'multiplier', value: 3 } },
        });
        const sys = new EffectSystem(game);
        await sys.tapSquare('0,0');
        expect(game.squareMultipliers['0,0']).toEqual({ type: 'multiplier', value: 0.5 });
        expect(game.draw).toHaveBeenCalled();
    });

    it('announceTurnMessage updates indicator text and resets after timeout', () => {
        vi.useFakeTimers();
        const el = document.createElement('div');
        el.id = 'turnIndicator';
        el.textContent = 'Player 1 Turn';
        document.body.appendChild(el);

        const game = makeGame();
        const sys = new EffectSystem(game);
        sys.announceTurnMessage('Bonus Turn!', '#FF0000', 1000);

        expect(el.textContent).toBe('Bonus Turn!');
        vi.advanceTimersByTime(1000);
        expect(el.textContent).toBe('Player 1 Turn');

        document.body.removeChild(el);
        vi.useRealTimers();
    });
});
