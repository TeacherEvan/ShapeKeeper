/**
 * Convex Client Integration for ShapeKeeper
 * Handles real-time multiplayer communication with Convex backend
 *
 * This file uses the Convex browser bundle loaded via script tag.
 * The 'convex' global object is provided by: https://unpkg.com/convex@1.29.3/dist/browser.bundle.js
 *
 * @module ConvexClient
 * @version 4.3.0
 *
 * Connection pooling implemented for efficient resource management:
 * - Singleton client instance with lifecycle management
 * - Connection state tracking and monitoring
 * - Proper cleanup of subscriptions and resources
 * - Automatic reconnection handling
 *
 * TODO: [OPTIMIZATION] Add offline queue for actions when connection drops
 * TODO: [ARCHITECTURE] Consider implementing optimistic updates for immediate UI feedback
 * TODO: [ARCHITECTURE] Move to Redis for scalability in high-traffic scenarios
 * TODO: [SECURITY] Add rate limiting for mutations to prevent abuse
 */

'use strict';

// Get Convex URL from environment or use default
const CONVEX_URL = window.CONVEX_URL || 'https://oceanic-antelope-781.convex.cloud';

// Use the global convex object from the browser bundle
/** @type {import("convex/browser")["ConvexClient"]} */
const ConvexClient = window.convex ? window.convex.ConvexClient : null;

// Use anyApi for untyped function references
/** @type {import("convex/server")["anyApi"]} */
const api = window.convex ? window.convex.anyApi : null;

// Connection pooling: Singleton client instance
let convexClient = null;
let sessionId = null;
let currentRoomId = null;
let currentSubscription = null;
let gameStateSubscription = null;

// Connection state management
let connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
let connectionStateListeners = [];
let activeSubscriptions = new Set(); // Track all active subscriptions for cleanup

// Turn-based optimization: Track last state to detect changes
let lastGameState = null;
let lastRoomState = null;
let updateDebounceTimer = null;
const UPDATE_DEBOUNCE_MS = 50; // Debounce updates to batch rapid changes

// Error messages
const CONVEX_CONNECTION_ERROR = 'Convex backend not available. Please check your connection.';

/**
 * Set connection state and notify listeners
 * @private
 */
function setConnectionState(newState) {
    if (connectionState !== newState) {
        const oldState = connectionState;
        connectionState = newState;
        console.log(`[Convex] Connection state: ${oldState} → ${newState}`);
        connectionStateListeners.forEach((listener) => listener(newState, oldState));
    }
}

/**
 * Subscribe to connection state changes
 * @param {Function} callback - Called with (newState, oldState)
 * @returns {Function} Unsubscribe function
 */
function onConnectionStateChange(callback) {
    connectionStateListeners.push(callback);
    // Immediately call with current state
    callback(connectionState, connectionState);
    return () => {
        connectionStateListeners = connectionStateListeners.filter((l) => l !== callback);
    };
}

/**
 * Get current connection state
 * @returns {string} Current connection state
 */
function getConnectionState() {
    return connectionState;
}

/**
 * Check if game state has meaningfully changed (turn-based optimization)
 * Only triggers updates when key state fields change:
 * - currentPlayerIndex (turn changed)
 * - lines.length (new line drawn)
 * - squares.length (new square completed)
 * - room.status (game state changed)
 * - player scores
 * @param {Object} newState - New state from server
 * @param {Object} lastState - Previous cached state
 * @returns {boolean} True if state has meaningfully changed
 */
function stateHasChanged(newState, lastState) {
    // First update always processes (no cached state)
    if (!lastState) return true;
    // If new state is null but we had state before, that's a change (room deleted)
    if (!newState) return lastState !== null;

    // For turn-based optimization, check key state fields:
    // - currentPlayerIndex (turn changed)
    // - lines.length (new line drawn)
    // - squares.length (new square completed)
    // - room.status (game state changed)

    const newRoom = newState.room || {};
    const lastRoom = lastState.room || {};

    // Turn change detection
    if (newRoom.currentPlayerIndex !== lastRoom.currentPlayerIndex) return true;
    if (newRoom.status !== lastRoom.status) return true;
    if (newRoom.updatedAt !== lastRoom.updatedAt) return true;

    // Line/square count change detection (efficient for turn-based)
    const newLines = newState.lines || [];
    const lastLines = lastState.lines || [];
    if (newLines.length !== lastLines.length) return true;

    const newSquares = newState.squares || [];
    const lastSquares = lastState.squares || [];
    if (newSquares.length !== lastSquares.length) return true;

    // Score change detection
    const newPlayers = newState.players || [];
    const lastPlayers = lastState.players || [];
    if (newPlayers.length !== lastPlayers.length) return true;

    for (let i = 0; i < newPlayers.length; i++) {
        if (newPlayers[i]?.score !== lastPlayers[i]?.score) return true;
    }

    return false;
}

