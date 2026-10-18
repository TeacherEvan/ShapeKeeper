export function initializeMultipliers(system) {
    const { game } = system;
    game.squareMultipliers = {};
    const totalSquares = Math.max(0, (game.gridRows - 1) * (game.gridCols - 1));
    if (totalSquares === 0) return;

    const allSquareKeys = [];
    for (let row = 0; row < game.gridRows - 1; row++) {
        for (let col = 0; col < game.gridCols - 1; col++) {
            allSquareKeys.push(`${row},${col}`);
        }
    }

    for (let i = allSquareKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSquareKeys[i], allSquareKeys[j]] = [allSquareKeys[j], allSquareKeys[i]];
    }

    // 20% of the board contains secret 0.2x multipliers (at least 1 on any non-empty board)
    const multiplierCount = Math.max(1, Math.round(totalSquares * 0.2));
    for (let i = 0; i < multiplierCount && i < allSquareKeys.length; i++) {
        game.squareMultipliers[allSquareKeys[i]] = { type: 'multiplier', value: 0.2 };
    }
}
