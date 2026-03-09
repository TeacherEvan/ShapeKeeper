/**
 * Menu navigation and event handlers for ShapeKeeper
 * @module ui/MenuNavigation
 */

import { DotsAndBoxesGame } from '../../dots-and-boxes-game.js';
import { exitFullscreen, requestFullscreen } from './Fullscreen.js';
import {
    STARTUP_COPY,
    STARTUP_STATES,
    createMultiplayerStartupController,
} from './MultiplayerStartup.js';
import {
    getSelectedGridSize,
    isFullscreenTriggered,
    setFullscreenTriggered,
    setSelectedGridSize,
    showScreen,
} from './ScreenTransition.js';
import { toggleTheme } from './ThemeManager.js';
import { showToast } from './Toast.js';

const configuredStartupTimeoutMs = Number(globalThis.window?.__SHAPEKEEPER_STARTUP_TIMEOUT_MS);
const STARTUP_TIMEOUT_MS =
    Number.isFinite(configuredStartupTimeoutMs) && configuredStartupTimeoutMs > 0
        ? configuredStartupTimeoutMs
        : 8000;

const multiplayerStartup = createMultiplayerStartupController({
    timeoutMs: STARTUP_TIMEOUT_MS,
    onTimeout: () => {
        console.warn('[Startup] Timed out waiting for first authoritative state');
        if (game?.uiManager) {
            game.uiManager.displayLoadingSkeleton(true);
        }
        setStartupState(STARTUP_STATES.FATAL_STARTUP_FAILURE, { showActions: true });
    },
});

let roomSubscriptionCleanup = null;
let gameStateSubscriptionCleanup = null;
let connectionStateCleanup = null;

function getStartupOverlayElements() {
    return {
        skeleton: document.getElementById('gameLoadingSkeleton'),
        message: document.getElementById('gameLoadingMessage'),
        hint: document.getElementById('gameLoadingHint'),
        actions: document.getElementById('gameLoadingActions'),
        retryButton: document.getElementById('retryGameStartup'),
        leaveButton: document.getElementById('leaveFailedStartup'),
    };
}

function updateStartupOverlay({
    visible,
    state = multiplayerStartup.getSnapshot().phase,
    message,
    hint,
    showActions = false,
}) {
    const { skeleton, message: messageEl, hint: hintEl, actions } = getStartupOverlayElements();

    if (!skeleton) {
        return;
    }

    skeleton.classList.toggle('hidden', !visible);
    skeleton.dataset.state = state;
    skeleton.dataset.startupPhase = state;

    if (messageEl) {
        messageEl.textContent = message;
    }

    if (hintEl) {
        hintEl.textContent = hint;
    }

    if (actions) {
        actions.hidden = !showActions;
    }
}

function setStartupState(nextState, overrides = {}) {
    const { previousPhase } = multiplayerStartup.setPhase(nextState);
    const snapshot = multiplayerStartup.getSnapshot();

    const copy = STARTUP_COPY[nextState] || STARTUP_COPY[STARTUP_STATES.IDLE] || {};
    const message = overrides.message || copy.message || 'Preparing match...';
    const hint = overrides.hint || copy.hint || '';
    const showActions = overrides.showActions || false;
    const visible =
        overrides.visible ??
        (nextState !== STARTUP_STATES.IDLE && nextState !== STARTUP_STATES.IN_MATCH);

    console.log('[Startup]', `${previousPhase} → ${nextState}`, {
        retryCount: snapshot.retryCount,
        firstAuthoritativeStateReceived: snapshot.firstAuthoritativeStateReceived,
    });

    updateStartupOverlay({
        visible,
        state: nextState,
        message,
        hint,
        showActions,
    });
}

function setActiveGame(nextGame) {
    game = nextGame;
    setMenuNavigationDependencies({
        lobbyManager,
        welcomeAnimation,
        game,
    });
}

function replaceSubscription(currentCleanup, nextCleanup) {
    currentCleanup?.();
    return nextCleanup || null;
}

function subscribeToRoomUpdates() {
    if (!window.ShapeKeeperConvex?.subscribeToRoom) {
        return;
    }

    roomSubscriptionCleanup = replaceSubscription(
        roomSubscriptionCleanup,
        window.ShapeKeeperConvex.subscribeToRoom(handleRoomUpdate)
    );
}

