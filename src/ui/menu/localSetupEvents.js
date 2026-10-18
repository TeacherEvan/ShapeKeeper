/**
 * Local setup event bindings.
 * Wires the local game setup screen: opponent/AI controls, turn-timer source
 * selection, grid-size buttons, colorblind palette, and start/load local game.
 *
 * Module-private state:
 *   - lastLocalConfig  config last used to start/load a local game (reused by
 *                      "Play Again", exposed via getLastLocalConfig/setLastLocalConfig)
 *   - activeTimerSource  which input ('select'|'input') currently owns the
 *                      turn-duration value
 */

import { DotsAndBoxesGame } from '../../../dots-and-boxes-game.js';
import { requestFullscreen } from '../Fullscreen.js';
import {
    getSelectedGridSize,
    isFullscreenTriggered,
    setFullscreenTriggered,
    setSelectedGridSize,
    showScreen,
} from '../ScreenTransition.js';
import { showToast } from '../Toast.js';

let lastLocalConfig = null;

/** Allowed Time for local games: whole seconds, 0 = no limit. */
function parseLocalTurnDuration() {
    const input = document.getElementById('localTurnDuration');
    if (!input) return 0;
    const raw = input.value.trim();
    if (raw === '') return 0;
    const seconds = parseInt(raw, 10);
    if (!Number.isInteger(seconds) || seconds < 0) return 0;
    return Math.min(600, seconds);
}

function buildLocalGameFromConfig(config) {
    return new DotsAndBoxesGame(config.gridSize, config.player1Color, config.player2Color, {
        localMode: config.localMode,
        aiDifficulty: config.aiDifficulty,
        tutorialEnabled: config.tutorialEnabled,
        turnDurationSeconds: config.turnDurationSeconds,
        turnDurationMs: config.turnDurationMs,
    });
}

export function getLastLocalConfig() {
    return lastLocalConfig;
}

export function setLastLocalConfig(config) {
    lastLocalConfig = config;
}

export { buildLocalGameFromConfig };

