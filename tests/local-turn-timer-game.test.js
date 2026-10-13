import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';
import { FEATURE_FLAGS } from '../constants.js';

describe('DotsAndBoxesGame local turn timer integration', () => {
    let game;

    beforeEach(() => {
        FEATURE_FLAGS.FEATURE_LAVA_TIMER = true;

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
    });

    afterEach(() => {
        if (game) {
            game.destroy();
            game = null;
        }
        vi.restoreAllMocks();
    });

    it('expires turn, switches player, and resets comboCount on timeout', () => {
        let currentTime = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

        game = new DotsAndBoxesGame(3, '#ff0000', '#0000ff', {
            localMode: 'human',
            turnDurationMs: 15000,
        });

        expect(game.currentPlayer).toBe(1);
        expect(game.localTurnTimer.enabled).toBe(true);

        game.comboCount = 3;

        // Tick midway
        currentTime = 8000;
        game.tickLocalTurnTimer();
        expect(game.currentPlayer).toBe(1);
        expect(game.comboCount).toBe(3);

        // Advance past deadline (1000 + 15000 = 16000)
        currentTime = 17000;
        game.tickLocalTurnTimer();

        // Turn expired -> Player 2's turn, comboCount reset
        expect(game.currentPlayer).toBe(2);
        expect(game.comboCount).toBe(0);
    });

    it('no expiry while AI is thinking or during AI turn', () => {
        let currentTime = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

        game = new DotsAndBoxesGame(3, '#ff0000', '#0000ff', {
            localMode: 'ai',
            turnDurationMs: 15000,
        });

        expect(game.currentPlayer).toBe(1);
        expect(game.isAITurn()).toBe(false);

        // Switch to AI turn (player 2)
        game.currentPlayer = 2;
        game.restartLocalTurnTimer();

        expect(game.isAITurn()).toBe(true);
        expect(game.turnRemainingMs).toBeNull();

        currentTime = 30000;
        game.tickLocalTurnTimer();
        // Turn did not expire, player stays 2
        expect(game.currentPlayer).toBe(2);
    });

    it('turnDurationMs: 0 leaves turnRemainingMs === null', () => {
        game = new DotsAndBoxesGame(3, '#ff0000', '#0000ff', {
            localMode: 'human',
            turnDurationMs: 0,
        });

        expect(game.localTurnTimer.enabled).toBe(false);
        game.tickLocalTurnTimer();
        expect(game.turnRemainingMs).toBeNull();
    });

    it('tutorial mode disables turn timer', () => {
        game = new DotsAndBoxesGame(3, '#ff0000', '#0000ff', {
            localMode: 'human',
            tutorialEnabled: true,
            turnDurationMs: 15000,
        });

        expect(game.localTurnTimer.enabled).toBe(false);
        expect(game.turnRemainingMs).toBeNull();
    });
});
