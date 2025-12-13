/**
 * ShapeKeeper Game State Manager
 * Manages game state, turns, scores, and win conditions
 * @module game/GameState
 */

import { GAME } from '../core/constants.js';
import { getLineKey } from '../core/utils.js';

/**
 * Player data structure
 * @typedef {Object} Player
 * @property {string} id - Player ID
 * @property {string} name - Player display name
 * @property {string} color - Player color
 * @property {number} score - Current score
 * @property {Set<string>} squares - Owned square keys
 */

/**
 * Game state data
 * @typedef {Object} GameStateData
 * @property {string} phase - 'waiting', 'playing', 'paused', 'ended'
 * @property {number} currentPlayer - Current player index (0 or 1)
 * @property {Set<string>} lines - All drawn line keys
 * @property {Map<string, number>} squares - Square owners (key -> playerIndex)
 * @property {number[]} scores - Player scores [p1, p2]
 * @property {number} turnCount - Total turns taken
 */

export class GameState {
    constructor(options = {}) {
        this.options = {
            playerCount: 2,
            gridRows: 10,
            gridCols: 10,
            ...options,
        };

        this.reset();
    }

    /**
     * Reset game state
     */
    reset() {
        this.phase = 'waiting';
        this.currentPlayer = 0;
        this.lines = new Set();
        this.squares = new Map(); // squareKey -> playerIndex
        this.scores = [0, 0];
        this.turnCount = 0;
        this.lastLineKey = null;
        this.lastSquaresCompleted = [];
        this.winner = null;

        this.players = [
            {
                id: 'p1',
                name: 'Player 1',
                color: GAME.PLAYER_COLORS[0],
                score: 0,
                squares: new Set(),
            },
            {
                id: 'p2',
                name: 'Player 2',
                color: GAME.PLAYER_COLORS[1],
                score: 0,
                squares: new Set(),
            },
        ];
    }

    /**
     * Start the game
     */
    start() {
        this.phase = 'playing';
        this.currentPlayer = 0;
    }

    /**
     * Pause the game
     */
    pause() {
        if (this.phase === 'playing') {
            this.phase = 'paused';
        }
    }

    /**
     * Resume the game
     */
    resume() {
        if (this.phase === 'paused') {
            this.phase = 'playing';
        }
    }

    /**
     * Check if a line can be drawn
     * @param {string} lineKey - Line key to check
     * @returns {boolean}
     */
    canDrawLine(lineKey) {
        return this.phase === 'playing' && !this.lines.has(lineKey);
    }

    /**
     * Draw a line and check for completed squares
     * @param {string} lineKey - Line key to draw
     * @returns {{success: boolean, squaresCompleted: string[], switchTurn: boolean}}
     */
    drawLine(lineKey) {
        if (!this.canDrawLine(lineKey)) {
            return { success: false, squaresCompleted: [], switchTurn: false };
        }

        this.lines.add(lineKey);
        this.lastLineKey = lineKey;
        this.turnCount++;

        // Check for completed squares
        const completedSquares = this.checkSquares(lineKey);
        this.lastSquaresCompleted = completedSquares;

        // Award squares to current player
        for (const squareKey of completedSquares) {
            this.squares.set(squareKey, this.currentPlayer);
            this.players[this.currentPlayer].squares.add(squareKey);
            this.scores[this.currentPlayer]++;
            this.players[this.currentPlayer].score++;
        }

        // Check for game end
        const totalPossibleSquares = (this.options.gridRows - 1) * (this.options.gridCols - 1);
        if (this.squares.size >= totalPossibleSquares) {
            this.endGame();
        }

        // Player keeps turn if they completed a square
        const switchTurn = completedSquares.length === 0;

        return {
            success: true,
            squaresCompleted: completedSquares,
            switchTurn,
        };
    }

    /**
     * Check for completed squares after drawing a line
     * @param {string} lineKey - Newly drawn line key
     * @returns {string[]} Array of completed square keys
     */
    checkSquares(lineKey) {
        const completed = [];
        const parts = lineKey.split('-');
        const [r1, c1] = parts[0].split(',').map(Number);
        const [r2, c2] = parts[1].split(',').map(Number);

        // Determine if horizontal or vertical line
        if (r1 === r2) {
            // Horizontal line - check squares above and below
            const col = Math.min(c1, c2);

            // Square above
            if (r1 > 0) {
                const squareKey = `${r1 - 1},${col}`;
                if (!this.squares.has(squareKey) && this.isSquareComplete(r1 - 1, col)) {
                    completed.push(squareKey);
                }
            }

            // Square below
            if (r1 < this.options.gridRows - 1) {
                const squareKey = `${r1},${col}`;
                if (!this.squares.has(squareKey) && this.isSquareComplete(r1, col)) {
                    completed.push(squareKey);
                }
            }
        } else {
            // Vertical line - check squares left and right
            const row = Math.min(r1, r2);

            // Square left
            if (c1 > 0) {
                const squareKey = `${row},${c1 - 1}`;
                if (!this.squares.has(squareKey) && this.isSquareComplete(row, c1 - 1)) {
                    completed.push(squareKey);
                }
            }

            // Square right
            if (c1 < this.options.gridCols - 1) {
                const squareKey = `${row},${c1}`;
                if (!this.squares.has(squareKey) && this.isSquareComplete(row, c1)) {
                    completed.push(squareKey);
                }
            }
        }

        return completed;
    }

