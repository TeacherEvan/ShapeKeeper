import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';

describe('populate batch invariants', () => {
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

        game = new DotsAndBoxesGame(4, '#FF0000', '#0000FF', { localMode: 'human' });
    });

    afterEach(() => {
        game?.destroy();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('incremental populate selection never creates a completed 4-sided square in a single batch', async () => {
        // Pre-place 2 edges of cell (0,0): top (0,0-0,1) and left (0,0-1,0)
        game.lines.add('0,0-0,1');
        game.lines.add('0,0-1,0');

        await game.gameState.handlePopulate();

        // Check if cell (0,0) was accidentally completed by the populate batch
        const hasBottom = game.lines.has('1,0-1,1');
        const hasRight = game.lines.has('0,1-1,1');
        const completedTogether = hasBottom && hasRight;

        expect(completedTogether).toBe(false);
        // Squares dictionary should remain empty because populate is strictly non-scoring safe lines
        expect(Object.keys(game.squares).length).toBe(0);
    });

    it('updating initialLocalSnapshot on populate allows clean reset/replay without ghost lines', async () => {
        const initialCount = game.lines.size;
        await game.gameState.handlePopulate();
        expect(game.lines.size).toBeGreaterThan(initialCount);

        // initialLocalSnapshot must match the post-populate lines count
        expect(game.initialLocalSnapshot.lines.length).toBe(game.lines.size);
    });
});