function subscribeToGameUpdates() {
    if (!window.ShapeKeeperConvex?.subscribeToGameState) {
        return;
    }

    gameStateSubscriptionCleanup = replaceSubscription(
        gameStateSubscriptionCleanup,
        window.ShapeKeeperConvex.subscribeToGameState(handleGameStateUpdate)
    );
}

function clearSubscriptions({ room = false, gameState = false } = {}) {
    if (room) {
        roomSubscriptionCleanup?.();
        roomSubscriptionCleanup = null;
    }

    if (gameState) {
        gameStateSubscriptionCleanup?.();
        gameStateSubscriptionCleanup = null;
    }
}

function hasActiveMultiplayerSession() {
    return Boolean(
        game?.isMultiplayer ||
        multiplayerStartup.getSnapshot().lastRoomState?.status === 'playing' ||
        window.ShapeKeeperConvex?.getCurrentRoomId?.()
    );
}

function ensureConnectionStateMonitoring() {
    if (connectionStateCleanup || !window.ShapeKeeperConvex?.onConnectionStateChange) {
        return;
    }

    connectionStateCleanup = window.ShapeKeeperConvex.onConnectionStateChange(
        async (newState, oldState) => {
            if (newState === oldState || !hasActiveMultiplayerSession()) {
                return;
            }

            const { phase } = multiplayerStartup.getSnapshot();

            if (newState === 'reconnecting') {
                game?.uiManager?.displayLoadingSkeleton(true);
                setStartupState(STARTUP_STATES.RECONNECTING);
                return;
            }

            if (newState === 'disconnected' && phase === STARTUP_STATES.IN_MATCH) {
                game?.uiManager?.displayLoadingSkeleton(true);
                setStartupState(STARTUP_STATES.DESYNCED, {
                    visible: true,
                    hint: 'Connection dropped. Waiting to recover the live board state.',
                });
                return;
            }

            if (
                newState === 'connected' &&
                (phase === STARTUP_STATES.RECONNECTING || phase === STARTUP_STATES.DESYNCED)
            ) {
                await retryGameStartupSync('connection-recovered');
            }
        }
    );
}

function resetStartupState({ preserveLastRoomState = false } = {}) {
    multiplayerStartup.reset({ preserveLastRoomState });

    setStartupState(STARTUP_STATES.IDLE, {
        visible: false,
        message: 'Preparing live match...',
        hint: 'Waiting for the first authoritative board state.',
    });
}

async function primeAuthoritativeGameState(reason = 'startup') {
    if (!window.ShapeKeeperConvex?.getGameState) {
        return;
    }

    try {
        console.log('[Startup] Requesting authoritative game snapshot', { reason });
        const snapshot = await window.ShapeKeeperConvex.getGameState();
        if (snapshot) {
            handleGameStateUpdate(snapshot);
        }
    } catch (error) {
        console.error('[Startup] Failed to fetch authoritative game snapshot:', error);
    }
}

async function teardownMultiplayerSession({
    leaveRoom = false,
    targetScreen = 'mainMenuScreen',
    preserveLastRoomState = false,
} = {}) {
    multiplayerStartup.clearAwaitingTimeout();
    clearSubscriptions({ room: true, gameState: true });

    if (
        leaveRoom &&
        window.ShapeKeeperConvex?.leaveRoom &&
        window.ShapeKeeperConvex.getCurrentRoomId()
    ) {
        await window.ShapeKeeperConvex.leaveRoom();
    }

    lobbyManager.leaveRoom();
    setActiveGame(null);
    resetStartupState({ preserveLastRoomState });
    showScreen(targetScreen);

    if (welcomeAnimation) {
        welcomeAnimation.moveBackToMainMenu();
    }
}

