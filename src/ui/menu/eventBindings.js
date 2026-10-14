/**
 * Screen-specific event binding helpers for the menu runtime.
 */

import { DotsAndBoxesGame } from '../../../dots-and-boxes-game.js';
import { exitFullscreen, requestFullscreen } from '../Fullscreen.js';
import { bindGameControlsPanel, createGameControlsPanel } from '../GameControlsPanel.js';
import {
    getSelectedGridSize,
    isFullscreenTriggered,
    setFullscreenTriggered,
    setSelectedGridSize,
    showScreen,
} from '../ScreenTransition.js';
import { toggleTheme } from '../ThemeManager.js';
import { showToast } from '../Toast.js';

function buildLocalGameFromConfig(config) {
    return new DotsAndBoxesGame(config.gridSize, config.player1Color, config.player2Color, {
        partyModeEnabled: false,
        localMode: config.localMode,
        aiDifficulty: config.aiDifficulty,
        tutorialEnabled: config.tutorialEnabled,
        turnDurationSeconds: config.turnDurationSeconds ?? 0,
    });
}

/**
 * Allowed Time for local games: whole seconds, 0 = no limit.
 * Sanitises the free-form input (empty or invalid falls back to 0 = no
 * limit); the browser constrains range via min/max, this is the safety net.
 */
function parseLocalTurnDuration() {
    const input = document.getElementById('localTurnDuration');
    if (!input) return 0;
    const raw = input.value.trim();
    if (raw === '') return 0;
    const seconds = parseInt(raw, 10);
    if (!Number.isInteger(seconds) || seconds < 0) return 0;
    return Math.min(600, seconds);
}

