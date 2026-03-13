import { TILE_EFFECTS } from '../constants.js';

export function activateCurrentEffect(system) {
    if (!system.pendingEffect) {
        system.closeEffectModal();
        return;
    }

    const { squareKey, effectData, player } = system.pendingEffect;
    const { effect } = effectData;

    system.game.activatedEffects.add(squareKey);
    effectData.activated = true;

    system.game.soundManager.playEffectActivationSound(effectData.type, effect.id);
    executeEffect(system, effect.id, effectData.type, player, squareKey);
    system.closeEffectModal();

    system.game.uiManager.updateUI();
    system.game.draw();
}

export function executeEffect(system, effectId, effectType, player, squareKey) {
    const otherPlayer = player === 1 ? 2 : 1;

    switch (effectId) {
        case 'landmine':
            applyLandmine(system, squareKey, player);
            break;

        case 'secret':
        case 'hypothetical':
        case 'drink':
        case 'dared':
        case 'truth':
        case 'dare_left':
        case 'physical_challenge':
            break;

        case 'reverse':
            system.game.particleSystem.createReverseParticles();
            system.announceTurnMessage('🔄 REVERSE! Play Again!', '#E91E63', 2000);
            system.game.playerEffects[player].bonusTurns += 1;
            break;

        case 'freeze':
            system.game.playerEffects[player].frozenTurns = 1;
            system.game.particleSystem.createFreezeParticles();
            break;

        case 'swap_scores':
            swapScores(system, player, otherPlayer);
            break;

        case 'ghost':
            system.game.playerEffects[player].ghostLines = 3;
            break;

        case 'chaos':
            triggerChaosStorm(system);
            break;

        case 'extra_turns':
            system.game.playerEffects[player].bonusTurns += 2;
            system.game.particleSystem.createPowerupParticles(
                squareKey,
                '#4CAF50',
                system.game.gameLogic.parseSquareKey
            );
            break;

        case 'steal_territory':
            stealConnectedTerritory(system, player, otherPlayer);
            break;

        case 'shield':
            system.game.playerEffects[player].shieldCount = 3;
            system.game.animationSystem.triggerEffectAnimation('shield', player);
            system.game.particleSystem.createShieldParticles();
            break;

        case 'lightning':
            system.game.playerEffects[player].doubleLine = true;
            system.game.particleSystem.createLightningParticles();
            break;

        case 'gift':
            giftRandomShape(system, player, otherPlayer);
            break;

        case 'oracle':
            activateOracleVision(system);
            break;

        case 'double_points':
            system.game.playerEffects[player].doublePointsCount = 3;
            system.game.particleSystem.createPowerupParticles(
                squareKey,
                '#FFD700',
                system.game.gameLogic.parseSquareKey
            );
            break;

        case 'wildcard':
            applyWildcardPowerup(system, player, squareKey);
            break;
    }
}

function applyLandmine(system, squareKey, player) {
    const { game } = system;

    if (game.squares[squareKey]) {
        delete game.squares[squareKey];
        game.protectedSquares.delete(squareKey);
        game.scores[player] = Math.max(0, game.scores[player] - 1);
    } else if (game.triangles && game.triangles[squareKey]) {
        delete game.triangles[squareKey];
        game.scores[player] = Math.max(0, game.scores[player] - 0.5);
    }

    game.particleSystem.createLandmineParticles(squareKey, game.gameLogic.parseSquareKey);
    game.shakeIntensity = 15;

    game.playerEffects[player].bonusTurns = 0;
    game.playerEffects[player].doubleLine = false;
    if (game.currentPlayer === player) {
        game.comboCount = 0;
        game.switchToNextPlayer();
    } else {
        game.playerEffects[player].frozenTurns = Math.max(
            game.playerEffects[player].frozenTurns,
            1
        );
    }
}