export function bindLocalSetupEvents(deps) {
    const { getState, setActiveGame } = deps;

    const localOpponentType = document.getElementById('localOpponentType');
    const localAIDifficulty = document.getElementById('localAIDifficulty');
    const localTutorialMode = document.getElementById('localTutorialMode');
    const syncLocalAIControls = () => {
        if (!localOpponentType || !localAIDifficulty) {
            return;
        }
        localAIDifficulty.disabled = localOpponentType.value !== 'ai';
        if (localOpponentType.value === 'ai' && localTutorialMode) {
            localTutorialMode.checked = false;
            localTutorialMode.disabled = true;
        } else if (localTutorialMode) {
            localTutorialMode.disabled = false;
        }
    };
    localOpponentType?.addEventListener('change', syncLocalAIControls);
    syncLocalAIControls();

    let activeTimerSource = null;
    const localTurnDurationInput = document.getElementById('localTurnDuration');
    const localTurnTimerSelect = document.getElementById('localTurnTimer');

    if (localTurnDurationInput && localTurnTimerSelect) {
        localTurnTimerSelect.addEventListener('change', () => {
            activeTimerSource = 'select';
            const ms = Number(localTurnTimerSelect.value) || 0;
            localTurnDurationInput.value = String(Math.round(ms / 1000));
        });

        const onDurationInput = () => {
            activeTimerSource = 'input';
            const seconds = parseLocalTurnDuration();
            const ms = seconds * 1000;
            const matchingOption = Array.from(localTurnTimerSelect.options).find(
                (opt) => Number(opt.value) === ms
            );
            if (matchingOption) {
                localTurnTimerSelect.value = String(ms);
            } else if (seconds === 0) {
                localTurnTimerSelect.value = '0';
            }
        };

        localTurnDurationInput.addEventListener('input', onDurationInput);
        localTurnDurationInput.addEventListener('change', onDurationInput);
    }

    document.getElementById('localPlayBtn').addEventListener('click', () => {
        activeTimerSource = null;
        if (localTutorialMode) {
            localTutorialMode.checked = false;
            localTutorialMode.disabled = false;
        }
        if (localOpponentType) {
            localOpponentType.value = 'human';
        }
        syncLocalAIControls();
        const localTimerEl = document.getElementById('localTurnTimerSection');
        if (localTimerEl) {
            localTimerEl.hidden = !(
                window.FEATURE_FLAGS?.FEATURE_LAVA_TIMER ?? window.FEATURE_LAVA_TIMER
            );
        }
        showScreen('localSetupScreen');
    });

    document.querySelectorAll('.local-grid-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document
                .querySelectorAll('.local-grid-btn')
                .forEach((candidate) => candidate.classList.remove('selected'));
            btn.classList.add('selected');
            setSelectedGridSize(parseInt(btn.dataset.size));
            document.getElementById('startLocalGame').disabled = false;

            if (!isFullscreenTriggered()) {
                setFullscreenTriggered(true);
                requestFullscreen();
            }
        });
    });

    document.getElementById('backToMenuFromLocal').addEventListener('click', () => {
        showScreen('mainMenuScreen');
    });

    document.getElementById('colorblindPalette')?.addEventListener('click', () => {
        const p1 = document.getElementById('player1Color');
        const p2 = document.getElementById('player2Color');
        if (p1) {
            p1.value = '#0072B2';
            p1.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (p2) {
            p2.value = '#E69F00';
            p2.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    document.getElementById('startLocalGame').addEventListener('click', () => {
        const { welcomeAnimation } = getState();
        const player1Color = document.getElementById('player1Color').value;
        const player2Color = document.getElementById('player2Color').value;
        const localMode = localOpponentType?.value === 'ai' ? 'ai' : 'human';
        const aiDifficulty = localAIDifficulty?.value || 'hard';
        const tutorialEnabled = Boolean(localTutorialMode?.checked);

        const turnDurationSelect = document.getElementById('localTurnTimer');
        let turnDurationSeconds = 0;
        let turnDurationMs = 0;

        if (activeTimerSource === 'select') {
            turnDurationMs = Number(turnDurationSelect?.value) || 0;
            turnDurationSeconds = Math.round(turnDurationMs / 1000);
        } else if (activeTimerSource === 'input') {
            turnDurationSeconds = parseLocalTurnDuration();
            turnDurationMs = turnDurationSeconds * 1000;
        } else if (localTurnDurationInput) {
            turnDurationSeconds = parseLocalTurnDuration();
            turnDurationMs = turnDurationSeconds * 1000;
        } else if (turnDurationSelect) {
            turnDurationMs = Number(turnDurationSelect.value) || 0;
            turnDurationSeconds = Math.round(turnDurationMs / 1000);
        }

        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }

        showScreen('gameScreen');
        requestFullscreen();

        const config = {
            gridSize: getSelectedGridSize(),
            player1Color,
            player2Color,
            localMode,
            aiDifficulty,
            tutorialEnabled,
            turnDurationSeconds,
            turnDurationMs,
        };
        lastLocalConfig = config;
        setActiveGame(buildLocalGameFromConfig(config));
    });

    document.getElementById('loadLocalGame')?.addEventListener('click', () => {
        const { welcomeAnimation } = getState();
        const savedPayloadResult = DotsAndBoxesGame.readLocalSaveFromStorage();

        if (!savedPayloadResult.ok) {
            if (savedPayloadResult.type === 'missing') {
                showToast(savedPayloadResult.message, 'info');
                return;
            }

            const toastType = savedPayloadResult.type === 'incompatible' ? 'warning' : 'error';
            showToast(savedPayloadResult.message, toastType);
            return;
        }

        const localGame = buildLocalGameFromConfig(savedPayloadResult.payload.config);
        const loaded = localGame.applyValidatedLocalPayload(savedPayloadResult);

        if (!loaded) {
            showToast('Unable to apply saved local game.', 'error');
            return;
        }

        lastLocalConfig = savedPayloadResult.payload.config;

        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }

        showScreen('gameScreen');
        requestFullscreen();
        setActiveGame(localGame);
        showToast('Loaded saved local game.', 'success', 2200);
    });
}
