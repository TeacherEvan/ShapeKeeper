/**
 * Screen-specific event binding helpers for the menu runtime.
 */

import { DotsAndBoxesGame } from '../../../dots-and-boxes-game.js';
import { exitFullscreen, requestFullscreen } from '../Fullscreen.js';
import {
    getSelectedGridSize,
    isFullscreenTriggered,
    setFullscreenTriggered,
    setSelectedGridSize,
    showScreen,
} from '../ScreenTransition.js';
import { toggleTheme } from '../ThemeManager.js';
import { showToast } from '../Toast.js';

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
            const result = await window.ShapeKeeperConvex.createRoom(playerName, gridSize, true);

            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }

            subscribeToRoomUpdates();
            setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });

            lobbyManager.roomCode = result.roomCode;
            lobbyManager.isHost = true;
            showToast('Room created: ' + result.roomCode, 'success', 3000);
        } else {
            lobbyManager.createRoom(playerName);
        }

        updateLobbyUI();
        showScreen('lobbyScreen');
    });

    document.getElementById('joinGameBtn').addEventListener('click', () => {
        showScreen('joinScreen');
    });

    document.getElementById('localPlayBtn').addEventListener('click', () => {
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
        const partyModeEnabled = document.getElementById('partyModeToggle').checked;

        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }

        showScreen('gameScreen');
        requestFullscreen();

        setActiveGame(
            new DotsAndBoxesGame(getSelectedGridSize(), player1Color, player2Color, {
                partyModeEnabled,
            })
        );
    });

    const joinRoomCodeInput = document.getElementById('joinRoomCode');
    const joinPlayerNameInput = document.getElementById('joinPlayerName');
    const joinRoomBtn = document.getElementById('joinRoomBtn');

    function validateJoinInputs() {
        const codeValid = joinRoomCodeInput.value.length === 6;
        const nameValid = joinPlayerNameInput.value.trim().length > 0;
        joinRoomBtn.disabled = !(codeValid && nameValid);
    }

    joinRoomCodeInput.addEventListener('input', (event) => {
        event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        validateJoinInputs();
    });

    joinPlayerNameInput.addEventListener('input', validateJoinInputs);

    document.getElementById('backToMenuFromJoin').addEventListener('click', () => {
        showScreen('mainMenuScreen');
    });

    joinRoomBtn.addEventListener('click', async () => {
        const { lobbyManager } = getState();
        const roomCode = joinRoomCodeInput.value;
        const playerName = joinPlayerNameInput.value.trim();

        if (window.ShapeKeeperConvex) {
            setStartupState(STARTUP_STATES.CREATING_OR_JOINING_ROOM, { visible: false });
            showToast('Joining room...', 'info', 2000);
            const result = await window.ShapeKeeperConvex.joinRoom(roomCode, playerName);

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

    const lobbyPartyModeToggle = document.getElementById('lobbyPartyModeToggle');
    if (lobbyPartyModeToggle) {
        lobbyPartyModeToggle.addEventListener('change', async (event) => {
            const { lobbyManager } = getState();
            if (!lobbyManager.isHost) {
                event.target.checked = !event.target.checked;
                showToast('Only the host can change game settings', 'warning', 2000);
                return;
            }

            const partyMode = event.target.checked;

            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.updatePartyMode(partyMode);
                if (result.error) {
                    showToast('Error: ' + result.error, 'error');
                    event.target.checked = !partyMode;
                    return;
                }
                showToast(`Party Mode ${partyMode ? 'enabled' : 'disabled'}`, 'success', 2000);
                return;
            }

            lobbyManager.partyMode = partyMode;
            showToast(`Party Mode ${partyMode ? 'enabled' : 'disabled'}`, 'info', 2000);
        });
    }

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