/**
 * Initialize the Convex client and session
 * Connection pooling: Reuses existing client instance if available
 */
function initConvex() {
    if (convexClient) {
        console.log('[Convex] Reusing existing client connection (pooling)');
        return convexClient;
    }

    if (!ConvexClient) {
        console.error(
            '[Convex] Browser bundle not loaded. Make sure convex browser bundle is included before this script.'
        );
        setConnectionState('disconnected');
        return null;
    }

    setConnectionState('connecting');

    try {
        convexClient = new ConvexClient(CONVEX_URL);

        // Generate or retrieve session ID
        sessionId = localStorage.getItem('shapekeeper_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('shapekeeper_session_id', sessionId);
        }

        setConnectionState('connected');
        console.log('[Convex] Client initialized with session:', sessionId);
        return convexClient;
    } catch (error) {
        console.error('[Convex] Failed to initialize client:', error);
        setConnectionState('disconnected');
        return null;
    }
}

/**
 * Get the current session ID
 */
function getSessionId() {
    if (!sessionId) {
        initConvex();
    }
    return sessionId;
}

/**
 * Create a new game room
 * @param {string} playerName - Name of the host player
 * @param {number} gridSize - Grid size (5, 10, 20, or 30)
 * @returns {Promise<{roomId: string, roomCode: string} | {error: string}>}
 */
async function createRoom(playerName, gridSize, partyMode = true) {
    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        const result = await convexClient.mutation(api.rooms.createRoom, {
            sessionId,
            playerName,
            gridSize,
            partyMode,
        });

        if (result.roomId) {
            currentRoomId = result.roomId;
            console.log('[Convex] Room created:', result.roomCode, 'partyMode:', partyMode);
        }

        return result;
    } catch (error) {
        console.error('[Convex] Error creating room:', error);
        return { error: error.message };
    }
}

/**
 * Join an existing room
 * @param {string} roomCode - 6-character room code
 * @param {string} playerName - Name of the joining player
 * @returns {Promise<{roomId: string, playerId: string} | {error: string}>}
 */
async function joinRoom(roomCode, playerName) {
    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        const result = await convexClient.mutation(api.rooms.joinRoom, {
            roomCode: roomCode.toUpperCase(),
            sessionId,
            playerName,
        });

        if (result.roomId) {
            currentRoomId = result.roomId;
            console.log('[Convex] Joined room:', roomCode);
        }

        return result;
    } catch (error) {
        console.error('[Convex] Error joining room:', error);
        return { error: error.message };
    }
}

/**
 * Leave the current room
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
async function leaveRoom() {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        const result = await convexClient.mutation(api.rooms.leaveRoom, {
            roomId: currentRoomId,
            sessionId,
        });

        // Clean up room-specific resources
        cleanupRoomResources();

        console.log('[Convex] Left room');

        return result;
    } catch (error) {
        console.error('[Convex] Error leaving room:', error);
        return { error: error.message };
    }
}

/**
 * Clean up room-specific resources (subscriptions, timers, state)
 * @private
 */
function cleanupRoomResources() {
    // Unsubscribe from updates
    if (currentSubscription) {
        currentSubscription();
        activeSubscriptions.delete(currentSubscription);
        currentSubscription = null;
    }

    if (gameStateSubscription) {
        gameStateSubscription();
        activeSubscriptions.delete(gameStateSubscription);
        gameStateSubscription = null;
    }

    // Clear debounce timer and state trackers
    if (updateDebounceTimer) {
        clearTimeout(updateDebounceTimer);
        updateDebounceTimer = null;
    }
    lastGameState = null;
    lastRoomState = null;

    currentRoomId = null;
}

