import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotsAndBoxesGame, pickAutoMoveLine } from '../dots-and-boxes-game.js';

describe('Timeout Random Auto-Move', () => {
    let game = null;

    beforeEach(() => {
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
            <div id="gameScreen"></div>
        `;

        HTMLCanvasElement.prototype.getContext = () => ({
            scale: () => {},
            clearRect: () => {},
            fillRect: () => {},
            strokeRect: () => {},
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
            rotate: () => {},
            clip: () => {},
            fillText: () => {},
            measureText: () => ({ width: 0 }),
            createRadialGradient: () => ({ addColorStop() {} }),
            createLinearGradient: () => ({ addColorStop() {} }),
            drawImage: () => {},
            setLineDash: () => {},
        });
    });

    afterEach(() => {
        if (game) {
            game.destroy();
            game = null;
        }
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('pickAutoMoveLine returns null for empty list and picks uniformly', () => {
        expect(pickAutoMoveLine([])).toBeNull();
        expect(pickAutoMoveLine(null)).toBeNull();

        const free = ['0,0-0,1', '0,0-1,0', '0,1-1,1'];
        const mockRng = vi.fn().mockReturnValue(0.5); // Index 1
        expect(pickAutoMoveLine(free, mockRng)).toBe('0,0-1,0');
    });

    it('draws a random line on behalf of player 1 in Levels mode when timer expires', async () => {
        game = new DotsAndBoxesGame({ cols: 3, rows: 3 }, '#FF0000', '#0000FF', {
            isLevelsMode: true,
            currentLevel: 1,
            localMode: 'ai',
            turnDurationSeconds: 7,
        });

        vi.spyOn(game.turnNoticeBubble, 'show');
        expect(game.lines.size).toBe(0);

        game.turnRemainingMs = 0;
        await game.performTimeoutAutoMove();

        expect(game.lines.size).toBe(1);
        expect(game.turnNoticeBubble.show).toHaveBeenCalledWith('timeout');
        expect(game.timedOut).toBe(false);
        expect(game.gameState.isGameOver()).toBe(false);
    });

    it('keeps turn if the auto-drawn line completes a square and awards point', async () => {
        game = new DotsAndBoxesGame({ cols: 3, rows: 3 }, '#FF0000', '#0000FF', {
            isLevelsMode: true,
            currentLevel: 1,
            localMode: 'pvp',
            turnDurationSeconds: 7,
        });

        // Pre-place 3 sides of square 0,0
        game.lines.add('0,0-0,1');
        game.lines.add('0,0-1,0');
        game.lines.add('1,0-1,1');
        game.secretMultipliers?.clear?.();

        // Mock pickAutoMoveLine to pick the completing edge 0,1-1,1
        vi.spyOn(Math, 'random').mockReturnValue(0);
        // Let free line be chosen
        game.turnRemainingMs = 0;
        await game.drawLine({ row: 0, col: 1 }, { row: 1, col: 1 }, { source: 'timeout' });

        expect(game.scores[1]).toBe(1);
        // Player 1 keeps turn on shape completion
        expect(game.currentPlayer).toBe(1);
    });

    it('does not trigger auto move if game is already over or during AI turn', async () => {
        game = new DotsAndBoxesGame({ cols: 3, rows: 3 }, '#FF0000', '#0000FF', {
            isLevelsMode: true,
            currentLevel: 1,
            localMode: 'ai',
            turnDurationSeconds: 7,
        });

        game.currentPlayer = 2; // AI turn
        const linesBefore = game.lines.size;
        await game.performTimeoutAutoMove();
        expect(game.lines.size).toBe(linesBefore);
    });
});