    /**
     * Check if a square has all 4 sides drawn
     * @param {number} row - Square row
     * @param {number} col - Square column
     * @returns {boolean}
     */
    isSquareComplete(row, col) {
        const top = getLineKey({ row, col }, { row, col: col + 1 });
        const bottom = getLineKey({ row: row + 1, col }, { row: row + 1, col: col + 1 });
        const left = getLineKey({ row, col }, { row: row + 1, col });
        const right = getLineKey({ row, col: col + 1 }, { row: row + 1, col: col + 1 });

        return (
            this.lines.has(top) &&
            this.lines.has(bottom) &&
            this.lines.has(left) &&
            this.lines.has(right)
        );
    }

    /**
     * Switch to next player
     */
    nextTurn() {
        this.currentPlayer = (this.currentPlayer + 1) % this.options.playerCount;
    }

    /**
     * End the game and determine winner
     */
    endGame() {
        this.phase = 'ended';

        if (this.scores[0] > this.scores[1]) {
            this.winner = 0;
        } else if (this.scores[1] > this.scores[0]) {
            this.winner = 1;
        } else {
            this.winner = -1; // Tie
        }
    }

    /**
     * Get current player
     * @returns {Player}
     */
    getCurrentPlayer() {
        return this.players[this.currentPlayer];
    }

    /**
     * Get player by index
     * @param {number} index - Player index
     * @returns {Player}
     */
    getPlayer(index) {
        return this.players[index];
    }

    /**
     * Get square owner
     * @param {string} squareKey - Square key
     * @returns {number|null} Player index or null if unclaimed
     */
    getSquareOwner(squareKey) {
        return this.squares.has(squareKey) ? this.squares.get(squareKey) : null;
    }

    /**
     * Get remaining squares count
     * @returns {number}
     */
    getRemainingSquares() {
        const total = (this.options.gridRows - 1) * (this.options.gridCols - 1);
        return total - this.squares.size;
    }

    /**
     * Set player names
     * @param {string[]} names - Array of player names
     */
    setPlayerNames(names) {
        for (let i = 0; i < names.length && i < this.players.length; i++) {
            this.players[i].name = names[i];
        }
    }

    /**
     * Apply score change (from effects)
     * @param {number} playerIndex - Player index
     * @param {number} change - Score change (can be negative)
     */
    applyScoreChange(playerIndex, change) {
        this.scores[playerIndex] = Math.max(0, this.scores[playerIndex] + change);
        this.players[playerIndex].score = this.scores[playerIndex];
    }

    /**
     * Swap scores between players
     */
    swapScores() {
        [this.scores[0], this.scores[1]] = [this.scores[1], this.scores[0]];
        this.players[0].score = this.scores[0];
        this.players[1].score = this.scores[1];
    }

    /**
     * Steal a square from opponent
     * @param {number} thiefIndex - Player stealing the square
     * @returns {string|null} Stolen square key or null
     */
    stealRandomSquare(thiefIndex) {
        const victimIndex = (thiefIndex + 1) % 2;
        const victimSquares = Array.from(this.players[victimIndex].squares);

        if (victimSquares.length === 0) return null;

        const squareKey = victimSquares[Math.floor(Math.random() * victimSquares.length)];

        // Transfer square
        this.players[victimIndex].squares.delete(squareKey);
        this.players[victimIndex].score--;
        this.scores[victimIndex]--;

        this.players[thiefIndex].squares.add(squareKey);
        this.players[thiefIndex].score++;
        this.scores[thiefIndex]++;

        this.squares.set(squareKey, thiefIndex);

        return squareKey;
    }

    /**
     * Export state for sync
     * @returns {Object}
     */
    exportState() {
        return {
            phase: this.phase,
            currentPlayer: this.currentPlayer,
            lines: Array.from(this.lines),
            squares: Object.fromEntries(this.squares),
            scores: [...this.scores],
            turnCount: this.turnCount,
            players: this.players.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                score: p.score,
                squares: Array.from(p.squares),
            })),
        };
    }

    /**
     * Import state from sync
     * @param {Object} state - Exported state
     */
    importState(state) {
        this.phase = state.phase || 'waiting';
        this.currentPlayer = state.currentPlayer || 0;
        this.lines = new Set(state.lines || []);
        this.squares = new Map(Object.entries(state.squares || {}));
        this.scores = state.scores || [0, 0];
        this.turnCount = state.turnCount || 0;

        if (state.players) {
            for (let i = 0; i < state.players.length; i++) {
                const p = state.players[i];
                this.players[i] = {
                    id: p.id,
                    name: p.name,
                    color: p.color,
                    score: p.score,
                    squares: new Set(p.squares),
                };
            }
        }
    }

    /**
     * Get game summary
     * @returns {Object}
     */
    getSummary() {
        return {
            phase: this.phase,
            currentPlayer: this.currentPlayer,
            scores: [...this.scores],
            linesDrawn: this.lines.size,
            squaresClaimed: this.squares.size,
            remaining: this.getRemainingSquares(),
            winner: this.winner,
            players: this.players.map((p) => ({ name: p.name, score: p.score })),
        };
    }
}