/**
 * Close the Convex connection and clean up all resources
 * Connection pooling: Properly releases the client instance
 * Should be called when the application is closing or when connection is no longer needed
 */
function closeConnection() {
    if (!convexClient) {
        console.log('[Convex] No active connection to close');
        return;
    }

    console.log('[Convex] Closing connection and cleaning up resources');

    // Clean up all room resources
    cleanupRoomResources();

    // Unsubscribe from all active subscriptions
    activeSubscriptions.forEach((unsubscribe) => {
        try {
            unsubscribe();
        } catch (error) {
            console.error('[Convex] Error unsubscribing:', error);
        }
    });
    activeSubscriptions.clear();

    // Close the Convex client connection
    try {
        if (convexClient.close && typeof convexClient.close === 'function') {
            convexClient.close();
        }
    } catch (error) {
        console.error('[Convex] Error closing client:', error);
    }

    // Reset connection state
    convexClient = null;
    setConnectionState('disconnected');

    console.log('[Convex] Connection closed and resources cleaned up');
}

/**
 * Reset connection (close and reinitialize)
 * Useful for handling connection errors or forcing reconnection
 * @returns {Object|null} New Convex client instance or null
 */
function resetConnection() {
    console.log('[Convex] Resetting connection');
    closeConnection();
    setConnectionState('reconnecting');
    return initConvex();
}

/**
 * Toggle ready status
 * @returns {Promise<{isReady: boolean} | {error: string}>}
 */
async function toggleReady() {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.rooms.toggleReady, {
            roomId: currentRoomId,
            sessionId,
        });
    } catch (error) {
        console.error('[Convex] Error toggling ready:', error);
        return { error: error.message };
    }
}

/**
 * Update player settings
 * @param {Object} updates - { name?: string, color?: string }
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
async function updatePlayer(updates) {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.rooms.updatePlayer, {
            roomId: currentRoomId,
            sessionId,
            ...updates,
        });
    } catch (error) {
        console.error('[Convex] Error updating player:', error);
        return { error: error.message };
    }
}

/**
 * Update grid size (host only)
 * @param {number} gridSize - New grid size
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
async function updateGridSize(gridSize) {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.rooms.updateGridSize, {
            roomId: currentRoomId,
            sessionId,
            gridSize,
        });
    } catch (error) {
        console.error('[Convex] Error updating grid size:', error);
        return { error: error.message };
    }
}

/**
 * Update party mode (host only)
 * @param {boolean} partyMode - Party mode enabled
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
async function updatePartyMode(partyMode) {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.rooms.updatePartyMode, {
            roomId: currentRoomId,
            sessionId,
            partyMode,
        });
    } catch (error) {
        console.error('[Convex] Error updating party mode:', error);
        return { error: error.message };
    }
}

/**
 * Start the game (host only)
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
async function startGame() {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.rooms.startGame, {
            roomId: currentRoomId,
            sessionId,
        });
    } catch (error) {
        console.error('[Convex] Error starting game:', error);
        return { error: error.message };
    }
}

/**
 * Draw a line (make a move)
 * @param {string} lineKey - Normalized line key like "1,2-1,3"
 * @returns {Promise<{success: boolean, completedSquares: number, completedTriangles: number, keepTurn: boolean} | {error: string}>}
 */
async function drawLine(lineKey) {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.games.drawLine, {
            roomId: currentRoomId,
            sessionId,
            lineKey,
        });
    } catch (error) {
        console.error('[Convex] Error drawing line:', error);
        return { error: error.message };
    }
}

/**
 * Reveal a multiplier on a completed square
 * @param {string} squareKey - Square key like "1,2"
 * @returns {Promise<{success: boolean, multiplier: object} | {error: string}>}
 */
async function revealMultiplier(squareKey) {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.games.revealMultiplier, {
            roomId: currentRoomId,
            sessionId,
            squareKey,
        });
    } catch (error) {
        console.error('[Convex] Error revealing multiplier:', error);
        return { error: error.message };
    }
}

