import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';
import { LevelsProgress } from '../src/ui/LevelsProgress.js';

describe('Levels mode timer scaling & timeout splash pop-up', () => {
    let game = null;

    beforeEach(() => {
        localStorage.clear();

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
            <div id="gameOverSplashOverlay" class="game-over-splash-overlay" hidden>
                <div class="game-over-splash-card">
                    <div id="gameOverSplashBadge">⏰ TIME'S UP!</div>
                    <h2 id="gameOverSplashTitle">GAME OVER</h2>
                    <p id="gameOverSplashSubtitle"></p>
                    <div id="gameOverSplashScores"></div>
                    <button id="splashRetryLevelBtn" type="button"></button>
                    <button id="splashLevelsGridBtn" type="button"></button>
                    <button id="splashMainMenuBtn" type="button"></button>
                </div>
            </div>
            <section id="winnerScreen" class="screen" hidden>
                <div class="winner-container">
                    <h1 id="winnerScreenTitle">Game Over!</h1>
                    <h2 id="winnerText"></h2>
                    <div id="finalScores" class="final-scores"></div>
                    <button id="playAgain"></button>
                    <button id="winnerLevelsBtn" hidden></button>
                    <button id="winnerMainMenu"></button>
                </div>
            </section>
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

    it('initializes Level 1 with 7s base turn duration when 0 levels completed', () => {
        game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', {
            isLevelsMode: true,
            currentLevel: 1,
            localMode: 'ai',
        });

        expect(game.turnDurationSeconds).toBe(7);
        expect(game.turnDurationMs).toBe(7000);
        expect(game.timedOut).toBe(false);
        expect(game.gameState.isGameOver()).toBe(false);
    });

    it('initializes higher levels with 7s + 2s * completedLevels turn duration', () => {
        LevelsProgress.recordLevelWin(1);
        LevelsProgress.recordLevelWin(2);

        game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', {
            isLevelsMode: true,
            currentLevel: 3,
            localMode: 'ai',
        });

        // 2 levels completed -> 7 + 2*2 = 11s
        expect(game.turnDurationSeconds).toBe(11);
        expect(game.turnDurationMs).toBe(11000);
    });

    it('handles turn expiration cleanly without freezing or crashing into maybeRunAITurn', () => {
        game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', {
            isLevelsMode: true,
            currentLevel: 1,
            localMode: 'ai',
            turnDurationSeconds: 7,
        });

        // Reset _localTurnClock before manually driving tickLocalTurnClock
        game._localTurnClock = null;
        game.turnRemainingMs = null;

        // Arm clock and simulate time running out
        game.tickLocalTurnClock(1000);
        expect(game.turnRemainingMs).toBe(7000);

        game.tickLocalTurnClock(8500); // 7.5s elapsed > 7s deadline
        expect(game.turnRemainingMs).toBe(0);

        // Expiration must not throw TypeError and must mark game as timed out
        expect(() => game.handleTurnExpiration()).not.toThrow();
        expect(game.timedOut).toBe(true);
        expect(game.gameState.isGameOver()).toBe(true);

        // Game over splash pop-up should be visible with retry button
        const overlay = document.getElementById('gameOverSplashOverlay');
        expect(overlay.hidden).toBe(false);
        expect(document.getElementById('gameOverSplashTitle').textContent).toBe('GAME OVER');
        expect(document.getElementById('splashRetryLevelBtn').textContent).toContain(
            'Retry Level 1'
        );
    });

    it('resets local turn clock deadline when player draws a line completing a square', async () => {
        game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', {
            isLevelsMode: true,
            currentLevel: 1,
            localMode: 'pvp',
            turnDurationSeconds: 7,
        });

        // Reset _localTurnClock before manually driving tickLocalTurnClock
        game._localTurnClock = null;
        game.turnRemainingMs = null;

        // Arm clock at t = 1000ms
        game.tickLocalTurnClock(1000);
        expect(game.turnRemainingMs).toBe(7000);

        // Advance to t = 3000ms (2s elapsed -> 5000ms remaining)
        game.tickLocalTurnClock(3000);
        expect(game.turnRemainingMs).toBe(5000);

        // Pre-place 3 sides of square (0,0) directly into lines set to avoid premature turn switches
        const line1 = game.gameLogic.getLineKey({ row: 0, col: 0 }, { row: 0, col: 1 });
        const line2 = game.gameLogic.getLineKey({ row: 0, col: 0 }, { row: 1, col: 0 });
        const line3 = game.gameLogic.getLineKey({ row: 1, col: 0 }, { row: 1, col: 1 });
        game.lines.add(line1);
        game.lines.add(line2);
        game.lines.add(line3);
        game.lineOwners.set(line1, 1);
        game.lineOwners.set(line2, 1);
        game.lineOwners.set(line3, 1);

        // Drawing the 4th line completes the square, keeping turn with player 1 and resetting the clock
        await game.drawLine({ row: 0, col: 1 }, { row: 1, col: 1 });

        // Verify clock was re-armed: next clock tick at 3500ms provides fresh full duration (7000ms)
        game.tickLocalTurnClock(3500);
        expect(game.turnRemainingMs).toBe(7000);
    });

    it('pauses and resumes _localTurnClock on visibilitychange without unfair expiry', () => {
        game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', {
            isLevelsMode: true,
            currentLevel: 1,
            localMode: 'ai',
            turnDurationSeconds: 7,
        });

        // Reset _localTurnClock before manually driving tickLocalTurnClock
        game._localTurnClock = null;
        game.turnRemainingMs = null;

        // Arm at t = 1000ms
        vi.spyOn(Date, 'now').mockReturnValue(1000);
        game.tickLocalTurnClock(1000);
        expect(game.turnRemainingMs).toBe(7000);

        // Simulate 2 seconds passing
        vi.spyOn(Date, 'now').mockReturnValue(3000);
        game.tickLocalTurnClock(3000);
        expect(game.turnRemainingMs).toBe(5000);

        // Document becomes hidden (user switches tab)
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));

        // 10 seconds pass while in background tab
        vi.spyOn(Date, 'now').mockReturnValue(13000);

        // Document becomes visible again
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        document.dispatchEvent(new Event('visibilitychange'));

        // Clock resumed with remaining 5000ms from t = 13000ms
        game.tickLocalTurnClock(13000);
        expect(game.turnRemainingMs).toBe(5000);
        expect(game.timedOut).toBe(false);
    });
});
