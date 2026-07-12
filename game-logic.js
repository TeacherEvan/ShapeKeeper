/**
 * ShapeKeeper - Game Logic
 * Core game mechanics for squares and line drawing
 *
 * @version 4.3.0
 * @author Teacher Evan
 */

import { areAdjacent, getLineKey, getLineType, parseLineKey, parseSquareKey } from './utils.js';

export class GameLogic {
    constructor(game) {
        this.game = game;
    }

    /**
     * Get line key for two dots
     */
    getLineKey(dot1, dot2) {
        return getLineKey(dot1, dot2);
    }

    /**
     * Parse line key into dots
     */
    parseLineKey(lineKey) {
        return parseLineKey(lineKey);
    }

    /**
     * Parse square key into coordinates
     */
    parseSquareKey(squareKey) {
        return parseSquareKey(squareKey);
    }

    /**
     * Check if two dots are adjacent
     */
    areAdjacent(dot1, dot2) {
        return areAdjacent(dot1, dot2);
    }

    /**
     * Get line type
     */
    getLineType(dot1, dot2) {
        return getLineType(dot1, dot2);
    }

    /**
     * Check for squares completed by a line
     */
    checkForSquares(lineKey) {
        const [start, end] = parseLineKey(lineKey);

        const completedSquares = [];
        const isHorizontal = start.row === end.row;

        if (isHorizontal) {
            // Check square above
            if (start.row > 0) {
                const squareKey = `${start.row - 1},${Math.min(start.col, end.col)}`;
                if (this.isSquareComplete(start.row - 1, Math.min(start.col, end.col))) {
                    this.game.squares[squareKey] = this.game.currentPlayer;
                    completedSquares.push(squareKey);
                }
            }
            // Check square below
            if (start.row < this.game.gridRows - 1) {
                const squareKey = `${start.row},${Math.min(start.col, end.col)}`;
                if (this.isSquareComplete(start.row, Math.min(start.col, end.col))) {
                    this.game.squares[squareKey] = this.game.currentPlayer;
                    completedSquares.push(squareKey);
                }
            }
        } else {
            // Check square to the left
            if (start.col > 0) {
                const squareKey = `${Math.min(start.row, end.row)},${start.col - 1}`;
                if (this.isSquareComplete(Math.min(start.row, end.row), start.col - 1)) {
                    this.game.squares[squareKey] = this.game.currentPlayer;
                    completedSquares.push(squareKey);
                }
            }
            // Check square to the right
            if (start.col < this.game.gridCols - 1) {
                const squareKey = `${Math.min(start.row, end.row)},${start.col}`;
                if (this.isSquareComplete(Math.min(start.row, end.row), start.col)) {
                    this.game.squares[squareKey] = this.game.currentPlayer;
                    completedSquares.push(squareKey);
                }
            }
        }

        return completedSquares;
    }

    /**
     * Check if a square is complete
     */
    isSquareComplete(row, col) {
        // Shape exclusivity check: if this cell is already claimed, square cannot form
        const cellKey = `${row},${col}`;
        if (this.game.claimedCells.has(cellKey)) {
            return false;
        }

        const top = getLineKey({ row, col }, { row, col: col + 1 });
        const bottom = getLineKey({ row: row + 1, col }, { row: row + 1, col: col + 1 });
        const left = getLineKey({ row, col }, { row: row + 1, col });
        const right = getLineKey({ row, col: col + 1 }, { row: row + 1, col: col + 1 });

        return (
            this.game.lines.has(top) &&
            this.game.lines.has(bottom) &&
            this.game.lines.has(left) &&
            this.game.lines.has(right) &&
            !this.game.squares[cellKey]
        );
    }

    /**
     * Get all possible lines
     */
    getAllPossibleLines() {
        const allLines = [];

        // Generate all horizontal lines
        for (let row = 0; row < this.game.gridRows; row++) {
            for (let col = 0; col < this.game.gridCols - 1; col++) {
                const dot1 = { row, col };
                const dot2 = { row, col: col + 1 };
                allLines.push(getLineKey(dot1, dot2));
            }
        }

        // Generate all vertical lines
        for (let row = 0; row < this.game.gridRows - 1; row++) {
            for (let col = 0; col < this.game.gridCols; col++) {
                const dot1 = { row, col };
                const dot2 = { row: row + 1, col };
                allLines.push(getLineKey(dot1, dot2));
            }
        }

        return allLines;
    }

    /**
     * Check if drawing a line would complete a square
     */
    wouldCompleteSquare(lineKey) {
        // Parse the line
        const [start, end] = parseLineKey(lineKey);

        // Temporarily add the line to check
        this.game.lines.add(lineKey);

        let wouldComplete = false;

        const isHorizontal = start.row === end.row;

        if (isHorizontal) {
            // Check square above
            if (
                start.row > 0 &&
                this.isSquareComplete(start.row - 1, Math.min(start.col, end.col))
            ) {
                wouldComplete = true;
            }
            // Check square below
            if (
                !wouldComplete &&
                start.row < this.game.gridRows - 1 &&
                this.isSquareComplete(start.row, Math.min(start.col, end.col))
            ) {
                wouldComplete = true;
            }
        } else {
            // Check square to the left
            if (
                start.col > 0 &&
                this.isSquareComplete(Math.min(start.row, end.row), start.col - 1)
            ) {
                wouldComplete = true;
            }
            // Check square to the right
            if (
                !wouldComplete &&
                start.col < this.game.gridCols - 1 &&
                this.isSquareComplete(Math.min(start.row, end.row), start.col)
            ) {
                wouldComplete = true;
            }
        }

        // Remove the temporary line
        this.game.lines.delete(lineKey);

        return wouldComplete;
    }

    /**
     * Get all safe lines (don't complete squares)
     */
    getSafeLines() {
        const allPossibleLines = this.getAllPossibleLines();
        const safeLines = [];

        for (const lineKey of allPossibleLines) {
            // Skip lines that are already drawn
            if (this.game.lines.has(lineKey)) {
                continue;
            }

            // Check if this line would complete a square
            if (!this.wouldCompleteSquare(lineKey)) {
                safeLines.push(lineKey);
            }
        }

        return safeLines;
    }

    /**
     * Get the player who drew a line
     */
    getLinePlayer(lineKey) {
        return this.game.lineOwners.get(lineKey) || 1;
    }

    /**
     * Get the cell owner for effects
     */
    getCellOwnerForEffects(cellKey) {
        if (this.game.squares[cellKey]) return this.game.squares[cellKey];
        return null;
    }
}
