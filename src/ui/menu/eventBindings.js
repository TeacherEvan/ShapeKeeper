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
    });
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
            lobbyManager.passcode = result.passcode || null;
            lobbyManager.isHost = true;
            const passcodeSuffix = result.passcode ? ` · Passcode: ${result.passcode}` : '';
            showToast(`Room ${result.roomCode} created${passcodeSuffix}`, 'success', 4000);
        } else {
            lobbyManager.createRoom(playerName);
        }

        updateLobbyUI();
        showScreen('lobbyScreen');
    });

    document.getElementById('joinGameBtn').addEventListener('click', () => {
        showScreen('joinScreen');
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

    const joinRoomCodeInput = document.getElementById('joinRoomCode');
    const joinRoomPasscodeInput = document.getElementById('joinRoomPasscode');
    const joinPlayerNameInput = document.getElementById('joinPlayerName');
    const joinRoomBtn = document.getElementById('joinRoomBtn');

    function validateJoinInputs() {
        const codeValid = joinRoomCodeInput.value.length === 6;
        const nameValid = joinPlayerNameInput.value.trim().length > 0;
        // Passcode is optional at the UI level — the server enforces it for
        // passcode-gated rooms. If the room has no passcode, the input can be
        // empty; if it has one, the server will reject an empty value.
        joinRoomBtn.disabled = !(codeValid && nameValid);
    }

    joinRoomCodeInput.addEventListener('input', (event) => {
        event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        validateJoinInputs();
    });

    joinPlayerNameInput.addEventListener('input', validateJoinInputs);
    if (joinRoomPasscodeInput) {
        joinRoomPasscodeInput.addEventListener('input', () => {
            // Passcode is Adjective+Animal TitleCase; allow letters only.
            joinRoomPasscodeInput.value = joinRoomPasscodeInput.value
                .replace(/[^A-Za-z]/g, '')
                .slice(0, 32);
            validateJoinInputs();
        });
    }

    document.getElementById('backToMenuFromJoin').addEventListener('click', () => {
        showScreen('mainMenuScreen');
    });

    joinRoomBtn.addEventListener('click', async () => {
        const { lobbyManager } = getState();
        const roomCode = joinRoomCodeInput.value;
        const playerName = joinPlayerNameInput.value.trim();
        const passcode = (joinRoomPasscodeInput?.value || '').trim();

        if (window.ShapeKeeperConvex) {
            setStartupState(STARTUP_STATES.CREATING_OR_JOINING_ROOM, { visible: false });
            showToast('Joining room...', 'info', 2000);
            const result = await window.ShapeKeeperConvex.joinRoom(roomCode, playerName, passcode);

            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }

            subscribeToRoomUpdates();
            setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });

            lobbyManager.roomCode = roomCode.toUpperCase();
            lobbyManager.isHost = false;
            showToast('Joined room: ' + roomCode.toUpperCase(), 'success', 3000);
            updateLobbyUI();
            showScreen('lobbyScreen');
        } else {
            showToast('Multiplayer mode requires backend integration.', 'info', 5000);
        }
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

    document.getElementById('copyCodeBtn').addEventListener('click', () => {
        const code = document.getElementById('roomCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const copyButton = document.getElementById('copyCodeBtn');
            copyButton.textContent = '✓';
            copyButton.classList.add('copied');
            showToast('Room code copied to clipboard!', 'success', 2000);
            setTimeout(() => {
                copyButton.textContent = '📋';
                copyButton.classList.remove('copied');
            }, 2000);
        });
    });

    /**
     * Copy Invite Link button. The URL is built by LiveLobbyManager
     * (or, for legacy lobbies, by the existing getState().lobbyManager) and
     * contains BOTH the room code and the passcode (if any). Falls back to a
     * manual-select input if `navigator.clipboard` is unavailable (e.g.
     * insecure context) so the user can always copy.
     */
    const copyInviteLinkBtn = document.getElementById('copyInviteLinkBtn');
    if (copyInviteLinkBtn) {
        copyInviteLinkBtn.addEventListener('click', () => {
            const { lobbyManager } = getState();
            // Prefer the LiveLobbyManager if it's been wired; otherwise build
            // a minimal URL from the existing legacy fields.
            let url = null;
            if (lobbyManager && typeof lobbyManager.buildInviteUrl === 'function') {
                url = lobbyManager.buildInviteUrl();
            } else if (lobbyManager && lobbyManager.roomCode) {
                const params = new URLSearchParams({ join: lobbyManager.roomCode });
                if (lobbyManager.passcode) params.set('passcode', lobbyManager.passcode);
                url = `${window.location.origin}/?${params.toString()}`;
            }
            if (!url) {
                showToast('Create or join a room first to get an invite link.', 'error');
                return;
            }

            const fallbackCopy = () => {
                // Insecure-context fallback: show a readonly input the user can
                // select and copy manually.
                const input = document.createElement('input');
                input.value = url;
                input.readOnly = true;
                input.style.position = 'fixed';
                input.style.opacity = '0';
                document.body.appendChild(input);
                input.select();
                try {
                    document.execCommand('copy');
                    showToast('Invite link copied (fallback).', 'success', 2000);
                } catch (_err) {
                    showToast('Copy failed. Select the link manually.', 'error');
                }
                document.body.removeChild(input);
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(
                    () => {
                        copyInviteLinkBtn.textContent = '✓ Copied';
                        copyInviteLinkBtn.classList.add('copied');
                        showToast('Invite link copied to clipboard!', 'success', 2000);
                        setTimeout(() => {
                            copyInviteLinkBtn.innerHTML = '🔗 Copy Invite Link';
                            copyInviteLinkBtn.classList.remove('copied');
                        }, 2000);
                    },
                    () => fallbackCopy()
                );
            } else {
                fallbackCopy();
            }
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
