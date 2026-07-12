import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotsAndBoxesGame } from './dots-and-boxes-game.js';

describe('DotsAndBoxesGame rules engine and scoring', () => {
    let game;

    beforeEach(() => {
        // Setup JSDOM body mock elements required by DotsAndBoxesGame and UIManager
        document.body.innerHTML = `
            <canvas id="gameCanvas"></canvas>
            <div id="player1Score"></div>
            <div id="player2Score"></div>
            <div id="player1Info"></div>
            <div id="player2Info"></div>
            <div id="turnIndicator"></div>
            <button id="populateBtn"></button>
            <div id="gameLoadingSkeleton"></div>
            <button id="undoBtn"></button>
            <button id="redoBtn"></button>
            <button id="saveLocalBtn"></button>
            <button id="replayBackBtn"></button>
            <button id="replayForwardBtn"></button>
            <button id="replayRestartBtn"></button>
            <button id="soundToggle"></button>
        `;

        // Mock window methods that JSDOM does not provide
        window.devicePixelRatio = 1;
        navigator.maxTouchPoints = 0;
        window.matchMedia = vi.fn().mockReturnValue({ matches: false });

        // Mock canvas context
        HTMLCanvasElement.prototype.getContext = () => ({
            scale: () => {},
            clearRect: () => {},
            fillRect: () => {},
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            save: () => {},
            restore: () => {},
            translate: () => {},
            clip: () => {},
            fillText: () => {},
            measureText: () => ({ width: 0 }),
            createRadialGradient: () => ({
                addColorStop: () => {},
            }),
            createLinearGradient: () => ({
                addColorStop: () => {},
            }),
            drawImage: () => {},
        });

        // Instantiate a 3x3 game for quick tests
        // A 3x3 grid has 9 dots and 4 cells (squares)
        game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', { localMode: 'human' });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('initializes game state correctly', () => {
        expect(game.currentPlayer).toBe(1);
        expect(game.scores[1]).toBe(0);
        expect(game.scores[2]).toBe(0);
        expect(game.lines.size).toBe(0);
        expect(game.squares).toEqual({});
    });

    it('handles drawing normal lines and switches player turn', async () => {
        // Draw horizontal top-left line from (0,0) to (0,1)
        await game.drawLine({ row: 0, col: 0 }, { row: 0, col: 1 });

        // Line is recorded
        expect(game.lines.has('0,0-0,1')).toBe(true);
        expect(game.lineOwners.get('0,0-0,1')).toBe(1);

        // Turn switches to player 2 since no shape was completed
        expect(game.currentPlayer).toBe(2);
    });

    it('handles completed squares: awards points, retains turn', async () => {
        // Setup 3 lines of cell (0,0):
        // Top: (0,0)-(0,1), Left: (0,0)-(1,0), Bottom: (1,0)-(1,1)
        await game.drawLine({ row: 0, col: 0 }, { row: 0, col: 1 }); // Player 1
        await game.drawLine({ row: 0, col: 0 }, { row: 1, col: 0 }); // Player 2
        await game.drawLine({ row: 1, col: 0 }, { row: 1, col: 1 }); // Player 1 (back to player 1 after player 2 move)

        expect(game.currentPlayer).toBe(2); // Current is player 2

        // Draw the 4th line (Right): (0,1)-(1,1) to complete the square
        await game.drawLine({ row: 0, col: 1 }, { row: 1, col: 1 });

        // Player 2 completed cell "0,0"
        expect(game.squares['0,0']).toBe(2);
        expect(game.scores[2]).toBe(1);
        expect(game.scores[1]).toBe(0);

        // Player 2 keeps their turn
        expect(game.currentPlayer).toBe(2);
    });

    it('awards double points on square completion when double points effect is active', async () => {
        // Setup 3 lines
        await game.drawLine({ row: 0, col: 0 }, { row: 0, col: 1 }); // Player 1
        await game.drawLine({ row: 0, col: 0 }, { row: 1, col: 0 }); // Player 2
        await game.drawLine({ row: 1, col: 0 }, { row: 1, col: 1 }); // Player 1

        expect(game.currentPlayer).toBe(2);

        // Activate double points count for player 2
        game.playerEffects[2].doublePointsCount = 1;

        // Draw 4th line
        await game.drawLine({ row: 0, col: 1 }, { row: 1, col: 1 });

        // Player 2 score increases by 2 instead of 1
        expect(game.scores[2]).toBe(2);
        expect(game.playerEffects[2].doublePointsCount).toBe(0);
        expect(game.currentPlayer).toBe(2); // Turn retained
    });

    it('does not switch turn on non-completing line when double line effect is active', async () => {
        expect(game.currentPlayer).toBe(1);

        // Activate double line for player 1
        game.playerEffects[1].doubleLine = true;

        // Draw a non-completing line
        await game.drawLine({ row: 0, col: 0 }, { row: 0, col: 1 });

        // Player 1 turn is retained, doubleLine resets to false
        expect(game.currentPlayer).toBe(1);
        expect(game.playerEffects[1].doubleLine).toBe(false);
    });

    it('applies score multiplier bonus (multiplier - 1) on reveal', async () => {
        // Setup a completed square
        await game.drawLine({ row: 0, col: 0 }, { row: 0, col: 1 }); // Player 1
        await game.drawLine({ row: 0, col: 0 }, { row: 1, col: 0 }); // Player 2
        await game.drawLine({ row: 1, col: 0 }, { row: 1, col: 1 }); // Player 1
        await game.drawLine({ row: 0, col: 1 }, { row: 1, col: 1 }); // Player 2 completes square
        expect(game.scores[2]).toBe(1);

        // Inject ×5 multiplier on cell "0,0"
        game.squareMultipliers['0,0'] = { type: 'multiplier', value: 5 };

        // Reveal the multiplier
        await game.revealMultiplier('0,0');

        // Score increases by (5 - 1) = 4, resulting in 5 points total
        expect(game.scores[2]).toBe(5);
    });

    it('verifies game over conditions for squares', () => {
        // Only squares count toward the win condition
        game.squares = {
            '0,0': 1,
            '0,1': 1,
            '1,0': 2,
            '1,1': 2,
        };
        expect(game.gameState.isGameOver()).toBe(true);
    });
});
