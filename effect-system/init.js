import { TILE_EFFECTS } from '../constants.js';

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

export function initializeTileEffects(system) {
    const { game } = system;
    const totalSquares = (game.gridRows - 1) * (game.gridCols - 1);

    if (!game.partyModeEnabled) {
        console.log('[TileEffects] Party Mode disabled - no tile effects');
        return;
    }

    const allPositions = [];
    for (let row = 0; row < game.gridRows - 1; row++) {
        for (let col = 0; col < game.gridCols - 1; col++) {
            allPositions.push(`${row},${col}`);
        }
    }

    for (let i = allPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
    }

    const effectCount = totalSquares;
    const trapsCount = Math.floor(effectCount / 2);
    const powerupsCount = effectCount - trapsCount;

    let index = 0;

    for (let i = 0; i < trapsCount && index < allPositions.length; i++) {
        const trap = TILE_EFFECTS.traps[Math.floor(Math.random() * TILE_EFFECTS.traps.length)];
        game.tileEffects[allPositions[index++]] = {
            type: 'trap',
            effect: trap,
            revealed: false,
            activated: false,
        };
    }

    for (let i = 0; i < powerupsCount && index < allPositions.length; i++) {
        const powerup =
            TILE_EFFECTS.powerups[Math.floor(Math.random() * TILE_EFFECTS.powerups.length)];
        game.tileEffects[allPositions[index++]] = {
            type: 'powerup',
            effect: powerup,
            revealed: false,
            activated: false,
        };
    }

    console.log(
        `[TileEffects] Party Mode enabled - ALL ${effectCount} squares have effects (${trapsCount} traps, ${powerupsCount} powerups)`
    );
}