function initializeMultiplayerGame(roomState) {
    multiplayerStartup.beginGameShell(roomState);

    setStartupState(STARTUP_STATES.INITIALIZING_GAME_SHELL);

    if (welcomeAnimation) {
        welcomeAnimation.moveToGameScreen();
    }

    showScreen('gameScreen');
    requestFullscreen();

    // Get player colors from room state (sorted by playerIndex)
    const sortedPlayers = [...roomState.players].sort((a, b) => a.playerIndex - b.playerIndex);
    const player1Color = sortedPlayers[0]?.color || '#FF0000';
    const player2Color = sortedPlayers[1]?.color || '#0000FF';

    // Find my player in the room
    const mySessionId = window.ShapeKeeperConvex?.getSessionId();
    const meInRoom = roomState.players.find((p) => p.sessionId === mySessionId);

    // Initialize game with room settings and multiplayer mode.
    const partyModeEnabled = roomState.partyMode !== false;
    const multiplayerGame = new DotsAndBoxesGame(roomState.gridSize, player1Color, player2Color, {
        partyModeEnabled,
        deferInitialReady: true,
    });
    multiplayerGame.isMultiplayer = true;
    multiplayerGame.myPlayerNumber = (meInRoom?.playerIndex ?? 0) + 1;
    multiplayerGame.isHost = roomState.hostPlayerId === mySessionId;
    setActiveGame(multiplayerGame);
    game.uiManager.displayLoadingSkeleton(true);

    console.log('[Startup] Game shell initialized', {
        myPlayerNumber: game.myPlayerNumber,
        isHost: game.isHost,
        roomCode: roomState.roomCode,
    });

    setStartupState(STARTUP_STATES.AWAITING_FIRST_AUTHORITATIVE_STATE);
    multiplayerStartup.startAwaitingFirstState();

    subscribeToGameUpdates();
    primeAuthoritativeGameState('room-playing-transition');
}

async function retryGameStartupSync(reason = 'manual-retry') {
    if (!multiplayerStartup.getSnapshot().lastRoomState || !window.ShapeKeeperConvex) {
        return;
    }

    multiplayerStartup.markRetry();

    setStartupState(STARTUP_STATES.RECONNECTING);

    if (game?.uiManager) {
        game.uiManager.displayLoadingSkeleton(true);
    }

    subscribeToGameUpdates();
    const { retryCount } = multiplayerStartup.getSnapshot();
    setStartupState(STARTUP_STATES.AWAITING_FIRST_AUTHORITATIVE_STATE, {
        hint: `Retry attempt ${retryCount}. Waiting for the latest board state.`,
    });
    multiplayerStartup.startAwaitingFirstState();
    await primeAuthoritativeGameState(reason);
}

async function leaveFailedStartup() {
    await teardownMultiplayerSession({ leaveRoom: true });
    showToast('Left multiplayer match.', 'info', 2000);
}

/**
 * Handle room state updates from Convex subscription
 * This function is called whenever the room state changes on the server
 * @param {Object} roomState - Current room state from Convex
 */
export function handleRoomUpdate(roomState) {
    if (!roomState) {
        // Room was deleted or doesn't exist
        resetStartupState();
        clearSubscriptions({ room: true, gameState: true });
        setActiveGame(null);
        showToast('Room no longer exists', 'warning');
        lobbyManager.leaveRoom();
        showScreen('mainMenuScreen');
        return;
    }

    multiplayerStartup.setLastRoomState(roomState);

    // Update local lobby manager state from server
    lobbyManager.roomCode = roomState.roomCode;
    lobbyManager.gridSize = roomState.gridSize;

    // Get my session ID
    const mySessionId = window.ShapeKeeperConvex?.getSessionId();

    // Check if I'm the host (hostPlayerId is on room, not player)
    lobbyManager.isHost = roomState.hostPlayerId === mySessionId;

    // Find my player ID
    const myPlayer = roomState.players.find((p) => p.sessionId === mySessionId);
    lobbyManager.myPlayerId = myPlayer?._id || null;
    lobbyManager.isReady = myPlayer?.isReady || false;

    // Update players list with server data
    // Add isHost by comparing sessionId with room's hostPlayerId
    lobbyManager.players = roomState.players.map((p, index) => ({
        id: p._id,
        name: p.name,
        color: p.color,
        isReady: p.isReady,
        isHost: p.sessionId === roomState.hostPlayerId,
        playerNumber: p.playerNumber || index + 1,
    }));

    // Update party mode toggle to match room state
    const lobbyPartyModeToggle = document.getElementById('lobbyPartyModeToggle');
    if (lobbyPartyModeToggle) {
        lobbyPartyModeToggle.checked = roomState.partyMode !== false;
        // Disable for non-hosts
        lobbyPartyModeToggle.disabled = !lobbyManager.isHost;
    }

    // Update grid size selection UI
    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.classList.toggle('selected', parseInt(btn.dataset.size) === roomState.gridSize);
    });

    // Update ready button state
    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.textContent = lobbyManager.isReady ? 'Ready ✓' : 'Ready';
        readyBtn.classList.toggle('is-ready', lobbyManager.isReady);
    }

    // Check if game has started
    if (roomState.status === 'playing') {
        if (
            multiplayerStartup.getSnapshot().phase !== STARTUP_STATES.IN_MATCH &&
            !multiplayerStartup.getSnapshot().startupBeganAt
        ) {
            initializeMultiplayerGame(roomState);
        }
        return;
    }

    if (roomState.status === 'lobby') {
        if (lobbyManager.canStartGame()) {
            setStartupState(STARTUP_STATES.ROOM_READY_TO_START, { visible: false });
        } else if (multiplayerStartup.getSnapshot().phase !== STARTUP_STATES.IDLE) {
            setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });
        }
    }

    // Update UI if still in lobby
    updateLobbyUI();
}