function swapScores(system, player, otherPlayer) {
    const { game } = system;
    const temp = game.scores[player];
    game.scores[player] = game.scores[otherPlayer];
    game.scores[otherPlayer] = temp;
    game.particleSystem.createSwapParticles();
}

export function stealConnectedTerritory(system, player, opponent) {
    const opponentSquares = Object.keys(system.game.squares).filter(
        (key) => system.game.squares[key] === opponent && !system.game.protectedSquares.has(key)
    );

    if (opponentSquares.length === 0) {
        system.announceTurnMessage('🛡️ Steal blocked!', '#3F51B5', 1500);
        return;
    }

    const startKey = opponentSquares[Math.floor(Math.random() * opponentSquares.length)];
    const region = getConnectedSquareRegion(system, startKey, opponent);

    if (region.length === 0) {
        system.announceTurnMessage('🛡️ Steal blocked!', '#3F51B5', 1500);
        return;
    }

    for (const key of region) {
        system.game.squares[key] = player;
    }

    system.game.scores[opponent] = Math.max(0, system.game.scores[opponent] - region.length);
    system.game.scores[player] += region.length;

    system.game.particleSystem.createStealParticles(startKey, system.game.gameLogic.parseSquareKey);
}

export function getConnectedSquareRegion(system, startKey, owner) {
    const visited = new Set();
    const queue = [startKey];
    const region = [];

    while (queue.length > 0) {
        const key = queue.pop();
        if (visited.has(key)) continue;
        visited.add(key);

        if (system.game.squares[key] !== owner) continue;
        if (system.game.protectedSquares.has(key)) continue;

        region.push(key);

        const { row, col } = system.game.gameLogic.parseSquareKey(key);
        const neighbors = [
            `${row - 1},${col}`,
            `${row + 1},${col}`,
            `${row},${col - 1}`,
            `${row},${col + 1}`,
        ];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor) && system.game.squares[neighbor] === owner) {
                queue.push(neighbor);
            }
        }
    }

    return region;
}

export function giftRandomShape(system, fromPlayer, toPlayer) {
    const ownedSquares = Object.keys(system.game.squares).filter(
        (key) => system.game.squares[key] === fromPlayer
    );

    if (ownedSquares.length > 0) {
        const key = ownedSquares[Math.floor(Math.random() * ownedSquares.length)];
        system.game.squares[key] = toPlayer;
        system.game.scores[fromPlayer] = Math.max(0, system.game.scores[fromPlayer] - 1);
        system.game.scores[toPlayer] += 1;
        system.game.particleSystem.createGiftParticles();
        return;
    }

    const ownedTriangles = Object.keys(system.game.triangles || {}).filter(
        (key) => system.game.triangles[key] === fromPlayer
    );

    if (ownedTriangles.length > 0) {
        const key = ownedTriangles[Math.floor(Math.random() * ownedTriangles.length)];
        system.game.triangles[key] = toPlayer;
        system.game.scores[fromPlayer] = Math.max(0, system.game.scores[fromPlayer] - 0.5);
        system.game.scores[toPlayer] += 0.5;
        system.game.particleSystem.createGiftParticles();
        return;
    }

    system.game.scores[toPlayer] += 1;
    system.game.particleSystem.createGiftParticles();
}

export function applyWildcardPowerup(system, player, squareKey) {
    const powerups = TILE_EFFECTS.powerups.filter((powerup) => powerup.id !== 'wildcard');
    const chosen = powerups[Math.floor(Math.random() * powerups.length)];

    system.game.particleSystem.createWildcardParticles(
        squareKey,
        system.game.gameLogic.parseSquareKey
    );
    system.announceTurnMessage(`🌟 Wildcard: ${chosen.name}`, chosen.color, 2000);
    executeEffect(system, chosen.id, 'powerup', player, squareKey);
}

