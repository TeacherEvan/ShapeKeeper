import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';

// Deterministic PRNG so Math.random()-driven move selection is reproducible.
function installPRNG(seed = 1) {
    let s = seed >>> 0;
    const rng = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
    vi.spyOn(Math, 'random').mockImplementation(rng);
    return rng;
}

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

function makeAI(difficulty) {
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
    const game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', {
        localMode: 'ai',
        aiDifficulty: difficulty,
    });
    // Hand the turn to the AI so chooseAIMove paths that branch on isAITurn work.
    game.currentPlayer = game.aiPlayerNumber;
    return game;
}

// Add a line by dot coordinates (normalized via getLineKey).
function addLine(game, dot1, dot2) {
    game.lines.add(game.getLineKey(dot1, dot2));
}

describe('AI engine — chooseAIMove', () => {
    beforeEach(() => {
        installPRNG(7);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns null when no lines remain (grid saturated)', () => {
        const game = makeAI('hard');
        // Fill every possible line on a 3x3 grid.
        const all = game.gameLogic.getAllPossibleLines();
        for (const l of all) game.lines.add(l);
        expect(game.chooseAIMove()).toBeNull();
    });

    it('always returns a valid, currently-unclaimed line', () => {
        const game = makeAI('hard');
        const move = game.chooseAIMove();
        expect(move).toBeTruthy();
        expect(game.lines.has(move)).toBe(false);
        // It must be a real line key.
        expect(game.gameLogic.getAllPossibleLines()).toContain(move);
    });

    it('easy AI returns a drawing move (smoke, non-null)', () => {
        const game = makeAI('easy');
        expect(game.chooseAIMove()).toBeTruthy();
    });

    it('medium & hard AI capture an available square when one exists', () => {
        // Build 3 of the 4 edges of cell (0,0): top, left, bottom.
        // The remaining edge (right: 0,1-1,1) completes the square.
        for (const diff of ['medium', 'hard']) {
            const game = makeAI(diff);
            addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 }); // top
            addLine(game, { row: 0, col: 0 }, { row: 1, col: 0 }); // left
            addLine(game, { row: 1, col: 0 }, { row: 1, col: 1 }); // bottom
            const move = game.chooseAIMove();
            expect(move).toBe('0,1-1,1'); // the completing (right) edge
        }
    });

    it('hard AI prefers not conceding an immediate square to the opponent (1-ply lookahead)', () => {
        // Open board, no immediate capture available. Hard must choose a SAFE
        // line (one that does not give the opponent a 3-edge square) over a line
        // that hands the opponent an immediate completion.
        const game = makeAI('hard');
        // Pre-place a line so that one candidate would open a 3-edge trap for the
        // opponent. Concretely: fill 3 edges of cell (0,0) EXCEPT the top edge
        // (0,0)-(0,1); if the AI draws that top edge it completes its own square,
        // so that is preferred. Otherwise it must avoid the line that yields the
        // opponent a 3-edge (2-edge-complete) opportunity.
        addLine(game, { row: 0, col: 0 }, { row: 1, col: 0 }); // left of (0,0)
        addLine(game, { row: 1, col: 0 }, { row: 1, col: 1 }); // bottom of (0,0)
        // Now drawing (0,0)-(0,1) [top] would be the 3rd edge of (0,0); the
        // opponent could then draw the right edge to capture. A safe line is one
        // that leaves no square with 3 edges for the opponent.
        const move = game.chooseAIMove();
        // The chosen line must NOT be one that immediately gives the opponent a
        // 3-edge square on the very next turn.
        expect(move).toBeTruthy();
        // Simulate drawing it, then verify the opponent cannot complete a square
        // with a single move from the resulting position.
        game.lines.add(move);
        const opponentLines = game.gameLogic
            .getAllPossibleLines()
            .filter((l) => !game.lines.has(l));
        const givesOpponentCapture = opponentLines.some((l) =>
            game.gameLogic.wouldCompleteSquare(l)
        );
        expect(givesOpponentCapture).toBe(false);
    });
});

describe('AI engine — lookahead scoring helpers', () => {
    beforeEach(() => {
        installPRNG(3);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('evaluateImmediateSquareGain counts squares the line would complete', () => {
        const game = makeAI('hard');
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 }); // top of (0,0)
        addLine(game, { row: 0, col: 0 }, { row: 1, col: 0 }); // left of (0,0)
        addLine(game, { row: 1, col: 0 }, { row: 1, col: 1 }); // bottom of (0,0)
        // The right edge completes exactly one square.
        expect(game.evaluateImmediateSquareGain('0,1-1,1')).toBe(1);
        // A far, unrelated line completes nothing.
        expect(game.evaluateImmediateSquareGain('2,0-2,1')).toBe(0);
    });

    it('opponentBestGainAfter restores line state after simulation', () => {
        const game = makeAI('hard');
        const before = game.lines.size;
        const gain = game.opponentBestGainAfter('0,0-0,1');
        expect(gain).toBeGreaterThanOrEqual(0);
        // The simulated line must not persist.
        expect(game.lines.has('0,0-0,1')).toBe(false);
        expect(game.lines.size).toBe(before);
    });

    it('evaluateSafeLineStrength rewards safe lines and penalizes 3-edge traps', () => {
        const game = makeAI('hard');
        // Three edges of cell (0,0) present; the right edge (0,1-1,1) COMPLETES
        // the square (good for the mover) but also leaves a 3-edge square for
        // the opponent, so its safe-line strength is negative.
        addLine(game, { row: 0, col: 0 }, { row: 0, col: 1 }); // top of (0,0)
        addLine(game, { row: 0, col: 0 }, { row: 1, col: 0 }); // left of (0,0)
        addLine(game, { row: 1, col: 0 }, { row: 1, col: 1 }); // bottom of (0,0)
        expect(game.evaluateSafeLineStrength('0,1-1,1')).toBe(-1);

        // A line far from any near-complete square (bottom row (2,0)-(2,1)) is safe.
        expect(game.evaluateSafeLineStrength('2,0-2,1')).toBe(2);

        // The top edge that would create a 3-edge square for the opponent is penalized.
        expect(game.evaluateSafeLineStrength('0,0-0,1')).toBe(-3);
    });
});

describe('AI engine — easy difficulty randomness', () => {
    it('does not crash and returns a move on an open board across many seeds', () => {
        for (let seed = 1; seed <= 20; seed++) {
            installPRNG(seed);
            const game = makeAI('easy');
            const move = game.chooseAIMove();
            expect(move).toBeTruthy();
            expect(game.gameLogic.getAllPossibleLines()).toContain(move);
            vi.restoreAllMocks();
        }
    });
});