/**
 * Subscribe to room updates (lobby)
 * Connection pooling: Tracks subscription for proper cleanup
 * @param {Function} callback - Called with room state on each update
 * @returns {Function} Unsubscribe function
 */
function subscribeToRoom(callback) {
    if (!currentRoomId) {
        console.error('[Convex] Cannot subscribe: not in a room');
        return () => {};
    }

    initConvex();

    if (!convexClient) {
        console.error('[Convex] Cannot subscribe: client not initialized');
        return () => {};
    }

    // Unsubscribe from previous subscription
    if (currentSubscription) {
        currentSubscription();
        activeSubscriptions.delete(currentSubscription);
    }

    // Reset room state tracker on new subscription
    lastRoomState = null;

    // Wrap callback with debouncing for turn-based optimization
    const debouncedCallback = (newState) => {
        // Only call callback if room state actually changed
        if (!newState) {
            lastRoomState = null;
            callback(newState);
            return;
        }

        // For room/lobby updates, check if meaningful state changed
        const newPlayersLength = newState.players?.length || 0;
        const lastPlayersLength = lastRoomState?.players?.length || 0;
        const hasChanged =
            !lastRoomState ||
            newState.status !== lastRoomState.status ||
            newState.updatedAt !== lastRoomState.updatedAt ||
            newPlayersLength !== lastPlayersLength;

        if (hasChanged) {
            // Cache only the fields we compare (efficient shallow copy)
            lastRoomState = {
                status: newState.status,
                updatedAt: newState.updatedAt,
                players: { length: newPlayersLength },
            };
            callback(newState);
        }
    };

    currentSubscription = convexClient.onUpdate(
        api.rooms.getRoom,
        { roomId: currentRoomId },
        debouncedCallback
    );

    // Track subscription for cleanup
    activeSubscriptions.add(currentSubscription);

    console.log('[Convex] Subscribed to room updates (turn-based optimized)');
    return currentSubscription;
}

/**
 * Subscribe to game state updates (during gameplay)
 * Uses turn-based optimization to minimize unnecessary updates:
 * - Only processes updates when turn changes or game state meaningfully changes
 * - Debounces rapid updates to prevent glitches
 * Connection pooling: Tracks subscription for proper cleanup
 * @param {Function} callback - Called with game state on each update
 * @returns {Function} Unsubscribe function
 */
function subscribeToGameState(callback) {
    if (!currentRoomId) {
        console.error('[Convex] Cannot subscribe: not in a room');
        return () => {};
    }

    initConvex();

    if (!convexClient) {
        console.error('[Convex] Cannot subscribe: client not initialized');
        return () => {};
    }

    // Unsubscribe from previous game state subscription
    if (gameStateSubscription) {
        gameStateSubscription();
        activeSubscriptions.delete(gameStateSubscription);
    }

    // Reset game state tracker on new subscription
    lastGameState = null;

    // Wrap callback with turn-based optimization
    const optimizedCallback = (newState) => {
        // Clear any pending debounced update
        if (updateDebounceTimer) {
            clearTimeout(updateDebounceTimer);
            updateDebounceTimer = null;
        }

        // Only process if state has meaningfully changed (turn-based detection)
        if (!stateHasChanged(newState, lastGameState)) {
            console.log('[Convex] Skipping duplicate game state update');
            return;
        }

        // Debounce rapid updates to batch them together
        updateDebounceTimer = setTimeout(() => {
            // Cache only the fields we compare (efficient shallow copy)
            if (newState) {
                lastGameState = {
                    room: newState.room
                        ? {
                              currentPlayerIndex: newState.room.currentPlayerIndex,
                              status: newState.room.status,
                              updatedAt: newState.room.updatedAt,
                          }
                        : null,
                    lines: { length: (newState.lines || []).length },
                    squares: { length: (newState.squares || []).length },
                    players: (newState.players || []).map((p) => ({ score: p?.score || 0 })),
                };
            } else {
                lastGameState = null;
            }
            callback(newState);
            console.log('[Convex] Game state update processed (turn-based)');
        }, UPDATE_DEBOUNCE_MS);
    };

    gameStateSubscription = convexClient.onUpdate(
        api.games.getGameState,
        { roomId: currentRoomId },
        optimizedCallback
    );

    // Track subscription for cleanup
    activeSubscriptions.add(gameStateSubscription);

    console.log('[Convex] Subscribed to game state updates (turn-based optimized)');
    return gameStateSubscription;
}