export function announceTurnMessage(system, text, color, durationMs = 2000) {
    const turnIndicator = document.getElementById('turnIndicator');
    if (!turnIndicator) return;

    const prevText = turnIndicator.textContent;
    const prevColor = turnIndicator.style.color;

    turnIndicator.textContent = text;
    if (color) {
        turnIndicator.style.color = color;
    }

    setTimeout(() => {
        turnIndicator.textContent = prevText;
        turnIndicator.style.color = prevColor;
        system.game.uiManager.updateUI();
    }, durationMs);
}

export function activateOracleVision(system) {
    system.oracleVisionActive = true;
    system.game.draw();

    if (system.oracleVisionTimeout) {
        clearTimeout(system.oracleVisionTimeout);
    }

    system.oracleVisionTimeout = setTimeout(() => {
        system.oracleVisionActive = false;
        system.game.draw();
    }, 10000);
}

export function triggerChaosStorm(system) {
    const allSquares = Object.keys(system.game.squares);
    const players = allSquares.map((key) => system.game.squares[key]);

    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }

    allSquares.forEach((key, index) => {
        system.game.squares[key] = players[index];
    });

    if (system.game.triangles) {
        const allTriangles = Object.keys(system.game.triangles);
        if (allTriangles.length > 0) {
            const trianglePlayers = allTriangles.map((key) => system.game.triangles[key]);
            for (let i = trianglePlayers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [trianglePlayers[i], trianglePlayers[j]] = [trianglePlayers[j], trianglePlayers[i]];
            }
            allTriangles.forEach((key, index) => {
                system.game.triangles[key] = trianglePlayers[index];
            });
        }
    }

    system.game.scores = { 1: 0, 2: 0 };
    Object.values(system.game.squares).forEach((owner) => {
        system.game.scores[owner]++;
    });
    if (system.game.triangles) {
        Object.values(system.game.triangles).forEach((owner) => {
            system.game.scores[owner] += 0.5;
        });
    }

    system.game.shakeIntensity = 12;
    system.game.screenPulse = 1.5;
    system.game.particleSystem.createChaosParticles();
}

export async function revealMultiplier(system, squareKey) {
    const { game } = system;

    if (game.isMultiplayer) {
        const squareOwner = game.squares[squareKey];
        if (squareOwner !== game.myPlayerNumber) {
            return;
        }

        if (window.ShapeKeeperConvex) {
            const result = await window.ShapeKeeperConvex.revealMultiplier(squareKey);
            if (result.error) {
                console.error('[Game] Error revealing multiplier:', result.error);
                return;
            }
            return;
        }
    }

    game.revealedMultipliers.add(squareKey);
    const multiplierData = game.squareMultipliers[squareKey];
    const player = game.squares[squareKey];

    if (multiplierData && multiplierData.type === 'multiplier') {
        const currentScore = game.scores[player];
        const multiplierValue = multiplierData.value;
        game.scores[player] = currentScore * multiplierValue;

        game.animationSystem.triggerMultiplierAnimation(
            squareKey,
            multiplierValue,
            game.gameLogic.parseSquareKey,
            game.offsetX,
            game.offsetY,
            game.cellSize,
            game.particleSystem.createMultiplierParticles
        );
        game.uiManager.updateUI();
    }
    game.draw();
}

export function revealMultiplierForCell(system, cellKey) {
    const { game } = system;

    game.revealedMultipliers.add(cellKey);

    const multiplierData = game.squareMultipliers[cellKey];
    const owner = game.gameLogic.getCellOwnerForEffects(cellKey);

    if (multiplierData && multiplierData.type === 'multiplier' && owner) {
        const currentScore = game.scores[owner];
        const multiplierValue = multiplierData.value;
        game.scores[owner] = currentScore * multiplierValue;
        game.animationSystem.triggerMultiplierAnimation(
            cellKey,
            multiplierValue,
            game.gameLogic.parseSquareKey,
            game.offsetX,
            game.offsetY,
            game.cellSize,
            game.particleSystem.createMultiplierParticles
        );
        game.uiManager.updateUI();
    }
    game.draw();
}
