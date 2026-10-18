/**
 * ShapeKeeper - Levels Screen Controller
 *
 * Renders the 25-level progression grid, handles level selection,
 * and starts level matches with appropriate grid sizing and 7s timer.
 */

import { DotsAndBoxesGame } from '../../dots-and-boxes-game.js';
import { requestFullscreen } from './Fullscreen.js';
import { LevelsProgress, MAX_LEVEL, getGridSizeForLevel } from './LevelsProgress.js';
import { showScreen } from './ScreenTransition.js';

export function startLevelMatch(levelNumber, deps) {
    const { getState, setActiveGame } = deps;
    const { welcomeAnimation } = getState();

    // Trigger Levels mode: flips levelsTriggered to true and clears default 120 sprites to 1
    LevelsProgress.triggerLevelsMode();

    if (welcomeAnimation) {
        welcomeAnimation.syncWithLevelsProgress();
        welcomeAnimation.moveToGameScreen();
    }

    const gridSize = getGridSizeForLevel(levelNumber);
    const p1Color = document.getElementById('player1Color')?.value || '#FF0000';
    const p2Color = document.getElementById('player2Color')?.value || '#0000FF';

    const game = new DotsAndBoxesGame(gridSize, p1Color, p2Color, {
        isLevelsMode: true,
        currentLevel: levelNumber,
        localMode: 'ai',
        aiDifficulty: 'hard',
        turnDurationSeconds: 7,
        turnDurationMs: 7000,
    });

    showScreen('gameScreen');
    requestFullscreen();
    setActiveGame(game);
}

export function renderLevelsGrid(deps) {
    const container = document.getElementById('levelsGridContainer');
    const spriteBadge = document.getElementById('levelsSpriteCountBadge');
    const unlockedBadge = document.getElementById('levelsUnlockedCountBadge');

    if (!container) return;

    const state = LevelsProgress.getState();

    if (spriteBadge) {
        spriteBadge.textContent = String(state.spritesObtained);
    }
    if (unlockedBadge) {
        unlockedBadge.textContent = `${state.unlockedLevel}/${MAX_LEVEL}`;
    }

    container.innerHTML = '';

    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
        const { cols, rows } = getGridSizeForLevel(lvl);
        const isUnlocked = lvl <= state.unlockedLevel;
        const isCompleted = state.completedLevels.includes(lvl);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `level-btn ${isCompleted ? 'completed' : isUnlocked ? 'unlocked' : 'locked'}`;
        btn.dataset.level = String(lvl);
        btn.dataset.testid = `level-button-${lvl}`;
        btn.disabled = !isUnlocked;

        btn.innerHTML = `
            <span class="level-num">Level ${lvl}</span>
            <span class="level-grid-label">${cols}×${rows}</span>
            <span class="level-status-icon">${isCompleted ? '★' : isUnlocked ? '▶' : '🔒'}</span>
        `;

        if (isUnlocked) {
            btn.addEventListener('click', () => {
                startLevelMatch(lvl, deps);
            });
        }

        container.appendChild(btn);
    }
}