export function bindMenuEventHandlers(deps) {
    const {
        getState,
        setActiveGame,
        setStartupState,
        STARTUP_STATES,
        subscribeToRoomUpdates,
        updateLobbyUI,
        teardownMultiplayerSession,
        resetStartupState,
        retryGameStartupSync,
        leaveFailedStartup,
    } = deps;

    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

    document.getElementById('createGameBtn').addEventListener('click', async () => {
        const { lobbyManager } = getState();
        const playerName = document.getElementById('playerName')?.value || 'Host';
        const gridSize = lobbyManager.gridSize || 5;

        if (window.ShapeKeeperConvex) {
            setStartupState(STARTUP_STATES.CREATING_OR_JOINING_ROOM, { visible: false });
            showToast('Creating room...', 'info', 2000);
            const result = await window.ShapeKeeperConvex.createRoom(playerName, gridSize, false);

            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }

            subscribeToRoomUpdates();
            setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });

            lobbyManager.roomCode = result.roomCode;
            lobbyManager.isHost = true;
            showToast('Lobby created', 'success', 4000);
        } else {
            lobbyManager.createRoom(playerName);
        }

        updateLobbyUI();
        showScreen('lobbyScreen');
    });

    document.getElementById('joinGameBtn').addEventListener('click', () => {
        showScreen('lobbyBrowserScreen');

        // Live list of open lobbies — no room codes, no passcodes.
        stopOpenLobbiesSubscription();
        if (window.ShapeKeeperConvex?.subscribeToOpenLobbies) {
            openLobbiesCleanup =
                window.ShapeKeeperConvex.subscribeToOpenLobbies(renderOpenLobbies) || null;
        } else {
            renderOpenLobbies([]);
        }
    });

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

    // Wire the mobile-first controls panel: a small toggle button that opens
    // the action row behind a double-tap (UX guard against accidental triggers
    // during gameplay). See src/ui/GameControlsPanel.js for the state machine.
    const controlsToggleBtn = document.getElementById('gameControlsToggleBtn');
    const controlsPanelEl = document.getElementById('gameControlsPanel');
    if (controlsToggleBtn && controlsPanelEl) {
        const controlsPanel = createGameControlsPanel();
        bindGameControlsPanel(controlsPanel, controlsToggleBtn, controlsPanelEl);
    }

    document.getElementById('localPlayBtn').addEventListener('click', () => {
        if (localTutorialMode) {
            localTutorialMode.checked = false;
            localTutorialMode.disabled = false;
        }
        if (localOpponentType) {
            localOpponentType.value = 'human';
        }
        syncLocalAIControls();
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

    document.getElementById('startLocalGame').addEventListener('click', () => {
        const { welcomeAnimation } = getState();
        const player1Color = document.getElementById('player1Color').value;
        const player2Color = document.getElementById('player2Color').value;
        const localMode = localOpponentType?.value === 'ai' ? 'ai' : 'human';
        const aiDifficulty = localAIDifficulty?.value || 'medium';
        const tutorialEnabled = Boolean(localTutorialMode?.checked);
        const turnDurationSeconds = parseLocalTurnDuration();

        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }

        showScreen('gameScreen');
        requestFullscreen();

        setActiveGame(
            buildLocalGameFromConfig({
                gridSize: getSelectedGridSize(),
                player1Color,
                player2Color,
                localMode,
                aiDifficulty,
                tutorialEnabled,
                turnDurationSeconds,
            })
        );
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

        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }

        showScreen('gameScreen');
        requestFullscreen();
        setActiveGame(localGame);
        showToast('Loaded saved local game.', 'success', 2200);
    });

    // --- Open lobby browser (JOIN LOBBY) ------------------------------------
    // The join screen is gone: players see a live list of open lobbies and
    // click one to join. The room code stays an internal handle (the invite
    // deep link still uses it) but is never typed or displayed.

    let openLobbiesCleanup = null;

    function stopOpenLobbiesSubscription() {
        openLobbiesCleanup?.();
        openLobbiesCleanup = null;
    }

    function getBrowserPlayerName() {
        const input = document.getElementById('browserPlayerName');
        return input?.value.trim() || 'Player';
    }

    function renderOpenLobbies(lobbies) {
        const list = document.getElementById('openLobbiesList');
        const emptyState = document.getElementById('openLobbiesEmpty');
        if (!list) return;

        list.replaceChildren();

        if (!lobbies || lobbies.length === 0) {
            if (emptyState) emptyState.hidden = false;
            return;
        }
        if (emptyState) emptyState.hidden = true;

        lobbies.forEach((lobby) => {
            const entry = document.createElement('button');
            entry.type = 'button';
            entry.className = 'lobby-entry';
            entry.dataset.testid = 'open-lobby-entry';
            entry.dataset.roomCode = lobby.roomCode;

            const host = document.createElement('span');
            host.className = 'lobby-entry-host';
            host.textContent = `${lobby.hostName}'s lobby`;

            const meta = document.createElement('span');
            meta.className = 'lobby-entry-meta';
            const timerLabel =
                lobby.turnDurationSeconds > 0 ? ` · ${lobby.turnDurationSeconds}s/turn` : '';
            meta.textContent = `${lobby.playerCount}/${lobby.maxPlayers} players · ${lobby.gridSize}x${lobby.gridSize}${timerLabel}`;

            entry.append(host, meta);
            entry.addEventListener('click', () => {
                joinLobbyByCode(lobby.roomCode, getBrowserPlayerName());
            });
            list.appendChild(entry);
        });
    }

    /**
     * Join a specific lobby by its (internal) room code. Used by the lobby
     * browser entries and the ?join= deep link.
     */
    async function joinLobbyByCode(roomCode, playerName, passcode = '') {
        const { lobbyManager } = getState();

        if (!window.ShapeKeeperConvex) {
            showToast('Multiplayer mode requires backend integration.', 'info', 5000);
            return;
        }

        setStartupState(STARTUP_STATES.CREATING_OR_JOINING_ROOM, { visible: false });
        showToast('Joining lobby...', 'info', 2000);
        const result = await window.ShapeKeeperConvex.joinRoom(roomCode, playerName, passcode);

        if (result.error) {
            showToast('Error: ' + result.error, 'error');
            return;
        }
        if (!result.roomId) {
            showToast('Could not join that lobby.', 'error');
            return;
        }

        stopOpenLobbiesSubscription();
        subscribeToRoomUpdates();
        setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });

        lobbyManager.roomCode = roomCode.toUpperCase();
        if (passcode) lobbyManager.setIdentity({ passcode });
        lobbyManager.isHost = false;
        showToast('Joined lobby', 'success', 3000);
        updateLobbyUI();
        showScreen('lobbyScreen');
    }

    document.getElementById('backToMenuFromBrowser')?.addEventListener('click', () => {
        stopOpenLobbiesSubscription();
        showScreen('mainMenuScreen');
    });

    document.getElementById('refreshLobbiesBtn')?.addEventListener('click', () => {
        // Re-subscribe for an immediate redelivery of the current list.
        stopOpenLobbiesSubscription();
        if (window.ShapeKeeperConvex?.subscribeToOpenLobbies) {
            openLobbiesCleanup =
                window.ShapeKeeperConvex.subscribeToOpenLobbies(renderOpenLobbies) || null;
        } else {
            renderOpenLobbies([]);
        }
    });

    // Invite-link deep link (?join=CODE): welcome.js dispatches this once the
    // app is initialized; join that lobby directly, bypassing the browser.
    window.addEventListener('shapekeeper:joinFromUrl', (event) => {
        const { roomCode, passcode } = event.detail || {};
        if (!roomCode) return;
        const storedName =
            (typeof localStorage !== 'undefined' &&
                localStorage.getItem('shapekeeper.playerName')) ||
            'Player';
        joinLobbyByCode(roomCode, storedName, passcode || '');
    });

    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const { lobbyManager } = getState();
            if (!lobbyManager.isHost) return;

            const newSize = parseInt(btn.dataset.size);

            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.updateGridSize(newSize);
                if (result.error) {
                    showToast('Error: ' + result.error, 'error');
                }
                return;
            }

            document
                .querySelectorAll('.lobby-grid-btn')
                .forEach((candidate) => candidate.classList.remove('selected'));
            btn.classList.add('selected');
            lobbyManager.setGridSize(newSize);
        });
    });

    // Allowed Time (free-form seconds input, host only). Debounced change
    // handler pushes to the server; the server validates (0-600, whole
    // numbers) and the next room snapshot re-renders the input.
    const turnDurationInput = document.getElementById('lobbyTurnDuration');
    if (turnDurationInput) {
        let debounceTimer = null;
        turnDurationInput.addEventListener('change', async () => {
            const { lobbyManager } = getState();
            if (!lobbyManager.isHost) return;

            const raw = turnDurationInput.value.trim();
            // Empty or 0 = no limit
            const seconds = raw === '' || parseInt(raw, 10) === 0 ? 0 : parseInt(raw, 10);

            if (raw !== '' && (!Number.isInteger(seconds) || seconds < 0)) {
                showToast('Allowed Time must be a whole number of seconds (0 = no limit)', 'error');
                turnDurationInput.value =
                    lobbyManager.turnDurationSeconds > 0
                        ? String(lobbyManager.turnDurationSeconds)
                        : '0';
                return;
            }

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                if (window.ShapeKeeperConvex) {
                    const result = await window.ShapeKeeperConvex.updateTurnDuration(seconds);
                    if (result.error) {
                        showToast('Error: ' + result.error, 'error');
                        return;
                    }
                    lobbyManager.turnDurationSeconds = seconds;
                    showToast(
                        seconds === 0
                            ? 'Allowed Time: no limit'
                            : `Allowed Time: ${seconds}s per turn`,
                        'success',
                        2000
                    );
                } else {
                    lobbyManager.turnDurationSeconds = seconds;
                }
                updateLobbyUI();
            }, 300);
        });
    }

    document.getElementById('playerName').addEventListener('input', async (event) => {
        const { lobbyManager } = getState();
        const newName = event.target.value.trim() || 'Player';
        lobbyManager.updateMyName(newName);

        if (window.ShapeKeeperConvex) {
            await window.ShapeKeeperConvex.updatePlayer({ name: newName });
        }
        updateLobbyUI();
    });

    document.getElementById('playerColor').addEventListener('input', async (event) => {
        const { lobbyManager } = getState();
        const newColor = event.target.value;
        lobbyManager.updateMyColor(newColor);

        if (window.ShapeKeeperConvex) {
            await window.ShapeKeeperConvex.updatePlayer({ color: newColor });
        }
        updateLobbyUI();
    });

    document.getElementById('readyBtn').addEventListener('click', async () => {
        const { lobbyManager } = getState();
        const readyButton = document.getElementById('readyBtn');

        if (window.ShapeKeeperConvex) {
            const result = await window.ShapeKeeperConvex.toggleReady();
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }
            readyButton.textContent = result.isReady ? 'Ready ✓' : 'Ready';
            readyButton.classList.toggle('is-ready', result.isReady);
            readyButton.setAttribute('aria-pressed', String(result.isReady));
            return;
        }

        const isReady = lobbyManager.toggleReady();
        readyButton.textContent = isReady ? 'Ready ✓' : 'Ready';
        readyButton.classList.toggle('is-ready', isReady);
        readyButton.setAttribute('aria-pressed', String(isReady));
        updateLobbyUI();
    });

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

    document.getElementById('playAgain').addEventListener('click', () => {
        const { welcomeAnimation } = getState();
        showScreen('mainMenuScreen');
        setActiveGame(null);
        resetStartupState();

        if (welcomeAnimation) {
            welcomeAnimation.moveBackToMainMenu();
        }
    });
}
