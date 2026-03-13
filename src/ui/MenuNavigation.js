/**
 * Menu navigation and event handlers for ShapeKeeper
 * @module ui/MenuNavigation
 */

import { DotsAndBoxesGame } from '../../dots-and-boxes-game.js';
import { announceAlert, announceStatus } from './AccessibilityAnnouncer.js';
import { requestFullscreen } from './Fullscreen.js';
import { bindMenuEventHandlers } from './menu/eventBindings.js';
import { updateLobbyUI as renderLobbyUI } from './menu/lobbyView.js';
import { handleAuthoritativeGameState, handleRoomStateUpdate } from './menu/syncHandlers.js';
import {
    STARTUP_COPY,
    STARTUP_STATES,
    createMultiplayerStartupController,
} from './MultiplayerStartup.js';
import { showScreen } from './ScreenTransition.js';
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

    if (visible) {
        const announcement = [message, hint].filter(Boolean).join(' ');
        if (
            nextState === STARTUP_STATES.FATAL_STARTUP_FAILURE ||
            nextState === STARTUP_STATES.DESYNCED
        ) {
            announceAlert(announcement);
        } else {
            announceStatus(announcement);
        }
    }
}

function setActiveGame(nextGame) {
    game = nextGame;
    window.__shapeKeeperActiveGame = nextGame;
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
    refreshConnectionStateMonitoring();

    if (!window.ShapeKeeperConvex?.subscribeToRoom) {
        return;
    }

    roomSubscriptionCleanup = replaceSubscription(
        roomSubscriptionCleanup,
        window.ShapeKeeperConvex.subscribeToRoom(handleRoomUpdate)
    );
}

function subscribeToGameUpdates() {
    refreshConnectionStateMonitoring();

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

function refreshConnectionStateMonitoring() {
    connectionStateCleanup?.();
    connectionStateCleanup = null;
    ensureConnectionStateMonitoring();
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

    const { retryCount } = multiplayerStartup.getSnapshot();
    setStartupState(STARTUP_STATES.AWAITING_FIRST_AUTHORITATIVE_STATE, {
        hint: `Retry attempt ${retryCount}. Waiting for the latest board state.`,
    });
    multiplayerStartup.startAwaitingFirstState();
    subscribeToGameUpdates();
    await primeAuthoritativeGameState(reason);
}

async function leaveFailedStartup() {
    await teardownMultiplayerSession({ leaveRoom: true });
    showToast('Left multiplayer match.', 'info', 2000);
}

function getMenuState() {
    return {
        lobbyManager,
        welcomeAnimation,
        game,
    };
}

/**
 * Handle room state updates from Convex subscription
 * This function is called whenever the room state changes on the server
 * @param {Object} roomState - Current room state from Convex
 */
export function handleRoomUpdate(roomState) {
    handleRoomStateUpdate(roomState, {
        multiplayerStartup,
        STARTUP_STATES,
        lobbyManager,
        getGame: () => game,
        initializeMultiplayerGame,
        setStartupState,
        updateLobbyUI,
        clearSubscriptions,
        resetStartupState,
        setActiveGame,
        showScreen,
        showToast,
    });
}

/**
 * Handle game state updates from Convex subscription
 * This function is called whenever the game state changes on the server
 * @param {Object} gameState - Current game state from Convex
 */
export function handleGameStateUpdate(gameState) {
    handleAuthoritativeGameState(gameState, {
        multiplayerStartup,
        STARTUP_STATES,
        getGame: () => game,
        setStartupState,
        showToast,
    });
}

/**
 * Initialize all menu navigation and event listeners
 */
export function initializeMenuNavigation() {
    ensureConnectionStateMonitoring();
    bindMenuEventHandlers({
        getState: getMenuState,
        setActiveGame,
        setStartupState,
        STARTUP_STATES,
        subscribeToRoomUpdates,
        updateLobbyUI,
        teardownMultiplayerSession,
        resetStartupState,
        retryGameStartupSync,
        leaveFailedStartup,
    });
}

/**
 * Update lobby UI with current state
 */
export function updateLobbyUI() {
    renderLobbyUI(lobbyManager);
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
