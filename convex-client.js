/**
 * Convex Client Integration for ShapeKeeper
 * Handles real-time multiplayer communication with Convex backend
 * 
 * This file uses the Convex browser bundle loaded via script tag.
 * The 'convex' global object is provided by: https://unpkg.com/convex@1.29.3/dist/browser.bundle.js
 */

'use strict';

// Get Convex URL from environment or use default
const CONVEX_URL = window.CONVEX_URL || "https://oceanic-antelope-781.convex.cloud";

// Use the global convex object from the browser bundle
/** @type {import("convex/browser")["ConvexClient"]} */
const ConvexClient = window.convex ? window.convex.ConvexClient : null;

// Use anyApi for untyped function references
/** @type {import("convex/server")["anyApi"]} */
const api = window.convex ? window.convex.anyApi : null;

// Initialize the Convex client
let convexClient = null;
let sessionId = null;
let currentRoomId = null;
let currentSubscription = null;
let gameStateSubscription = null;

/**
 * Initialize the Convex client and session
 */
function initConvex() {
    if (convexClient) return convexClient;
    
    if (!ConvexClient) {
        console.error('[Convex] Browser bundle not loaded. Make sure convex browser bundle is included before this script.');
        return null;
    }
    
    convexClient = new ConvexClient(CONVEX_URL);
    
    // Generate or retrieve session ID
    sessionId = localStorage.getItem('shapekeeper_session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('shapekeeper_session_id', sessionId);
    }
    
    console.log('[Convex] Client initialized with session:', sessionId);
    return convexClient;
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
async function createRoom(playerName, gridSize) {
    initConvex();
    
    try {
        const result = await convexClient.mutation(api.rooms.createRoom, {
            sessionId,
            playerName,
            gridSize,
        });
        
        if (result.roomId) {
            currentRoomId = result.roomId;
            console.log('[Convex] Room created:', result.roomCode);
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
    if (!currentRoomId) return { error: "Not in a room" };
    
    try {
        const result = await convexClient.mutation(api.rooms.leaveRoom, {
            roomId: currentRoomId,
            sessionId,
        });
        
        // Unsubscribe from updates
        if (currentSubscription) {
            currentSubscription();
            currentSubscription = null;
        }
        
        currentRoomId = null;
        console.log('[Convex] Left room');
        
        return result;
    } catch (error) {
        console.error('[Convex] Error leaving room:', error);
        return { error: error.message };
    }
}

/**
 * Toggle ready status
 * @returns {Promise<{isReady: boolean} | {error: string}>}
 */
async function toggleReady() {
    if (!currentRoomId) return { error: "Not in a room" };
    
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
    if (!currentRoomId) return { error: "Not in a room" };
    
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
    if (!currentRoomId) return { error: "Not in a room" };
    
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
 * Start the game (host only)
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
async function startGame() {
    if (!currentRoomId) return { error: "Not in a room" };
    
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
 * @returns {Promise<{success: boolean, completedSquares: number, keepTurn: boolean} | {error: string}>}
 */
async function drawLine(lineKey) {
    if (!currentRoomId) return { error: "Not in a room" };
    
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
    if (!currentRoomId) return { error: "Not in a room" };
    
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
 * @param {Function} callback - Called with room state on each update
 * @returns {Function} Unsubscribe function
 */
function subscribeToRoom(callback) {
    if (!currentRoomId) {
        console.error('[Convex] Cannot subscribe: not in a room');
        return () => {};
    }
    
    initConvex();
    
    // Unsubscribe from previous subscription
    if (currentSubscription) {
        currentSubscription();
    }
    
    currentSubscription = convexClient.onUpdate(
        api.rooms.getRoom,
        { roomId: currentRoomId },
        callback
    );
    
    console.log('[Convex] Subscribed to room updates');
    return currentSubscription;
}

/**
 * Subscribe to game state updates (during gameplay)
 * @param {Function} callback - Called with game state on each update
 * @returns {Function} Unsubscribe function
 */
function subscribeToGameState(callback) {
    if (!currentRoomId) {
        console.error('[Convex] Cannot subscribe: not in a room');
        return () => {};
    }
    
    initConvex();
    
    // Unsubscribe from previous game state subscription
    if (gameStateSubscription) {
        gameStateSubscription();
    }
    
    gameStateSubscription = convexClient.onUpdate(
        api.games.getGameState,
        { roomId: currentRoomId },
        callback
    );
    
    console.log('[Convex] Subscribed to game state updates');
    return gameStateSubscription;
}

/**
 * Get current room state (one-time query)
 * @returns {Promise<Object|null>}
 */
async function getRoomState() {
    if (!currentRoomId) return null;
    
    initConvex();
    
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
    if (!currentRoomId) return { error: "Not in a room" };
    
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
    if (!currentRoomId) return { error: "Not in a room" };
    
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
    startGame,
    drawLine,
    revealMultiplier,
    subscribeToRoom,
    subscribeToGameState,
    getRoomState,
    getRoomByCode,
    getGameState,
    endGame,
    resetGame,
    getCurrentRoomId,
    setCurrentRoomId,
};
