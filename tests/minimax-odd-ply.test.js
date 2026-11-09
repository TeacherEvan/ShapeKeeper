import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';
import { findOptimalMinimaxMove } from '../src/ai/MinimaxEngine.js';

describe('Minimax odd-ply horizon polarity', () => {
    let game;

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
        `;

        window.devicePixelRatio = 1;
        navigator.maxTouchPoints = 0;
        window.matchMedia = vi.fn().mockReturnValue({ matches: false });
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
            createRadialGradient: () => ({ addColorStop: () => {} }),
            createLinearGradient: () => ({ addColorStop: () => {} }),
            drawImage: () => {},
        });

        game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', {
            localMode: 'ai',
            aiDifficulty: 'hard',
        });
        game.currentPlayer = 2; // AI turn
    });

    afterEach(() => {
        game?.destroy();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('depth 1 search does not prefer creating a 3-edge square for the human opponent', () => {
        // Pre-place 2 edges of cell (0,0): left (0,0-1,0) and bottom (1,0-1,1)
        game.lines.add('0,0-1,0');
        game.lines.add('1,0-1,1');

        // Drawing top (0,0-0,1) would give cell (0,0) its 3rd edge, gifting a capture to human next turn
        const bestMove = findOptimalMinimaxMove(
            game.gameLogic,
            game.lines,
            game.gridRows,
            game.gridCols,
            1
        );

        expect(bestMove).not.toBeNull();
        expect(bestMove).not.toBe('0,0-0,1');
        expect(bestMove).not.toBe('0,1-1,1');
    });

    it('depth 3 search prioritizes safe moves over conceding 3-edge opportunities', () => {
        // Pre-place 2 edges of cell (0,0)
        game.lines.add('0,0-1,0');
        game.lines.add('1,0-1,1');

        const bestMove = findOptimalMinimaxMove(
            game.gameLogic,
            game.lines,
            game.gridRows,
            game.gridCols,
            3
        );

        expect(bestMove).not.toBeNull();
        // Safe line elsewhere on 3x3 grid must be chosen over creating a 3-edge trap
        expect(bestMove).not.toBe('0,0-0,1');
        expect(bestMove).not.toBe('0,1-1,1');
    });
});
