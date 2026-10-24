/**
 * ShapeKeeper - Levels Screen Controller
 *
 * Renders the 25-level progression grid, handles level selection,
 * and starts level matches with appropriate grid sizing and 7s timer.
 */

import { DotsAndBoxesGame } from '../../dots-and-boxes-game.js';
import { requestFullscreen } from './Fullscreen.js';
import {
    ALL_LEVELS_UNLOCKED,
    LevelsProgress,
    MAX_LEVEL,
    getGridSizeForLevel,
    getTurnDurationForLevel,
} from './LevelsProgress.js';
import { showScreen } from './ScreenTransition.js';

export function startLevelMatch(levelNumber, deps) {
    const { getState, setActiveGame } = deps;
    const { welcomeAnimation } = getState();

    // Hide any open game over splash overlay
    const splashOverlay = document.getElementById('gameOverSplashOverlay');
    if (splashOverlay) {
        splashOverlay.hidden = true;
    }

    // Trigger Levels mode: flips levelsTriggered to true and clears default 120 sprites to 1
    LevelsProgress.triggerLevelsMode();

    if (welcomeAnimation) {
        welcomeAnimation.syncWithLevelsProgress();
        welcomeAnimation.moveToGameScreen();
    }

    const gridSize = getGridSizeForLevel(levelNumber);
    const p1Color = document.getElementById('player1Color')?.value || '#FF0000';
    const p2Color = document.getElementById('player2Color')?.value || '#0000FF';

    const turnDurationSeconds = getTurnDurationForLevel();

    showScreen('gameScreen');
    requestFullscreen();

    const game = new DotsAndBoxesGame(gridSize, p1Color, p2Color, {
        isLevelsMode: true,
        currentLevel: levelNumber,
        localMode: 'ai',
        aiDifficulty: 'hard',
        turnDurationSeconds,
        turnDurationMs: turnDurationSeconds * 1000,
    });

    setActiveGame(game);
}

const TIERS = [
    { start: 1, end: 25, label: 'Levels 1–25 · Warm-up' },
    { start: 26, end: 50, label: 'Levels 26–50 · 6×8 Grids' },
    { start: 51, end: 89, label: 'Levels 51–89 · 8×8 Grids' },
    { start: 90, end: 99, label: 'Levels 90–99 · 10×10 Grids' },
    { start: 100, end: 100, label: 'Level 100 · ★ 10×15 Grand Finale' },
];

export function renderLevelsGrid(deps) {
    const container = document.getElementById('levelsGridContainer');
    const spriteBadge = document.getElementById('levelsSpriteCountBadge');
    const unlockedBadge = document.getElementById('levelsUnlockedCountBadge');
    const timerBadge = document.getElementById('levelsTimerBadge');

    if (!container) return;

    const state = LevelsProgress.getState();
    const currentTurnDuration = getTurnDurationForLevel();

    if (spriteBadge) {
        spriteBadge.textContent = String(state.spritesObtained);
    }
    if (unlockedBadge) {
        unlockedBadge.textContent = ALL_LEVELS_UNLOCKED
            ? `${MAX_LEVEL}/${MAX_LEVEL} open`
            : `${state.unlockedLevel}/${MAX_LEVEL}`;
    }
    if (timerBadge) {
        timerBadge.textContent = `${currentTurnDuration}s`;
    }

    container.innerHTML = '';

    for (const tier of TIERS) {
        const tierHeader = document.createElement('div');
        tierHeader.className = 'level-tier-header';
        tierHeader.textContent = tier.label;
        container.appendChild(tierHeader);

        for (let lvl = tier.start; lvl <= tier.end; lvl++) {
            const { cols, rows } = getGridSizeForLevel(lvl);
            const isUnlocked = LevelsProgress.isLevelUnlocked(lvl);
            const isCompleted = state.completedLevels.includes(lvl);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `level-btn ${isCompleted ? 'completed' : isUnlocked ? 'unlocked' : 'locked'}`;
            if (lvl === 100) {
                btn.classList.add('level-100');
            }
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

    const targetBtn = container.querySelector(`[data-level="${state.unlockedLevel}"]`);
    if (targetBtn && typeof targetBtn.scrollIntoView === 'function') {
        setTimeout(() => {
            targetBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 50);
    }
}
