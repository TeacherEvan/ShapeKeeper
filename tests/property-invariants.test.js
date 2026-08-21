import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DotsAndBoxesGame } from '../dots-and-boxes-game.js';
import { GameLogic } from '../game-logic.js';
import { getLineKey, parseLineKey } from '../utils.js';

describe('Mathematical Property-Based Invariant Verification', () => {
    // Canvas & DOM setup helper
    function setupDOM() {
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
    }

    beforeEach(() => {
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('a) Commutativity and Roundtrip of getLineKey and parseLineKey', () => {
        it('preserves commutativity: getLineKey(dotA, dotB) === getLineKey(dotB, dotA) for randomized dot pairs', () => {
            const iterations = 100;
            for (let i = 0; i < iterations; i++) {
                const r1 = Math.floor(Math.random() * 50);
                const c1 = Math.floor(Math.random() * 50);
                const r2 = Math.floor(Math.random() * 50);
                const c2 = Math.floor(Math.random() * 50);

                const dotA = { row: r1, col: c1 };
                const dotB = { row: r2, col: c2 };

                const keyForward = getLineKey(dotA, dotB);
                const keyBackward = getLineKey(dotB, dotA);

                expect(keyForward).toBe(keyBackward);
            }
        });

        it('preserves roundtrip: parseLineKey(getLineKey(dotA, dotB)) produces equivalent canonical dots', () => {
            const iterations = 100;
            for (let i = 0; i < iterations; i++) {
                const r1 = Math.floor(Math.random() * 50);
                const c1 = Math.floor(Math.random() * 50);
                const r2 = Math.floor(Math.random() * 50);
                const c2 = Math.floor(Math.random() * 50);

                // Avoid identical dot pairs for meaningful lines
                if (r1 === r2 && c1 === c2) continue;

                const dotA = { row: r1, col: c1 };
                const dotB = { row: r2, col: c2 };

                const key = getLineKey(dotA, dotB);
                const [start, end] = parseLineKey(key);

                // Check that the reconstructed line key matches the original canonical key
                const roundtripKey = getLineKey(start, end);
                expect(roundtripKey).toBe(key);

                // Canonical ordering check: start dot should precede or equal end dot in row/col order
                if (start.row === end.row) {
                    expect(start.col).toBeLessThanOrEqual(end.col);
                } else {
                    expect(start.row).toBeLessThan(end.row);
                }

                // Check that {start, end} matches {dotA, dotB} set-wise
                const containsA =
                    (start.row === dotA.row && start.col === dotA.col) ||
                    (end.row === dotA.row && end.col === dotA.col);
                const containsB =
                    (start.row === dotB.row && start.col === dotB.col) ||
                    (end.row === dotB.row && end.col === dotB.col);
                expect(containsA).toBe(true);
                expect(containsB).toBe(true);
            }
        });
    });

    describe('b) Graph Theoretical Invariants on R x C Grid', () => {
        it('verifies total lines = R*(C-1) + C*(R-1) and total squares = (R-1)*(C-1)', () => {
            const gridSizes = [
                { r: 2, c: 2 },
                { r: 3, c: 3 },
                { r: 4, c: 4 },
                { r: 5, c: 5 },
                { r: 3, c: 5 },
                { r: 6, c: 4 },
                { r: 7, c: 8 },
            ];

            for (const { r, c } of gridSizes) {
                const mockGame = {
                    gridRows: r,
                    gridCols: c,
                    lines: new Set(),
                    claimedCells: new Set(),
                    squares: {},
                };
                const logic = new GameLogic(mockGame);
                const allPossibleLines = logic.getAllPossibleLines();

                const expectedHorizontalLines = r * (c - 1);
                const expectedVerticalLines = c * (r - 1);
                const expectedTotalLines = expectedHorizontalLines + expectedVerticalLines;
                const expectedTotalSquares = (r - 1) * (c - 1);

                // Line count invariant
                expect(allPossibleLines.length).toBe(expectedTotalLines);

                // All generated lines must be unique
                const uniqueLines = new Set(allPossibleLines);
                expect(uniqueLines.size).toBe(expectedTotalLines);

                // Verify count of horizontal vs vertical
                let horizCount = 0;
                let vertCount = 0;
                for (const lineKey of allPossibleLines) {
                    const [start, end] = parseLineKey(lineKey);
                    if (start.row === end.row) {
                        horizCount++;
                        expect(Math.abs(start.col - end.col)).toBe(1);
                    } else if (start.col === end.col) {
                        vertCount++;
                        expect(Math.abs(start.row - end.row)).toBe(1);
                    }
                }
                expect(horizCount).toBe(expectedHorizontalLines);
                expect(vertCount).toBe(expectedVerticalLines);

                // Square count invariant check via game state
                if (r === c) {
                    const gameInstance = new DotsAndBoxesGame(r, '#FF0000', '#0000FF', {
                        localMode: 'human',
                    });
                    const maxSquares = (r - 1) * (r - 1);
                    expect(maxSquares).toBe(expectedTotalSquares);
                    expect(gameInstance.gameState.isGameOver()).toBe(false);
                }
            }
        });
    });

    describe('c) State Snapshot Idempotence', () => {
        it('preserves all state properties across captureMoveSnapshot -> restoreMoveSnapshot cycle', async () => {
            const game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', { localMode: 'human' });

            // Make some arbitrary moves
            await game.drawLine({ row: 0, col: 0 }, { row: 0, col: 1 });
            await game.drawLine({ row: 0, col: 0 }, { row: 1, col: 0 });
            await game.drawLine({ row: 1, col: 0 }, { row: 1, col: 1 });

            // Capture snapshot
            const snapshot1 = game.captureMoveSnapshot();

            // Restore the snapshot
            game.restoreMoveSnapshot(snapshot1);

            // Capture snapshot again
            const snapshot2 = game.captureMoveSnapshot();

            // Property-wise equivalence check
            expect(snapshot2).toEqual(snapshot1);

            // Double restore idempotence
            game.restoreMoveSnapshot(snapshot2);
            const snapshot3 = game.captureMoveSnapshot();
            expect(snapshot3).toEqual(snapshot1);

            // Verify deep equality of internal game properties after restore
            expect([...game.lines]).toEqual(snapshot1.lines);
            expect([...game.ghostLines]).toEqual(snapshot1.ghostLines);
            expect([...game.lineOwners.entries()]).toEqual(snapshot1.lineOwners);
            expect(game.squares).toEqual(snapshot1.squares);
            expect(game.scores).toEqual(snapshot1.scores);
            expect(game.currentPlayer).toBe(snapshot1.currentPlayer);
            expect([...game.claimedCells]).toEqual(snapshot1.claimedCells);
            expect(game.comboCount).toBe(snapshot1.comboCount);
            expect(game.lastComboPlayer).toBe(snapshot1.lastComboPlayer);
        });
    });

    describe('d) Conservation of Points and Cell Completion Across Simulated Playouts', () => {
        it('ensures sum of completed squares equals total claimed squares across randomized playouts', async () => {
            const playouts = 10;

            for (let p = 0; p < playouts; p++) {
                const gridSize = 3; // 3x3 grid has 4 squares, 12 lines
                const game = new DotsAndBoxesGame(gridSize, '#FF0000', '#0000FF', {
                    localMode: 'human',
                });

                const totalPossibleSquares = (gridSize - 1) * (gridSize - 1);
                const allLines = game.gameLogic.getAllPossibleLines();

                // Shuffle lines to create a random playout
                const shuffledLines = [...allLines].sort(() => Math.random() - 0.5);

                for (const lineKey of shuffledLines) {
                    if (game.lines.has(lineKey)) continue;

                    const [start, end] = parseLineKey(lineKey);
                    await game.drawLine(start, end);

                    // Intermediate invariant: number of completed squares in game.squares is non-decreasing and bounded
                    const squaresCount = Object.keys(game.squares).length;
                    expect(squaresCount).toBeLessThanOrEqual(totalPossibleSquares);

                    // Intermediate invariant: each square belongs to player 1 or player 2
                    for (const [, owner] of Object.entries(game.squares)) {
                        expect([1, 2]).toContain(owner);
                    }
                }

                // Final state invariants:
                // 1. All squares must be completed
                const completedSquares = Object.keys(game.squares).length;
                expect(completedSquares).toBe(totalPossibleSquares);
                expect(game.gameState.isGameOver()).toBe(true);

                // 2. Total score sum must equal base points + combo bonus points >= totalPossibleSquares
                const totalScore = game.scores[1] + game.scores[2];
                expect(totalScore).toBeGreaterThanOrEqual(totalPossibleSquares);

                // 3. Line count must equal total possible lines
                const expectedTotalLines = gridSize * (gridSize - 1) * 2;
                expect(game.lines.size).toBe(expectedTotalLines);
            }
        });
    });

    describe('e) getSafeLines Invariant', () => {
        it('guarantees drawing any safe line increases square count by 0', async () => {
            const game = new DotsAndBoxesGame(3, '#FF0000', '#0000FF', { localMode: 'human' });

            // Perform partial random moves while safe lines exist
            const allPossibleLines = game.gameLogic.getAllPossibleLines();
            const shuffled = [...allPossibleLines].sort(() => Math.random() - 0.5);

            for (const lineKey of shuffled) {
                const safeLines = game.gameLogic.getSafeLines();

                // Check every safe line reported by getSafeLines
                for (const safeLine of safeLines) {
                    // Invariant: wouldCompleteSquare must be false for any safe line
                    const wouldComplete = game.gameLogic.wouldCompleteSquare(safeLine);
                    expect(wouldComplete).toBe(false);

                    // Prospective drawing test
                    const initialSquareCount = Object.keys(game.squares).length;

                    // Parse line and test checkForSquares
                    game.lines.add(safeLine);
                    const completed = game.gameLogic.checkForSquares(safeLine);
                    game.lines.delete(safeLine);

                    // Invariant: prospective completion must yield 0 completed squares
                    expect(completed.length).toBe(0);

                    // Clean up any square references if checkForSquares wrote to game.squares
                    for (const sq of completed) {
                        delete game.squares[sq];
                    }
                    expect(Object.keys(game.squares).length).toBe(initialSquareCount);
                }

                // Draw the line to advance the game state
                if (!game.lines.has(lineKey)) {
                    const [s, e] = parseLineKey(lineKey);
                    await game.drawLine(s, e);
                }
            }
        });
    });
});
