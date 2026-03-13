/**
 * ShapeKeeper - Game Logic
 * Core game mechanics for squares, triangles, and line drawing
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
        // Shape exclusivity check: if this cell is claimed by a triangle, square cannot form
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
     * Claim a cell for shape exclusivity
     */
    claimCell(row, col) {
        this.game.claimedCells.add(`${row},${col}`);
    }

    /**
     * Check for triangles completed by a line
     */
    checkForTriangles(lineKey) {
        const [start, end] = parseLineKey(lineKey);

        const completedTriangles = [];
        const lineType = getLineType(start, end);

        if (lineType === 'diagonal') {
            // Diagonal lines can complete triangles in adjacent cells
            this._checkTrianglesForDiagonal(start, end, completedTriangles);
        } else if (lineType === 'horizontal' || lineType === 'vertical') {
            // Orthogonal lines can complete triangles they're part of
            this._checkTrianglesForOrthogonal(start, end, lineType, completedTriangles);
        }

        return completedTriangles;
    }

    /**
     * Check triangles for diagonal line
     */
    _checkTrianglesForDiagonal(start, end, completedTriangles) {
        const minRow = Math.min(start.row, end.row);
        const minCol = Math.min(start.col, end.col);

        // Determine diagonal direction: TL→BR or TR→BL
        const isTLtoBR =
            (start.row < end.row && start.col < end.col) ||
            (start.row > end.row && start.col > end.col);

        if (isTLtoBR) {
            // Top-right triangle
            const topRight = this._checkSingleTriangle(
                { row: minRow, col: minCol }, // TL corner
                { row: minRow, col: minCol + 1 }, // TR corner
                { row: minRow + 1, col: minCol + 1 }, // BR corner
                'TR'
            );
            if (topRight) completedTriangles.push(topRight);

            // Bottom-left triangle
            const bottomLeft = this._checkSingleTriangle(
                { row: minRow, col: minCol }, // TL corner
                { row: minRow + 1, col: minCol }, // BL corner
                { row: minRow + 1, col: minCol + 1 }, // BR corner
                'BL'
            );
            if (bottomLeft) completedTriangles.push(bottomLeft);
        } else {
            // Top-left triangle
            const topLeft = this._checkSingleTriangle(
                { row: minRow, col: minCol }, // TL corner
                { row: minRow, col: minCol + 1 }, // TR corner
                { row: minRow + 1, col: minCol }, // BL corner
                'TL'
            );
            if (topLeft) completedTriangles.push(topLeft);

            // Bottom-right triangle
            const bottomRight = this._checkSingleTriangle(
                { row: minRow, col: minCol + 1 }, // TR corner
                { row: minRow + 1, col: minCol }, // BL corner
                { row: minRow + 1, col: minCol + 1 }, // BR corner
                'BR'
            );
            if (bottomRight) completedTriangles.push(bottomRight);
        }
    }

    /**
     * Check triangles for orthogonal line
     */
    _checkTrianglesForOrthogonal(start, end, lineType, completedTriangles) {
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);

        if (lineType === 'horizontal') {
            // Triangles below this horizontal line
            if (minRow < this.game.gridRows - 1) {
                const bl = this._checkSingleTriangle(
                    { row: minRow, col: minCol },
                    { row: minRow, col: maxCol },
                    { row: minRow + 1, col: minCol },
                    'BL'
                );
                if (bl) completedTriangles.push(bl);

                const br = this._checkSingleTriangle(
                    { row: minRow, col: minCol },
                    { row: minRow, col: maxCol },
                    { row: minRow + 1, col: maxCol },
                    'BR'
                );
                if (br) completedTriangles.push(br);
            }

            // Triangles above this horizontal line
            if (minRow > 0) {
                const tl = this._checkSingleTriangle(
                    { row: minRow - 1, col: minCol },
                    { row: minRow, col: minCol },
                    { row: minRow, col: maxCol },
                    'TL'
                );
                if (tl) completedTriangles.push(tl);

                const tr = this._checkSingleTriangle(
                    { row: minRow - 1, col: maxCol },
                    { row: minRow, col: minCol },
                    { row: minRow, col: maxCol },
                    'TR'
                );
                if (tr) completedTriangles.push(tr);
            }
        } else if (lineType === 'vertical') {
            // Triangles to the right
            if (minCol < this.game.gridCols - 1) {
                const tr = this._checkSingleTriangle(
                    { row: minRow, col: minCol },
                    { row: maxRow, col: minCol },
                    { row: minRow, col: minCol + 1 },
                    'TR'
                );
                if (tr) completedTriangles.push(tr);

                const br = this._checkSingleTriangle(
                    { row: minRow, col: minCol },
                    { row: maxRow, col: minCol },
                    { row: maxRow, col: minCol + 1 },
                    'BR'
                );
                if (br) completedTriangles.push(br);
            }

            // Triangles to the left
            if (minCol > 0) {
                const tl = this._checkSingleTriangle(
                    { row: minRow, col: minCol },
                    { row: maxRow, col: minCol },
                    { row: minRow, col: minCol - 1 },
                    'TL'
                );
                if (tl) completedTriangles.push(tl);

                const bl = this._checkSingleTriangle(
                    { row: minRow, col: minCol },
                    { row: maxRow, col: minCol },
                    { row: maxRow, col: minCol - 1 },
                    'BL'
                );
                if (bl) completedTriangles.push(bl);
            }
        }
    }

    /**
     * Check if a specific triangle is complete
     */
    _checkSingleTriangle(v1, v2, v3, orientation) {
        // Get the 3 edges of this triangle
        const edge1 = getLineKey(v1, v2);
        const edge2 = getLineKey(v2, v3);
        const edge3 = getLineKey(v3, v1);

        // Check if all 3 edges exist
        if (
            !this.game.lines.has(edge1) ||
            !this.game.lines.has(edge2) ||
            !this.game.lines.has(edge3)
        ) {
            return null;
        }

        // Generate unique triangle key
        const vertices = [v1, v2, v3].sort((a, b) =>
            a.row === b.row ? a.col - b.col : a.row - b.row
        );
        const triKey = `tri-${vertices[0].row},${vertices[0].col}-${vertices[1].row},${vertices[1].col}-${vertices[2].row},${vertices[2].col}`;

        // Only return if not already completed
        if (this.game.triangles[triKey]) {
            return null;
        }

        return {
            key: triKey,
            vertices: [v1, v2, v3],
            orientation: orientation,
        };
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
        if (this.game.triangleCellOwners && this.game.triangleCellOwners.has(cellKey)) {
            const owners = Array.from(this.game.triangleCellOwners.get(cellKey));
            return owners[0];
        }
        return null;
    }
}
