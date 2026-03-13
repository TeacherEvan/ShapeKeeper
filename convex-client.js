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

(function initializeShapeKeeperConvex(windowObject) {
    const shared = windowObject.ShapeKeeperConvexShared;
    const roomOperations = windowObject.ShapeKeeperConvexRoomOperations;
    const gameOperations = windowObject.ShapeKeeperConvexGameOperations;
    const subscriptions = windowObject.ShapeKeeperConvexSubscriptions;

    if (!shared || !roomOperations || !gameOperations || !subscriptions) {
        console.error(
            '[Convex] Required helper scripts are missing. Check convex-client script order.'
        );
        return;
    }

    windowObject.ShapeKeeperConvex = {
        initConvex: shared.initConvex,
        getSessionId: shared.getSessionId,
        createRoom: roomOperations.createRoom,
        joinRoom: roomOperations.joinRoom,
        leaveRoom: roomOperations.leaveRoom,
        toggleReady: roomOperations.toggleReady,
        updatePlayer: roomOperations.updatePlayer,
        updateGridSize: roomOperations.updateGridSize,
        updatePartyMode: roomOperations.updatePartyMode,
        startGame: roomOperations.startGame,
        drawLine: gameOperations.drawLine,
        revealMultiplier: gameOperations.revealMultiplier,
        populateLines: gameOperations.populateLines,
        subscribeToRoom: subscriptions.subscribeToRoom,
        subscribeToGameState: subscriptions.subscribeToGameState,
        getRoomState: roomOperations.getRoomState,
        getRoomByCode: roomOperations.getRoomByCode,
        getGameState: gameOperations.getGameState,
        endGame: gameOperations.endGame,
        resetGame: gameOperations.resetGame,
        getCurrentRoomId: shared.getCurrentRoomId,
        setCurrentRoomId: shared.setCurrentRoomId,
        closeConnection: shared.closeConnection,
        resetConnection: shared.resetConnection,
        getConnectionState: shared.getConnectionState,
        onConnectionStateChange: shared.onConnectionStateChange,
    };

    windowObject.addEventListener('beforeunload', () => {
        console.log('[Convex] Page unloading, cleaning up connection');
        shared.closeConnection();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && shared.state.convexClient) {
            console.log('[Convex] Page hidden, connection will remain active for reconnection');
        }
    });
})(window);
