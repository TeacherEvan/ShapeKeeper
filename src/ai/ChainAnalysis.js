/**
 * ShapeKeeper - Chain Analysis
 * Graph and Nimstring chain representation for Dots and Boxes AI.
 * Analyzes degree, missing edges, capturable corridors, loops, and double-cross strategies.
 */

import { getLineKey } from '../../utils.js';

/**
 * Build cell descriptors and graph adjacency for all grid cells.
 */
export function analyzeBoardChains(
    gridRows,
    gridCols,
    lines,
    squares = {},
    claimedCells = new Set()
) {
    const numRows = gridRows - 1;
    const numCols = gridCols - 1;
    const cells = [];
    const cellMap = new Map();

    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            const key = `${r},${c}`;
            const top = getLineKey({ row: r, col: c }, { row: r, col: c + 1 });
            const bottom = getLineKey({ row: r + 1, col: c }, { row: r + 1, col: c + 1 });
            const left = getLineKey({ row: r, col: c }, { row: r + 1, col: c });
            const right = getLineKey({ row: r, col: c + 1 }, { row: r + 1, col: c + 1 });

            const edgeKeys = [top, bottom, left, right];
            const missingEdges = [];
            let degree = 0;

            for (const edge of edgeKeys) {
                if (lines.has(edge)) {
                    degree++;
                } else {
                    missingEdges.push(edge);
                }
            }

            const isClaimedByShape = claimedCells.has(key);
            const isCompleted = !!squares[key] || degree === 4;

            const neighbors = [];
            if (r > 0) neighbors.push(`${r - 1},${c}`);
            if (r < numRows - 1) neighbors.push(`${r + 1},${c}`);
            if (c > 0) neighbors.push(`${r},${c - 1}`);
            if (c < numCols - 1) neighbors.push(`${r},${c + 1}`);

            const cellObj = {
                key,
                row: r,
                col: c,
                edges: { top, bottom, left, right },
                edgeKeys,
                missingEdges,
                degree,
                missingEdgesCount: missingEdges.length,
                isCompleted,
                isClaimedByShape,
                neighbors,
            };

            cells.push(cellObj);
            cellMap.set(key, cellObj);
        }
    }

    return { cells, cellMap, numRows, numCols };
}

/**
 * Finds all chains of capturable cells (degree === 3, missingEdgesCount === 1)
 * that can be sequentially collected, tracking their lengths and type (chain or loop).
 */
export function findCapturableChains(
    gridRows,
    gridCols,
    lines,
    squares = {},
    claimedCells = new Set()
) {
    const analysis = analyzeBoardChains(gridRows, gridCols, lines, squares, claimedCells);
    const { cellMap } = analysis;

    // Cells that currently have 3 sides filled (1 missing edge) and not yet completed
    const deg3Cells = analysis.cells.filter(
        (c) => c.degree === 3 && !c.isCompleted && !c.isClaimedByShape
    );

    const visitedCells = new Set();
    const chains = [];

    for (const startCell of deg3Cells) {
        if (visitedCells.has(startCell.key)) continue;

        // Trace chain forward
        const currentChainCells = [];
        let cur = startCell;
        let isLoop = false;

        // Simulate filling edges along this corridor to see full cascade
        const simLines = new Set(lines);
        const simSquares = { ...squares };

        while (cur && !visitedCells.has(cur.key)) {
            visitedCells.add(cur.key);
            currentChainCells.push(cur);

            // The edge that captures this cell
            const missingEdge = cur.missingEdges[0];
            if (missingEdge) {
                simLines.add(missingEdge);
            }
            simSquares[cur.key] = true;

            // Check if completing this edge causes a neighbor to now reach degree 3
            let nextCell = null;
            for (const neighborKey of cur.neighbors) {
                const neighbor = cellMap.get(neighborKey);
                if (
                    !neighbor ||
                    neighbor.isCompleted ||
                    neighbor.isClaimedByShape ||
                    visitedCells.has(neighbor.key)
                ) {
                    continue;
                }

                // Check neighbor's degree with simLines
                let nDegree = 0;
                const nMissing = [];
                for (const edge of neighbor.edgeKeys) {
                    if (simLines.has(edge)) {
                        nDegree++;
                    } else {
                        nMissing.push(edge);
                    }
                }

                if (nDegree === 3 && nMissing.length === 1) {
                    nextCell = {
                        ...neighbor,
                        degree: 3,
                        missingEdgesCount: 1,
                        missingEdges: nMissing,
                    };
                    break;
                }
            }

            cur = nextCell;
        }

        if (currentChainCells.length > 0) {
            chains.push({
                length: currentChainCells.length,
                cells: currentChainCells,
                closingMove: startCell.missingEdges[0],
                type: isLoop ? 'loop' : 'chain',
            });
        }
    }

    return chains;
}

/**
 * Evaluates whether to take all boxes or sacrifice 2 boxes (or 4 in a loop) to maintain control (double-cross).
 * In classic Dots and Boxes strategy:
 * - Chains of length < 3: Double-cross gives no advantage, claim all (profit = length).
 * - Chains of length >= 3: Hard-hearted handout (double-cross) gives AI (length - 2) squares and hands turn to opponent,
 *   forcing opponent to open the next component.
 * - Loops: Double-cross leaves 4 squares to opponent.
 */
export function evaluateChainSacrifice(chain) {
    const { length, type = 'chain' } = chain;

    if (type === 'loop') {
        if (length >= 4) {
            return {
                shouldDoubleCross: true,
                type: 'loop',
                claimAllProfit: length,
                doubleCrossScoreDelta: length - 4,
                opponentConcededCount: 4,
            };
        }
        return {
            shouldDoubleCross: false,
            type: 'loop',
            claimAllProfit: length,
            doubleCrossScoreDelta: 0,
            opponentConcededCount: 0,
        };
    }

    // Standard linear chain
    if (length >= 3) {
        return {
            shouldDoubleCross: true,
            type: 'chain',
            claimAllProfit: length,
            doubleCrossScoreDelta: length - 2,
            opponentConcededCount: 2,
        };
    }

    return {
        shouldDoubleCross: false,
        type: 'chain',
        claimAllProfit: length,
        doubleCrossScoreDelta: 0,
        opponentConcededCount: 0,
    };
}