/**
 * Handle game state updates from Convex subscription
 * This function is called whenever the game state changes on the server
 * @param {Object} gameState - Current game state from Convex
 */
export function handleGameStateUpdate(gameState) {
    if (!gameState || !game) return;

    const firstStateResult = multiplayerStartup.markFirstAuthoritativeState();
    const { isFirstAuthoritativeState } = firstStateResult;
    if (isFirstAuthoritativeState) {
        console.log('[Startup] First authoritative game state received', {
            startupDurationMs: firstStateResult.startupDurationMs,
            retryCount: firstStateResult.retryCount,
        });
    }

    // Update current player turn (server uses 0-based index, game uses 1-based player number)
    // currentPlayerIndex 0 = Player 1, currentPlayerIndex 1 = Player 2
    // Use ?? instead of || because 0 is a valid value
    const serverPlayerIndex = gameState.room?.currentPlayerIndex ?? 0;
    game.currentPlayer = serverPlayerIndex + 1;

    console.log(
        '[Game] State update - currentPlayerIndex:',
        serverPlayerIndex,
        'currentPlayer:',
        game.currentPlayer,
        'myPlayerNumber:',
        game.myPlayerNumber,
        'isMyTurn:',
        game.currentPlayer === game.myPlayerNumber
    );

    // Sync lines from server
    gameState.lines.forEach((line) => {
        if (!game.lines.has(line.lineKey)) {
            game.lines.add(line.lineKey);

            // Handle populate lines (playerIndex 2 = populate player)
            // playerIndex is 0-based for players, but 2 is special for populate
            let displayPlayerIndex;
            if (line.playerIndex === 2) {
                // Populate line - use special populate player ID
                displayPlayerIndex = DotsAndBoxesGame.POPULATE_PLAYER_ID;
            } else {
                // Regular player line - convert to 1-based player number
                displayPlayerIndex = line.playerIndex + 1;
            }

            game.lineOwners.set(line.lineKey, displayPlayerIndex);

            // Add line draw animation
            const [startDot, endDot] = game.parseLineKey(line.lineKey);
            game.lineDrawings.push({
                lineKey: line.lineKey,
                startDot,
                endDot,
                player: displayPlayerIndex,
                startTime: Date.now(),
                duration: DotsAndBoxesGame.ANIMATION_LINE_DRAW_DURATION,
            });

            // Add pulsating effect for new lines
            game.pulsatingLines.push({
                line: line.lineKey,
                player: displayPlayerIndex,
                time: Date.now(),
            });

            // Play line sound
            game.playLineSound();
        }
    });

    // Sync squares from server
    gameState.squares.forEach((square) => {
        const key = square.squareKey;
        if (!game.squares[key]) {
            // playerIndex is 0-based, convert to 1-based player number
            game.squares[key] = square.playerIndex + 1;

            // Sync multiplier from server (generated server-side)
            if (square.multiplier) {
                game.squareMultipliers[key] = {
                    type: square.multiplier.type,
                    value: square.multiplier.value,
                };
            }

            // Trigger the square animation (which handles particles and kiss emojis)
            game.triggerSquareAnimation(key);

            // Play square sound
            game.playSquareSound(game.comboCount);
        }
    });

    // Update scores from players array (playerIndex 0 = Player 1, playerIndex 1 = Player 2)
    const p1 = gameState.players?.find((p) => p.playerIndex === 0);
    const p2 = gameState.players?.find((p) => p.playerIndex === 1);
    game.scores[1] = p1?.score || 0;
    game.scores[2] = p2?.score || 0;

    // Update populate button visibility (host-only in multiplayer)
    game.uiManager.updatePopulateButtonVisibility();

    // Check for game over
    if (gameState.room?.status === 'finished' && !game.isGameOver) {
        game.isGameOver = true;
        game.showWinner();
    }

    // Redraw and update UI
    game.draw();
    game.uiManager.updateUI();

    if (isFirstAuthoritativeState) {
        game.uiManager.displayLoadingSkeleton(false);
        setStartupState(STARTUP_STATES.IN_MATCH, { visible: false });
        showToast('Live match synchronized!', 'success', 2000);
    }
}

