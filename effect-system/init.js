export function initializeMultipliers(system) {
    const { game } = system;
    const totalSquares = (game.gridRows - 1) * (game.gridCols - 1);

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

    const counts = {
        x2: Math.floor(totalSquares * 0.65),
        x3: Math.floor(totalSquares * 0.2),
        x4: Math.floor(totalSquares * 0.1),
        x5: Math.floor(totalSquares * 0.04),
        x10: Math.max(1, Math.floor(totalSquares * 0.01)),
    };

    let index = 0;

    for (let i = 0; i < counts.x2; i++) {
        if (index < allSquareKeys.length) {
            game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 2 };
        }
    }
    for (let i = 0; i < counts.x3; i++) {
        if (index < allSquareKeys.length) {
            game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 3 };
        }
    }
    for (let i = 0; i < counts.x4; i++) {
        if (index < allSquareKeys.length) {
            game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 4 };
        }
    }
    for (let i = 0; i < counts.x5; i++) {
        if (index < allSquareKeys.length) {
            game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 5 };
        }
    }
    for (let i = 0; i < counts.x10; i++) {
        if (index < allSquareKeys.length) {
            game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 10 };
        }
    }

    while (index < allSquareKeys.length) {
        game.squareMultipliers[allSquareKeys[index++]] = { type: 'multiplier', value: 2 };
    }
}
