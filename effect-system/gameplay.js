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
            game.particleSystem.createMultiplierParticles.bind(game.particleSystem)
        );
        game.uiManager.updateUI();
    }
    game.draw();
}

/**
 * Opponent-tap mechanic (multiplayer only). An opponent taps a completed
 * square to reduce its effective multiplier to 0.5x. The server is the
 * source of truth: it validates (no self-taps, no truthOrDare, no revealed
 * squares, room must be playing), increments `taps`, and stores the new
 * `effectiveMultiplier` on the row. The Convex game-state subscription
 * broadcasts the change to all clients; this function only fires the
 * mutation and renders a brief tap feedback.
 *
 * For local hot-seat (no Convex), the tap is applied locally on the same
 * client's state so the user can experiment with the mechanic offline.
 */
export async function tapSquare(system, squareKey) {
    const { game } = system;

    if (!game.squares[squareKey]) {
        return;
    }

    if (game.revealedMultipliers.has(squareKey)) {
        // Already revealed — tapping is meaningless.
        return;
    }

    if (game.isMultiplayer) {
        // Only opponents (not the owner) can tap.
        const squareOwner = game.squares[squareKey];
        if (squareOwner === game.myPlayerNumber) {
            return;
        }
        if (window.ShapeKeeperConvex?.tapSquare) {
            const result = await window.ShapeKeeperConvex.tapSquare(squareKey);
            if (result?.error) {
                console.warn('[Game] tapSquare rejected:', result.error);
            }
            return;
        }
    }

    // Local-mode path: apply the tap to local state directly.
    const current = game.squareMultipliers[squareKey];
    if (current && current.type === 'multiplier' && (current.value ?? 0) > 0.5) {
        game.squareMultipliers[squareKey] = { type: 'multiplier', value: 0.5 };
    }

    game.draw();
}