/**
 * Initialize all menu navigation and event listeners
 */
export function initializeMenuNavigation() {
    ensureConnectionStateMonitoring();

    // ========================================
    // Theme Toggle
    // ========================================

    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

    // ========================================
    // Main Menu Navigation
    // ========================================

    // Create Game button
    document.getElementById('createGameBtn').addEventListener('click', async () => {
        const playerName = document.getElementById('playerName')?.value || 'Host';
        const gridSize = lobbyManager.gridSize || 5;

        // Use Convex backend if available
        if (window.ShapeKeeperConvex) {
            setStartupState(STARTUP_STATES.CREATING_OR_JOINING_ROOM, { visible: false });
            showToast('Creating room...', 'info', 2000);
            const partyMode = true; // Default to true, will be controlled in lobby
            const result = await window.ShapeKeeperConvex.createRoom(
                playerName,
                gridSize,
                partyMode
            );

            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }

            // Subscribe to room updates
            subscribeToRoomUpdates();
            setStartupState(STARTUP_STATES.ROOM_SUBSCRIBED, { visible: false });

            lobbyManager.roomCode = result.roomCode;
            lobbyManager.isHost = true;
            showToast('Room created: ' + result.roomCode, 'success', 3000);
        } else {
            // Fallback to local lobby manager
            lobbyManager.createRoom(playerName);
        }

        updateLobbyUI();
        showScreen('lobbyScreen');
    });

    // Join Game button
    document.getElementById('joinGameBtn').addEventListener('click', () => {
        showScreen('joinScreen');
    });

    // Local Play button
    document.getElementById('localPlayBtn').addEventListener('click', () => {
        showScreen('localSetupScreen');
    });

    // ========================================
    // Local Setup Screen
    // ========================================

    // Local grid size selection
    document.querySelectorAll('.local-grid-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document
                .querySelectorAll('.local-grid-btn')
                .forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            setSelectedGridSize(parseInt(btn.dataset.size));
            document.getElementById('startLocalGame').disabled = false;

            if (!isFullscreenTriggered()) {
                setFullscreenTriggered(true);
                requestFullscreen();
            }
        });
    });

    // Back from local setup
    document.getElementById('backToMenuFromLocal').addEventListener('click', () => {
        showScreen('mainMenuScreen');
    });

    // Start local game
    document.getElementById('startLocalGame').addEventListener('click', () => {
        const player1Color = document.getElementById('player1Color').value;
        const player2Color = document.getElementById('player2Color').value;
        const partyModeEnabled = document.getElementById('partyModeToggle').checked;

        if (welcomeAnimation) {
            welcomeAnimation.moveToGameScreen();
        }

        showScreen('gameScreen');
        requestFullscreen();

        game = new DotsAndBoxesGame(getSelectedGridSize(), player1Color, player2Color, {
            partyModeEnabled,
        });
    });

    // ========================================
    // Join Screen
    // ========================================

    // Room code input validation
    const joinRoomCodeInput = document.getElementById('joinRoomCode');
    const joinPlayerNameInput = document.getElementById('joinPlayerName');
    const joinRoomBtn = document.getElementById('joinRoomBtn');

    function validateJoinInputs() {
        const codeValid = joinRoomCodeInput.value.length === 6;
        const nameValid = joinPlayerNameInput.value.trim().length > 0;
        joinRoomBtn.disabled = !(codeValid && nameValid);
    }

    joinRoomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        validateJoinInputs();
    });

    joinPlayerNameInput.addEventListener('input', validateJoinInputs);

    // Back from join screen
    document.getElementById('backToMenuFromJoin').addEventListener('click', () => {
        showScreen('mainMenuScreen');
    });

    // Join room button
    joinRoomBtn.addEventListener('click', async () => {
        const roomCode = joinRoomCodeInput.value;
        const playerName = joinPlayerNameInput.value.trim();

        // Use Convex backend if available
        if (window.ShapeKeeperConvex) {
            setStartupState(STARTUP_STATES.CREATING_OR_JOINING_ROOM, { visible: false });
            showToast('Joining room...', 'info', 2000);
            const result = await window.ShapeKeeperConvex.joinRoom(roomCode, playerName);

            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }

            // Subscribe to room updates
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

    // ========================================
    // Lobby Screen
    // ========================================

    // Lobby grid size selection
    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!lobbyManager.isHost) return; // Only host can change

            const newSize = parseInt(btn.dataset.size);

            // Use Convex backend if available
            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.updateGridSize(newSize);
                if (result.error) {
                    showToast('Error: ' + result.error, 'error');
                    return;
                }
                // UI will update via subscription
            } else {
                document
                    .querySelectorAll('.lobby-grid-btn')
                    .forEach((b) => b.classList.remove('selected'));
                btn.classList.add('selected');
                lobbyManager.setGridSize(newSize);
            }
        });
    });

    // Lobby party mode toggle (host only)
    const lobbyPartyModeToggle = document.getElementById('lobbyPartyModeToggle');
    if (lobbyPartyModeToggle) {
        lobbyPartyModeToggle.addEventListener('change', async (e) => {
            if (!lobbyManager.isHost) {
                // Revert change if not host
                e.target.checked = !e.target.checked;
                showToast('Only the host can change game settings', 'warning', 2000);
                return;
            }

            const partyMode = e.target.checked;

            // Use Convex backend if available
            if (window.ShapeKeeperConvex) {
                const result = await window.ShapeKeeperConvex.updatePartyMode(partyMode);
                if (result.error) {
                    showToast('Error: ' + result.error, 'error');
                    // Revert on error
                    e.target.checked = !partyMode;
                    return;
                }
                showToast(`Party Mode ${partyMode ? 'enabled' : 'disabled'}`, 'success', 2000);
                // UI will update via subscription
            } else {
                lobbyManager.partyMode = partyMode;
                showToast(`Party Mode ${partyMode ? 'enabled' : 'disabled'}`, 'info', 2000);
            }
        });
    }

    // Copy room code
    document.getElementById('copyCodeBtn').addEventListener('click', () => {
        const code = document.getElementById('roomCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('copyCodeBtn');
            btn.textContent = '✓';
            btn.classList.add('copied');
            showToast('Room code copied to clipboard!', 'success', 2000);
            setTimeout(() => {
                btn.textContent = '📋';
                btn.classList.remove('copied');
            }, 2000);
        });
    });

    // Player name input
    document.getElementById('playerName').addEventListener('input', async (e) => {
        const newName = e.target.value.trim() || 'Player';
        lobbyManager.updateMyName(newName);

        // Sync to Convex if available
        if (window.ShapeKeeperConvex) {
            await window.ShapeKeeperConvex.updatePlayer({ name: newName });
        }
        updateLobbyUI();
    });

    // Player color input
    document.getElementById('playerColor').addEventListener('input', async (e) => {
        const newColor = e.target.value;
        lobbyManager.updateMyColor(newColor);

        // Sync to Convex if available
        if (window.ShapeKeeperConvex) {
            await window.ShapeKeeperConvex.updatePlayer({ color: newColor });
        }
        updateLobbyUI();
    });

    // Ready button
    document.getElementById('readyBtn').addEventListener('click', async () => {
        if (window.ShapeKeeperConvex) {
            const result = await window.ShapeKeeperConvex.toggleReady();
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }
            const btn = document.getElementById('readyBtn');
            btn.textContent = result.isReady ? 'Ready ✓' : 'Ready';
            btn.classList.toggle('is-ready', result.isReady);
        } else {
            const isReady = lobbyManager.toggleReady();
            const btn = document.getElementById('readyBtn');
            btn.textContent = isReady ? 'Ready ✓' : 'Ready';
            btn.classList.toggle('is-ready', isReady);
            updateLobbyUI();
        }
    });

    // Start multiplayer game
    document.getElementById('startMultiplayerGame').addEventListener('click', async () => {
        if (window.ShapeKeeperConvex) {
            const result = await window.ShapeKeeperConvex.startGame();
            if (result.error) {
                showToast('Error: ' + result.error, 'error');
                return;
            }

            // Game will start via subscription update
            showToast('Starting game...', 'success', 2000);
        } else {
            if (!lobbyManager.canStartGame()) {
                showToast('All players must be ready to start!', 'warning');
                return;
            }
            showToast('Multiplayer game start requires backend integration.', 'info', 5000);
        }
    });

    // Leave lobby
    document.getElementById('leaveLobby').addEventListener('click', async () => {
        if (window.ShapeKeeperConvex) {
            await teardownMultiplayerSession({ leaveRoom: true });
        } else {
            lobbyManager.leaveRoom();
            resetStartupState();
            showScreen('mainMenuScreen');
        }
    });

    document.getElementById('retryGameStartup')?.addEventListener('click', () => {
        retryGameStartupSync();
    });

    document.getElementById('leaveFailedStartup')?.addEventListener('click', () => {
        leaveFailedStartup();
    });

    // ========================================
    // Game Screen
    // ========================================

    // Exit game
    document.getElementById('exitGame').addEventListener('click', async () => {
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

    // ========================================
    // Winner Screen
    // ========================================

    // Play again
    document.getElementById('playAgain').addEventListener('click', () => {
        showScreen('mainMenuScreen');
        setActiveGame(null);
        resetStartupState();

        if (welcomeAnimation) {
            welcomeAnimation.moveBackToMainMenu();
        }
    });
}

/**
 * Update lobby UI with current state
 */
export function updateLobbyUI() {
    // Update room code
    document.getElementById('roomCode').textContent = lobbyManager.roomCode || '------';

    // Update player count
    document.getElementById('playerCount').textContent = lobbyManager.getPlayerCount();

    // Update players list
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';

    lobbyManager.players.forEach((player) => {
        const entry = document.createElement('div');
        entry.className = 'player-entry';
        if (player.isReady) entry.classList.add('ready');
        if (player.isHost) entry.classList.add('host');

        entry.innerHTML = `
            <div class="player-color-dot" style="background-color: ${player.color}"></div>
            <span class="player-entry-name">${player.name}</span>
            ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
            <span class="player-entry-status">${player.isReady ? '✓ Ready' : 'Not Ready'}</span>
        `;

        playersList.appendChild(entry);
    });

    // Update start button state
    document.getElementById('startMultiplayerGame').disabled = !lobbyManager.canStartGame();

    // Disable grid selection for non-hosts
    document.querySelectorAll('.lobby-grid-btn').forEach((btn) => {
        btn.disabled = !lobbyManager.isHost;
        btn.style.opacity = lobbyManager.isHost ? '1' : '0.5';
    });
}

// Import dependencies (these will be set externally)
let lobbyManager;
let welcomeAnimation;
let game;

/**
 * Set dependencies for menu navigation
 * @param {Object} deps - Dependencies object
 */
export function setMenuNavigationDependencies(deps) {
    lobbyManager = deps.lobbyManager;
    welcomeAnimation = deps.welcomeAnimation;
    game = deps.game;
}
