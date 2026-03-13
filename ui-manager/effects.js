/**
 * Player effect badge rendering helpers.
 */

function buildEffectDescriptors(effects) {
    const descriptors = [];

    if (effects.frozenTurns > 0) {
        descriptors.push({ text: '❄️', title: `Frozen for ${effects.frozenTurns} turn(s)` });
    }
    if (effects.shieldCount > 0) {
        descriptors.push({
            text: '🛡️',
            title: `Shield (${effects.shieldCount} squares protected)`,
        });
    }
    if (effects.doublePointsCount > 0) {
        descriptors.push({
            text: '✨×2',
            title: `Double points (${effects.doublePointsCount} squares)`,
        });
    }
    if (effects.ghostLines > 0) {
        descriptors.push({ text: '👻', title: `Ghost lines (${effects.ghostLines} remaining)` });
    }
    if (effects.bonusTurns > 0) {
        descriptors.push({
            text: `🎁×${effects.bonusTurns}`,
            title: `Bonus turns (${effects.bonusTurns} remaining)`,
        });
    }
    if (effects.doubleLine) {
        descriptors.push({ text: '⚡', title: 'Lightning - Draw 2 lines!' });
    }

    return descriptors;
}

export function renderPlayerEffects(game, playerNum, playerInfoElement) {
    if (!playerInfoElement) {
        return;
    }

    const effects = game.playerEffects[playerNum];
    let effectsContainer = playerInfoElement.querySelector('.player-effects');

    if (!effectsContainer) {
        effectsContainer = document.createElement('div');
        effectsContainer.className = 'player-effects';
        playerInfoElement.appendChild(effectsContainer);
    }

    const effectDescriptors = buildEffectDescriptors(effects);
    const signature = JSON.stringify(effectDescriptors);
    if (effectsContainer.dataset.signature === signature) {
        return;
    }

    effectsContainer.replaceChildren();
    effectDescriptors.forEach(({ text, title }) => {
        const icon = document.createElement('span');
        icon.title = title;
        icon.textContent = text;
        effectsContainer.appendChild(icon);
    });

    effectsContainer.dataset.signature = signature;
    effectsContainer.setAttribute(
        'aria-label',
        effectDescriptors.length > 0
            ? `Active effects: ${effectDescriptors.map(({ title }) => title).join(', ')}`
            : 'No active effects'
    );
}
