import { describe, expect, it, vi } from 'vitest';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';
import { drawLavaTimer } from '../renderer/lava-timer.js';

/**
 * Local Allowed Time (lava timer for hot-seat play).
 *
 * Drives the real game class under jsdom with a mocked canvas (same harness
 * as tests/ai-engine.test.js). The animation loop is stopped right after
 * construction so tickLocalTurnClock(now) can drive the clock
 * deterministically with explicit timestamps.
 */

const CANVAS_MOCK = () => ({
    scale() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    save() {},
    restore() {},
    translate() {},
    clip() {},
    fillText() {},
    measureText: () => ({ width: 0 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    drawImage() {},
    setLineDash() {},
});

function installDom() {
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
    HTMLCanvasElement.prototype.getContext = CANVAS_MOCK;
}

function makeLocalGame(turnDurationSeconds, { localMode = 'human' } = {}) {
    installDom();
    const game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', {
        localMode,
        turnDurationSeconds,
    });
    // Stop the rAF loop; the clock is driven manually below.
    game.destroy();
    game.turnRemainingMs = null;
    game._localTurnClock = null;
    return game;
}

describe('turnDurationSeconds option sanitising', () => {
    it('accepts a whole-second value', () => {
        expect(makeLocalGame(15).turnDurationSeconds).toBe(15);
    });

    it('floors fractional seconds', () => {
        expect(makeLocalGame(10.7).turnDurationSeconds).toBe(10);
    });

    it('clamps to the 600s maximum', () => {
        expect(makeLocalGame(9999).turnDurationSeconds).toBe(600);
    });

    it('falls back to 0 (no limit) for invalid values', () => {
        expect(makeLocalGame('abc').turnDurationSeconds).toBe(0);
        expect(makeLocalGame(-5).turnDurationSeconds).toBe(0);
        expect(makeLocalGame(undefined).turnDurationSeconds).toBe(0);
    });
});

describe('tickLocalTurnClock', () => {
    it('arms a full countdown on the first tick', () => {
        const game = makeLocalGame(3);
        game.tickLocalTurnClock(1_000);
        expect(game.turnRemainingMs).toBe(3000);
    });

    it('counts down as time passes', () => {
        const game = makeLocalGame(3);
        game.tickLocalTurnClock(1_000);
        game.tickLocalTurnClock(1_600);
        expect(game.turnRemainingMs).toBe(2400);
    });

    it('floors at 0 once the deadline passes', () => {
        const game = makeLocalGame(3);
        game.tickLocalTurnClock(1_000);
        game.tickLocalTurnClock(9_000);
        expect(game.turnRemainingMs).toBe(0);
    });

    it('re-arms with a full countdown when the active player changes', () => {
        const game = makeLocalGame(3);
        game.tickLocalTurnClock(1_000);
        game.currentPlayer = 2;
        game.tickLocalTurnClock(1_500);
        expect(game.turnRemainingMs).toBe(3000);
    });
});

describe('handleTurnExpiration (local hot-seat)', () => {
    it('does nothing while time remains', () => {
        const game = makeLocalGame(3);
        game.tickLocalTurnClock(1_000);
        game.handleTurnExpiration();
        expect(game.currentPlayer).toBe(1);
    });

    it('does nothing when no timer is set', () => {
        const game = makeLocalGame(0);
        game.handleTurnExpiration();
        expect(game.currentPlayer).toBe(1);
    });

    it('skips the expired turn to the next player and re-arms the clock', () => {
        const game = makeLocalGame(3);
        game.tickLocalTurnClock(1_000);
        game.tickLocalTurnClock(5_000); // deadline passed
        game.handleTurnExpiration();

        expect(game.currentPlayer).toBe(2);
        expect(game._localTurnClock.deadline).toBe(0); // re-armed

        // The next tick gives Player 2 a fresh full countdown.
        game.tickLocalTurnClock(5_100);
        expect(game.turnRemainingMs).toBe(3000);
    });

    it('keeps the turn (with a fresh clock) while a bonus turn is active', () => {
        const game = makeLocalGame(3);
        game.playerEffects[1].bonusTurns = 1;
        game.tickLocalTurnClock(1_000);
        game.tickLocalTurnClock(5_000);
        game.handleTurnExpiration();

        // Bonus turn consumed, player unchanged…
        expect(game.playerEffects[1].bonusTurns).toBe(0);
        expect(game.currentPlayer).toBe(1);
        // …and the re-armed clock still grants the full Allowed Time.
        game.tickLocalTurnClock(5_100);
        expect(game.turnRemainingMs).toBe(3000);
    });
});

describe('shouldRunLocalTurnClock gating', () => {
    it('runs for human hot-seat games with a timer set', () => {
        expect(makeLocalGame(5).shouldRunLocalTurnClock()).toBe(true);
    });

    it('does not run without a timer', () => {
        expect(makeLocalGame(0).shouldRunLocalTurnClock()).toBe(false);
    });

    it('does not run for AI mode (no human turn to time)', () => {
        expect(makeLocalGame(5, { localMode: 'ai' }).shouldRunLocalTurnClock()).toBe(false);
    });

    it('does not run for online games (server owns the clock)', () => {
        const game = makeLocalGame(5);
        game.isOnline = true;
        expect(game.shouldRunLocalTurnClock()).toBe(false);
    });
});

describe('drawLavaTimer without an active countdown', () => {
    function mockCtx() {
        const log = { text: [] };
        const ctx = {
            globalAlpha: 1,
            fillStyle: '',
            font: '',
            textAlign: '',
            textBaseline: '',
            save() {},
            restore() {},
            beginPath() {},
            arc() {},
            fill() {},
            createRadialGradient: () => ({ addColorStop() {} }),
            fillText(t) {
                log.text.push(String(t));
            },
        };
        return { ctx, log };
    }

    const board = {
        offsetX: 20,
        offsetY: 20,
        cellSize: 40,
        gridCols: 5,
        gridRows: 5,
        logicalWidth: 200,
        logicalHeight: 200,
    };

    it('renders nothing when turnRemainingMs is null (timer off)', () => {
        const { ctx, log } = mockCtx();
        drawLavaTimer({ ...board, ctx, turnRemainingMs: null });
        expect(log.text).toEqual([]);
    });

    it('renders the countdown when turnRemainingMs is set', () => {
        const { ctx, log } = mockCtx();
        drawLavaTimer({ ...board, ctx, turnRemainingMs: 5000 });
        expect(log.text.some((t) => t.includes('5.0s'))).toBe(true);
    });
});
