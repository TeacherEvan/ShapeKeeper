import { getMineCountForLevel, placeMines } from './mines.js';

/**
 * Seed the board's hidden mines.
 *
 * Only levels mode has mines, and only from level 15 (see `mines.js`). Casual
 * local and online games construct the game at the default level, so they get
 * an empty table — online keeps its own server-side multiplier table as the
 * single source of truth.
 *
 * @param {{ game: object }} system
 */
export function initializeMultipliers(system) {
    const { game } = system;
    game.squareMultipliers = {};

    const totalSquares = Math.max(0, (game.gridRows - 1) * (game.gridCols - 1));
    if (totalSquares === 0) {
        game.mineCount = 0;
        return;
    }

    const allSquareKeys = [];
    for (let row = 0; row < game.gridRows - 1; row++) {
        for (let col = 0; col < game.gridCols - 1; col++) {
            allSquareKeys.push(`${row},${col}`);
        }
    }

    const mineCount = getMineCountForLevel(game.currentLevel, totalSquares);
    game.mineCount = mineCount;
    if (mineCount === 0) return;

    for (const squareKey of placeMines(allSquareKeys, mineCount)) {
        game.squareMultipliers[squareKey] = {
            type: 'multiplier',
            value: 0.2,
            isMine: true,
        };
    }
}
