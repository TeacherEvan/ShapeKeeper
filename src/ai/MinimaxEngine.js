/**
 * ShapeKeeper - Minimax Engine
 * Alpha-Beta minimax engine with endgame chain evaluation for Dots and Boxes.
 */

import {
    analyzeBoardChains,
    findCapturableChains,
    evaluateChainSacrifice,
} from './ChainAnalysis.js';
import { parseLineKey } from '../../utils.js';

/**
 * Evaluates immediate gain (completed squares) if lineKey is placed.
 */
function evaluateImmediateSquareGain(gameLogic, lines, lineKey, gridRows, gridCols) {
    const [start, end] = parseLineKey(lineKey);
    const isHorizontal = start.row === end.row;
    let completedSquares = 0;

    const isComplete = (r, c) => {
        const cellKey = `${r},${c}`;
        if (gameLogic.game.claimedCells?.has(cellKey)) return false;
        if (gameLogic.game.squares?.[cellKey]) return false;

        const top = `${r},${c}-${r},${c + 1}`;
        const bottom = `${r + 1},${c}-${r + 1},${c + 1}`;
        const left = `${r},${c}-${r + 1},${c}`;
        const right = `${r},${c + 1}-${r + 1},${c + 1}`;

        return (
            (lines.has(top) || lineKey === top) &&
            (lines.has(bottom) || lineKey === bottom) &&
            (lines.has(left) || lineKey === left) &&
            (lines.has(right) || lineKey === right)
        );
    };

    if (isHorizontal) {
        if (start.row > 0 && isComplete(start.row - 1, Math.min(start.col, end.col))) {
            completedSquares++;
        }
        if (start.row < gridRows - 1 && isComplete(start.row, Math.min(start.col, end.col))) {
            completedSquares++;
        }
    } else {
        if (start.col > 0 && isComplete(Math.min(start.row, end.row), start.col - 1)) {
            completedSquares++;
        }
        if (start.col < gridCols - 1 && isComplete(Math.min(start.row, end.row), start.col)) {
            completedSquares++;
        }
    }

    return completedSquares;
}

/**
 * Heuristic evaluation of a board position from AI's perspective.
 */
function evaluatePosition(gameLogic, lines, gridRows, gridCols) {
    const analysis = analyzeBoardChains(
        gridRows,
        gridCols,
        lines,
        gameLogic.game.squares || {},
        gameLogic.game.claimedCells || new Set()
    );

    let score = 0;
    for (const cell of analysis.cells) {
        if (cell.isCompleted || cell.isClaimedByShape) continue;
        if (cell.degree === 3) {
            // Immediate capture exists
            score += 10;
        } else if (cell.degree === 2) {
            // Dangerous 3rd-edge trap
            score -= 5;
        }
    }

    return score;
}

/**
 * Alpha-Beta Minimax search for best move.
 */
function minimax(
    gameLogic,
    lines,
    gridRows,
    gridCols,
    depth,
    alpha,
    beta,
    isMaximizing,
    aiPlayerNumber
) {
    if (depth === 0) {
        return { score: evaluatePosition(gameLogic, lines, gridRows, gridCols), move: null };
    }

    const availableLines = gameLogic.getAllPossibleLines().filter((l) => !lines.has(l));
    if (availableLines.length === 0) {
        return { score: 0, move: null };
    }

    // Sort moves: scoring moves first, safe moves next
    const scoringMoves = [];
    const otherMoves = [];

    for (const move of availableLines) {
        const gain = evaluateImmediateSquareGain(gameLogic, lines, move, gridRows, gridCols);
        if (gain > 0) {
            scoringMoves.push({ move, gain });
        } else {
            otherMoves.push({ move, gain: 0 });
        }
    }

    const orderedMoves = [...scoringMoves, ...otherMoves];

    let bestMove = orderedMoves[0]?.move || null;

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const { move, gain } of orderedMoves) {
            lines.add(move);
            let evaluation;
            try {
                if (gain > 0) {
                    // Capturing square grants another move for same player
                    evaluation =
                        gain * 20 +
                        minimax(
                            gameLogic,
                            lines,
                            gridRows,
                            gridCols,
                            depth - 1,
                            alpha,
                            beta,
                            true,
                            aiPlayerNumber
                        ).score;
                } else {
                    evaluation = minimax(
                        gameLogic,
                        lines,
                        gridRows,
                        gridCols,
                        depth - 1,
                        alpha,
                        beta,
                        false,
                        aiPlayerNumber
                    ).score;
                }
            } finally {
                lines.delete(move);
            }

            if (evaluation > maxEval) {
                maxEval = evaluation;
                bestMove = move;
            }
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) {
                break; // Alpha-Beta cutoff
            }
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = Infinity;
        for (const { move, gain } of orderedMoves) {
            lines.add(move);
            let evaluation;
            try {
                if (gain > 0) {
                    evaluation =
                        -gain * 20 +
                        minimax(
                            gameLogic,
                            lines,
                            gridRows,
                            gridCols,
                            depth - 1,
                            alpha,
                            beta,
                            false,
                            aiPlayerNumber
                        ).score;
                } else {
                    evaluation = minimax(
                        gameLogic,
                        lines,
                        gridRows,
                        gridCols,
                        depth - 1,
                        alpha,
                        beta,
                        true,
                        aiPlayerNumber
                    ).score;
                }
            } finally {
                lines.delete(move);
            }

            if (evaluation < minEval) {
                minEval = evaluation;
                bestMove = move;
            }
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) {
                break; // Alpha-Beta cutoff
            }
        }
        return { score: minEval, move: bestMove };
    }
}

/**
 * Finds the optimal move using chain analysis and Minimax Alpha-Beta search.
 */
export function findOptimalMinimaxMove(gameLogic, lines, gridRows, gridCols, depth = 2) {
    const availableLines = gameLogic.getAllPossibleLines().filter((l) => !lines.has(l));
    if (availableLines.length === 0) {
        return null;
    }

    // 1. Check capturable chains & Nimstring strategy
    const capturableChains = findCapturableChains(
        gridRows,
        gridCols,
        lines,
        gameLogic.game.squares || {},
        gameLogic.game.claimedCells || new Set()
    );

    if (capturableChains.length > 0) {
        // If there's a long chain (>= 3) and no other components left to force,
        // evaluate whether to double-cross or take all.
        const longestChain = capturableChains.reduce(
            (prev, cur) => (cur.length > prev.length ? cur : prev),
            capturableChains[0]
        );
        const _sacEval = evaluateChainSacrifice(longestChain);

        // If we should sacrifice (double-cross) and it's the last chain or critical phase:
        // Returning the closing move captures the current cell.
        if (longestChain.closingMove) {
            return longestChain.closingMove;
        }
    }

    // 2. Immediate scoring move if available
    const scoringLines = availableLines.filter(
        (l) => evaluateImmediateSquareGain(gameLogic, lines, l, gridRows, gridCols) > 0
    );
    if (scoringLines.length > 0 && depth <= 1) {
        return scoringLines[0];
    }

    // 3. Fallback to Minimax Alpha-Beta search (2-ply default)
    const result = minimax(
        gameLogic,
        lines,
        gridRows,
        gridCols,
        depth,
        -Infinity,
        Infinity,
        true,
        gameLogic.game.aiPlayerNumber || 2
    );

    return result.move || availableLines[0];
}