/**
 * Get current room state (one-time query)
 * @returns {Promise<Object|null>}
 */
async function getRoomState() {
    if (!currentRoomId) return null;

    initConvex();

    if (!convexClient) {
        console.error('[Convex] Cannot query: client not initialized');
        return null;
    }

    try {
        return await convexClient.query(api.rooms.getRoom, {
            roomId: currentRoomId,
        });
    } catch (error) {
        console.error('[Convex] Error getting room state:', error);
        return null;
    }
}

/**
 * Get room by code (for joining)
 * @param {string} roomCode - 6-character room code
 * @returns {Promise<Object|null>}
 */
async function getRoomByCode(roomCode) {
    initConvex();

    if (!convexClient) {
        console.error('[Convex] Cannot query: client not initialized');
        return null;
    }

    try {
        return await convexClient.query(api.rooms.getRoomByCode, {
            roomCode: roomCode.toUpperCase(),
        });
    } catch (error) {
        console.error('[Convex] Error getting room by code:', error);
        return null;
    }
}

/**
 * Get current game state (one-time query)
 * @returns {Promise<Object|null>}
 */
async function getGameState() {
    if (!currentRoomId) return null;

    initConvex();

    if (!convexClient) {
        console.error('[Convex] Cannot query: client not initialized');
        return null;
    }

    try {
        return await convexClient.query(api.games.getGameState, {
            roomId: currentRoomId,
        });
    } catch (error) {
        console.error('[Convex] Error getting game state:', error);
        return null;
    }
}

/**
 * End the game (host only)
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
async function endGame() {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.games.endGame, {
            roomId: currentRoomId,
            sessionId,
        });
    } catch (error) {
        console.error('[Convex] Error ending game:', error);
        return { error: error.message };
    }
}

/**
 * Reset game to lobby (host only)
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
async function resetGame() {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.games.resetGame, {
            roomId: currentRoomId,
            sessionId,
        });
    } catch (error) {
        console.error('[Convex] Error resetting game:', error);
        return { error: error.message };
    }
}

/**
 * Populate lines (host only) - adds safe lines that don't complete squares
 * @param {string[]} lineKeys - Array of line keys to populate
 * @returns {Promise<{success: boolean, linesPopulated: number} | {error: string}>}
 */
async function populateLines(lineKeys) {
    if (!currentRoomId) return { error: 'Not in a room' };

    initConvex();

    if (!convexClient) {
        return { error: CONVEX_CONNECTION_ERROR };
    }

    try {
        return await convexClient.mutation(api.games.populateLines, {
            roomId: currentRoomId,
            sessionId,
            lineKeys,
        });
    } catch (error) {
        console.error('[Convex] Error populating lines:', error);
        return { error: error.message };
    }
}

/**
 * Get the current room ID
 */
function getCurrentRoomId() {
    return currentRoomId;
}

/**
 * Set the current room ID (for rejoining)
 */
function setCurrentRoomId(roomId) {
    currentRoomId = roomId;
}

// Export for global access in vanilla JS
window.ShapeKeeperConvex = {
    initConvex,
    getSessionId,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    updatePlayer,
    updateGridSize,
    updatePartyMode,
    startGame,
    drawLine,
    revealMultiplier,
    populateLines,
    subscribeToRoom,
    subscribeToGameState,
    getRoomState,
    getRoomByCode,
    getGameState,
    endGame,
    resetGame,
    getCurrentRoomId,
    setCurrentRoomId,
    // Connection pooling methods
    closeConnection,
    resetConnection,
    getConnectionState,
    onConnectionStateChange,
};

// Cleanup connection on page unload to prevent resource leaks
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        console.log('[Convex] Page unloading, cleaning up connection');
        closeConnection();
    });

    // Also handle visibility change for mobile/tablet browsers
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && convexClient) {
            console.log('[Convex] Page hidden, connection will remain active for reconnection');
            // Don't close connection on hidden - allow reconnection when page becomes visible
            // Only log the state for monitoring
        }
    });
}

