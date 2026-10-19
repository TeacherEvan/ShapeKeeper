/**
 * Session lifecycle event bindings.
 * Wires in-game / multiplayer session controls: start match, leave lobby,
 * exit game, winner screen, rematch, and the mobile controls panel.
 *
 * Module-private state: none beyond DOM lookups; reads lastLocalConfig via
 * the getter exported by localSetupEvents for "Play Again".
 */

import { exitFullscreen, requestFullscreen } from '../Fullscreen.js';
import { bindGameControlsPanel, createGameControlsPanel } from '../GameControlsPanel.js';
import { buildLocalGameFromConfig, getLastLocalConfig } from './localSetupEvents.js';
import { showScreen } from '../ScreenTransition.js';
import { showToast } from '../Toast.js';

import { renderLevelsGrid, startLevelMatch } from '../LevelsScreen.js';
import { hideGameOverSplash } from '../../../ui-manager/celebrations.js';

export function bindSessionEvents(deps) {
    const {
        getState,
        setActiveGame,
        teardownMultiplayerSession,
        resetStartupState,
        retryGameStartupSync,
        leaveFailedStartup,
    } = deps;

    // Wire the mobile-first controls panel: a small toggle button that opens
    // the action row behind a double-tap (UX guard against accidental triggers
    // during gameplay). See src/ui/GameControlsPanel.js for the state machine.
    const controlsToggleBtn = document.getElementById('gameControlsToggleBtn');
    const controlsPanelEl = document.getElementById('gameControlsPanel');
    if (controlsToggleBtn && controlsPanelEl) {
        const controlsPanel = createGameControlsPanel();
        bindGameControlsPanel(controlsPanel, controlsToggleBtn, controlsPanelEl);
    }

    document.getElementById('startMultiplayerGame').addEventListener('click', async () => {
        const { lobbyManager } = getState();

        if (window.ShapeKeeperConvex) {
            const result = await window.ShapeKeeperConvex.startGame();
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }

            // User-initiated gesture: safe to request fullscreen here.
            requestFullscreen();

            showToast('Starting game...', 'success', 2000);
            return;
        }

        if (!lobbyManager.canStartGame()) {
            showToast('All players must be ready to start!', 'warning');
            return;
        }

        showToast('Multiplayer game start requires backend integration.', 'info', 5000);
    });

    document.getElementById('leaveLobby').addEventListener('click', async () => {
        const { lobbyManager } = getState();
        if (window.ShapeKeeperConvex) {
            await teardownMultiplayerSession({ leaveRoom: true });
            return;
        }

        lobbyManager.leaveRoom();
        resetStartupState();
        showScreen('mainMenuScreen');
    });

    document.getElementById('retryGameStartup')?.addEventListener('click', () => {
        retryGameStartupSync();
    });

    document.getElementById('leaveFailedStartup')?.addEventListener('click', () => {
        leaveFailedStartup();
    });

    document.getElementById('exitGame').addEventListener('click', async () => {
        const { game, welcomeAnimation } = getState();
        exitFullscreen();
        if (game?.isMultiplayer && window.ShapeKeeperConvex?.getCurrentRoomId?.()) {
            await teardownMultiplayerSession({ leaveRoom: true });
            return;
        }

        showScreen('mainMenuScreen');
        setActiveGame(null);
        resetStartupState();

        if (welcomeAnimation) {
            welcomeAnimation.moveBackToMainMenu();
        }
    });

    async function requestOnlineRematch() {
        const btn = document.getElementById('playAgain');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Waiting for opponent…';
        }
        if (window.ShapeKeeperConvex?.requestRematch) {
            const result = await window.ShapeKeeperConvex.requestRematch();
            if (result?.error) {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Play Again';
                }
                showToast('Rematch failed: ' + result.error, 'error');
            }
        }
    }

    document.getElementById('winnerMainMenu')?.addEventListener('click', async () => {
        const { game, welcomeAnimation } = getState();
        if (game?.isMultiplayer && window.ShapeKeeperConvex?.getCurrentRoomId?.()) {
            await teardownMultiplayerSession({ leaveRoom: true });
            return;
        }
        showScreen('mainMenuScreen');
        setActiveGame(null);
        resetStartupState();
        welcomeAnimation?.moveBackToMainMenu();
    });

    document.getElementById('playAgain')?.addEventListener('click', async () => {
        const { game } = getState();
        if (game?.isMultiplayer && window.ShapeKeeperConvex?.getCurrentRoomId?.()) {
            await requestOnlineRematch();
            return;
        }
        if (game?.isLevelsMode) {
            const nextLvl = game._nextLevelToPlay ?? game.currentLevel;
            startLevelMatch(nextLvl, deps);
            return;
        }
        if (getLastLocalConfig()) {
            showScreen('gameScreen');
            setActiveGame(buildLocalGameFromConfig(getLastLocalConfig()));
            return;
        }
        document.getElementById('winnerMainMenu')?.click();
    });

    document.getElementById('splashRetryLevelBtn')?.addEventListener('click', () => {
        const { game } = getState();
        hideGameOverSplash();
        const levelToPlay = game?._nextLevelToPlay ?? game?.currentLevel ?? 1;
        startLevelMatch(levelToPlay, deps);
    });

    document.getElementById('splashLevelsGridBtn')?.addEventListener('click', () => {
        hideGameOverSplash();
        exitFullscreen();
        setActiveGame(null);
        resetStartupState();
        renderLevelsGrid(deps);
        showScreen('levelsScreen');
    });

    document.getElementById('winnerLevelsBtn')?.addEventListener('click', () => {
        hideGameOverSplash();
        exitFullscreen();
        setActiveGame(null);
        resetStartupState();
        renderLevelsGrid(deps);
        showScreen('levelsScreen');
    });

    document.getElementById('splashMainMenuBtn')?.addEventListener('click', () => {
        hideGameOverSplash();
        document.getElementById('winnerMainMenu')?.click();
    });

    window.addEventListener('keydown', (e) => {
        const overlay = document.getElementById('gameOverSplashOverlay');
        if (!overlay || overlay.hidden) return;

        if (e.key === ' ' || e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('splashRetryLevelBtn')?.click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            document.getElementById('splashLevelsGridBtn')?.click();
        }
    });
}
