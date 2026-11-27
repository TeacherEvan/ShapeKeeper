/**
 * Local AI move selection and heuristic evaluation helpers extracted from DotsAndBoxesGame.
 */

import { findOptimalMinimaxMove } from './MinimaxEngine.js';

export function pickRandomLine(lines) {
    return lines[Math.floor(Math.random() * lines.length)] || null;
}

export function pickRandomAmongBest(lines, scoreFn) {
    let bestScore = -Infinity;
    let bestLines = [];
    for (const lineKey of lines) {
        const score = scoreFn(lineKey);
        if (score > bestScore) {
            bestScore = score;
            bestLines = [lineKey];
        } else if (score === bestScore) {
            bestLines.push(lineKey);
        }
    }
    return bestLines[Math.floor(Math.random() * bestLines.length)] || null;
}

export function countSquareEdges(game, row, col, prospectiveLineKey) {
    const top = game.getLineKey({ row, col }, { row, col: col + 1 });
    const bottom = game.getLineKey({ row: row + 1, col }, { row: row + 1, col: col + 1 });
    const left = game.getLineKey({ row, col }, { row: row + 1, col });
    const right = game.getLineKey({ row, col: col + 1 }, { row: row + 1, col: col + 1 });
    const squareLines = [top, bottom, left, right];
    return squareLines.reduce(
        (count, key) => count + (key === prospectiveLineKey || game.lines.has(key) ? 1 : 0),
        0
    );
}

export function isPotentialSquareComplete(game, row, col, prospectiveLineKey) {
    if (game.claimedCells.has(`${row},${col}`) || game.squares[`${row},${col}`]) {
        return false;
    }
    const top = game.getLineKey({ row, col }, { row, col: col + 1 });
    const bottom = game.getLineKey({ row: row + 1, col }, { row: row + 1, col: col + 1 });
    const left = game.getLineKey({ row, col }, { row: row + 1, col });
    const right = game.getLineKey({ row, col: col + 1 }, { row: row + 1, col: col + 1 });
    return [top, bottom, left, right].every(
        (key) => key === prospectiveLineKey || game.lines.has(key)
    );
}

export function evaluateImmediateSquareGain(game, lineKey) {
    const [start, end] = game.parseLineKey(lineKey);
    const isHorizontal = start.row === end.row;
    let completedSquares = 0;

    if (isHorizontal) {
        if (
            start.row > 0 &&
            isPotentialSquareComplete(game, start.row - 1, Math.min(start.col, end.col), lineKey)
        ) {
            completedSquares += 1;
        }
        if (
            start.row < game.gridRows - 1 &&
            isPotentialSquareComplete(game, start.row, Math.min(start.col, end.col), lineKey)
        ) {
            completedSquares += 1;
        }
        return completedSquares;
    }

    if (
        start.col > 0 &&
        isPotentialSquareComplete(game, Math.min(start.row, end.row), start.col - 1, lineKey)
    ) {
        completedSquares += 1;
    }
    if (
        start.col < game.gridCols - 1 &&
        isPotentialSquareComplete(game, Math.min(start.row, end.row), start.col, lineKey)
    ) {
        completedSquares += 1;
    }
    return completedSquares;
}

export function evaluateSafeLineStrength(game, lineKey) {
    const [start, end] = game.parseLineKey(lineKey);
    const isHorizontal = start.row === end.row;
    const neighbors = [];

    if (isHorizontal) {
        if (start.row > 0) {
            neighbors.push({ row: start.row - 1, col: Math.min(start.col, end.col) });
        }
        if (start.row < game.gridRows - 1) {
            neighbors.push({ row: start.row, col: Math.min(start.col, end.col) });
        }
    } else {
        if (start.col > 0) {
            neighbors.push({ row: Math.min(start.row, end.row), col: start.col - 1 });
        }
        if (start.col < game.gridCols - 1) {
            neighbors.push({ row: Math.min(start.row, end.row), col: start.col });
        }
    }

    let score = 0;
    for (const { row, col } of neighbors) {
        const edgeCount = countSquareEdges(game, row, col, lineKey);
        score += edgeCount <= 2 ? 2 : -3;
    }
    return score;
}

export function opponentBestGainAfter(game, lineKey) {
    const alreadyPresent = game.lines.has(lineKey);
    game.lines.add(lineKey);

    let maxGain = 0;
    const opponentLines = game.gameLogic.getAllPossibleLines().filter((l) => !game.lines.has(l));
    for (const l of opponentLines) {
        if (game.gameLogic.wouldCompleteSquare(l)) {
            const gain = evaluateImmediateSquareGain(game, l);
            if (gain > maxGain) {
                maxGain = gain;
            }
        }
    }

    if (!alreadyPresent) {
        game.lines.delete(lineKey);
    }
    return maxGain;
}

export function pickBestScoringLine(game, lines) {
    return pickRandomAmongBest(lines, (l) => evaluateImmediateSquareGain(game, l));
}

export function pickBestSafeLine(game, lines) {
    return pickRandomAmongBest(lines, (l) => evaluateSafeLineStrength(game, l));
}

export function pickHardSafeLine(game, lines) {
    return pickRandomAmongBest(lines, (lineKey) => {
        const ownStrength = evaluateSafeLineStrength(game, lineKey);
        const opponentGain = opponentBestGainAfter(game, lineKey);
        return ownStrength - opponentGain * 4;
    });
}

export function chooseAIMove(game) {
    const availableLines = game.gameLogic
        .getAllPossibleLines()
        .filter((lineKey) => !game.lines.has(lineKey));
    if (availableLines.length === 0) {
        return null;
    }

    const scoringLines = [];
    const safeLines = [];
    for (const lineKey of availableLines) {
        if (game.gameLogic.wouldCompleteSquare(lineKey)) {
            scoringLines.push(lineKey);
        } else {
            safeLines.push(lineKey);
        }
    }

    if (game.aiDifficulty === 'easy') {
        if (scoringLines.length > 0 && Math.random() > 0.35) {
            return pickRandomLine(scoringLines);
        }
        if (safeLines.length > 0) {
            return pickRandomLine(safeLines);
        }
        return pickRandomLine(availableLines);
    }

    if (scoringLines.length > 0) {
        return pickBestScoringLine(game, scoringLines);
    }

    const candidateSafe = safeLines.length > 0 ? safeLines : availableLines;
    const searchDepth = availableLines.length <= 14 ? 4 : availableLines.length <= 22 ? 3 : 2;
    const bestMinimaxMove = findOptimalMinimaxMove(
        game.gameLogic,
        game.lines,
        game.gridRows,
        game.gridCols,
        searchDepth
    );
    if (bestMinimaxMove) {
        return bestMinimaxMove;
    }

    return pickHardSafeLine(game, candidateSafe);
}
