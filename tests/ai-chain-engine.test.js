import { describe, expect, it, beforeEach } from 'vitest';
import {
    analyzeBoardChains,
    findCapturableChains,
    evaluateChainSacrifice,
} from '../src/ai/ChainAnalysis.js';
import { findOptimalMinimaxMove } from '../src/ai/MinimaxEngine.js';

describe('Nimstring & Component-Chain AI Engine', () => {
    let gridRows;
    let gridCols;
    let lines;
    let squares;
    let claimedCells;

    beforeEach(() => {
        gridRows = 3;
        gridCols = 3;
        lines = new Set();
        squares = {};
        claimedCells = new Set();
    });

    describe('Board graph state & cell adjacency representation', () => {
        it('analyzes cells, degrees, and edge presence for an empty 2x2 board', () => {
            const analysis = analyzeBoardChains(gridRows, gridCols, lines, squares, claimedCells);
            expect(analysis.cells).toBeDefined();
            expect(analysis.cells.length).toBe(4); // 2x2 = 4 cells in 3x3 dots
            const cell00 = analysis.cells.find((c) => c.row === 0 && c.col === 0);
            expect(cell00).toBeDefined();
            expect(cell00.degree).toBe(0); // 0 edges filled
            expect(cell00.missingEdgesCount).toBe(4);
            expect(cell00.edges.top).toBe('0,0-0,1');
            expect(cell00.edges.bottom).toBe('1,0-1,1');
            expect(cell00.edges.left).toBe('0,0-1,0');
            expect(cell00.edges.right).toBe('0,1-1,1');
        });

        it('identifies adjacent cells sharing common edges', () => {
            const analysis = analyzeBoardChains(gridRows, gridCols, lines, squares, claimedCells);
            const cell00 = analysis.cells.find((c) => c.row === 0 && c.col === 0);
            const cell01 = analysis.cells.find((c) => c.row === 0 && c.col === 1);
            expect(cell00.neighbors).toContain('0,1');
            expect(cell01.neighbors).toContain('0,0');
            expect(cell00.edges.right).toBe(cell01.edges.left);
        });
    });

    describe('Counting degree / missing edges per square cell (0..4 sides filled)', () => {
        it('tracks 0, 1, 2, 3, and 4 sides filled', () => {
            // Fill 3 sides of cell 0,0: top, left, right
            lines.add('0,0-0,1');
            lines.add('0,0-1,0');
            lines.add('0,1-1,1');

            let analysis = analyzeBoardChains(gridRows, gridCols, lines, squares, claimedCells);
            let c00 = analysis.cells.find((c) => c.row === 0 && c.col === 0);
            expect(c00.degree).toBe(3);
            expect(c00.missingEdgesCount).toBe(1);
            expect(c00.missingEdges).toEqual(['1,0-1,1']);

            // Now fill the 4th side and mark square claimed
            lines.add('1,0-1,1');
            squares['0,0'] = 1;
            analysis = analyzeBoardChains(gridRows, gridCols, lines, squares, claimedCells);
            c00 = analysis.cells.find((c) => c.row === 0 && c.col === 0);
            expect(c00.degree).toBe(4);
            expect(c00.missingEdgesCount).toBe(0);
            expect(c00.isCompleted).toBe(true);
        });
    });

    describe('Identifying captive chains (consecutive cells with 3 sides filled)', () => {
        it('detects a single capturable box (length 1 chain)', () => {
            // 3 sides of (0,0) filled
            lines.add('0,0-0,1');
            lines.add('0,0-1,0');
            lines.add('0,1-1,1');

            const capturableChains = findCapturableChains(
                gridRows,
                gridCols,
                lines,
                squares,
                claimedCells
            );
            expect(capturableChains.length).toBe(1);
            expect(capturableChains[0].length).toBe(1);
            expect(capturableChains[0].cells[0].key).toBe('0,0');
            expect(capturableChains[0].closingMove).toBe('1,0-1,1');
        });

        it('detects a sequence of capturable squares forming an open corridor / chain', () => {
            // Make a corridor of 2 cells: (0,0) and (0,1)
            lines.add('0,0-0,1');
            lines.add('0,0-1,0');
            lines.add('1,0-1,1');
            lines.add('0,1-0,2');
            lines.add('0,2-1,2');

            const capturableChains = findCapturableChains(
                gridRows,
                gridCols,
                lines,
                squares,
                claimedCells
            );
            expect(capturableChains.length).toBe(1);
            expect(capturableChains[0].length).toBe(2);
            expect(capturableChains[0].cells.map((c) => c.key)).toEqual(['0,0', '0,1']);
        });
    });

    describe('Double-cross / control evaluation (short vs long chains >= 3 squares)', () => {
        it('evaluates sacrifice for short chains (< 3 squares) vs long chains (>= 3 squares)', () => {
            // Short chain: length 2
            const shortChain = {
                length: 2,
                cells: [{ key: '0,0' }, { key: '0,1' }],
                type: 'chain',
            };
            const evalShort = evaluateChainSacrifice(shortChain);
            expect(evalShort.shouldDoubleCross).toBe(false);
            expect(evalShort.claimAllProfit).toBe(2);

            // Long chain: length 3
            const longChain = {
                length: 3,
                cells: [{ key: '0,0' }, { key: '0,1' }, { key: '0,2' }],
                type: 'chain',
            };
            const evalLong = evaluateChainSacrifice(longChain);
            expect(evalLong.shouldDoubleCross).toBe(true);
            expect(evalLong.doubleCrossScoreDelta).toBe(1); // AI takes 1 square, leaves 2 hard-hearted squares
        });

        it('handles loop components (double-cross gives 4 squares to opponent, or takes all)', () => {
            const longLoop = {
                length: 4,
                cells: [{ key: '0,0' }, { key: '0,1' }, { key: '1,1' }, { key: '1,0' }],
                type: 'loop',
            };
            const evalLoop = evaluateChainSacrifice(longLoop);
            expect(evalLoop.shouldDoubleCross).toBe(true);
            expect(evalLoop.type).toBe('loop');
        });
    });

    describe('Minimax 2-ply Alpha-Beta decision on endgame state', () => {
        it('selects the move that maximizes net score / controls the double-cross', () => {
            const mockGameLogic = {
                game: {
                    gridRows: 3,
                    gridCols: 3,
                    lines: new Set(),
                    squares: {},
                    claimedCells: new Set(),
                    lineOwners: new Map(),
                    currentPlayer: 2,
                    aiPlayerNumber: 2,
                },
                getAllPossibleLines() {
                    return [
                        '0,0-0,1',
                        '0,1-0,2',
                        '1,0-1,1',
                        '1,1-1,2',
                        '2,0-2,1',
                        '2,1-2,2',
                        '0,0-1,0',
                        '0,1-1,1',
                        '0,2-1,2',
                        '1,0-2,0',
                        '1,1-2,1',
                        '1,2-2,2',
                    ];
                },
                wouldCompleteSquare(lineKey) {
                    const [p1, p2] = lineKey.split('-').map((p) => {
                        const [r, c] = p.split(',').map(Number);
                        return { row: r, col: c };
                    });
                    const isH = p1.row === p2.row;
                    const testLines = new Set(this.game.lines);
                    testLines.add(lineKey);

                    const isComplete = (r, c) => {
                        const top = `${r},${c}-${r},${c + 1}`;
                        const bot = `${r + 1},${c}-${r + 1},${c + 1}`;
                        const l = `${r},${c}-${r + 1},${c}`;
                        const rt = `${r},${c + 1}-${r + 1},${c + 1}`;
                        return (
                            testLines.has(top) &&
                            testLines.has(bot) &&
                            testLines.has(l) &&
                            testLines.has(rt) &&
                            !this.game.squares[`${r},${c}`]
                        );
                    };

                    if (isH) {
                        return (
                            (p1.row > 0 && isComplete(p1.row - 1, Math.min(p1.col, p2.col))) ||
                            (p1.row < this.game.gridRows - 1 &&
                                isComplete(p1.row, Math.min(p1.col, p2.col)))
                        );
                    } else {
                        return (
                            (p1.col > 0 && isComplete(Math.min(p1.row, p2.row), p1.col - 1)) ||
                            (p1.col < this.game.gridCols - 1 &&
                                isComplete(Math.min(p1.row, p2.row), p1.col))
                        );
                    }
                },
            };

            mockGameLogic.game.lines.add('0,0-0,1');
            mockGameLogic.game.lines.add('0,0-1,0');
            mockGameLogic.game.lines.add('1,0-1,1');

            const bestMove = findOptimalMinimaxMove(
                mockGameLogic,
                mockGameLogic.game.lines,
                3,
                3,
                2
            );
            expect(bestMove).toBe('0,1-1,1'); // completes square (0,0)
        });
    });

    describe('Fallback safety when no complex chains exist', () => {
        it('returns a safe line that does not concede a 3rd edge to opponent', () => {
            const mockGameLogic = {
                game: {
                    gridRows: 3,
                    gridCols: 3,
                    lines: new Set(),
                    squares: {},
                    claimedCells: new Set(),
                    lineOwners: new Map(),
                    currentPlayer: 2,
                    aiPlayerNumber: 2,
                },
                getAllPossibleLines() {
                    return [
                        '0,0-0,1',
                        '0,1-0,2',
                        '1,0-1,1',
                        '1,1-1,2',
                        '2,0-2,1',
                        '2,1-2,2',
                        '0,0-1,0',
                        '0,1-1,1',
                        '0,2-1,2',
                        '1,0-2,0',
                        '1,1-2,1',
                        '1,2-2,2',
                    ];
                },
                wouldCompleteSquare() {
                    return false;
                },
            };

            const move = findOptimalMinimaxMove(mockGameLogic, mockGameLogic.game.lines, 3, 3, 2);
            expect(move).toBeTruthy();
            expect(mockGameLogic.getAllPossibleLines()).toContain(move);
        });
    });
});
