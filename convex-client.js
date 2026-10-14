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
 * Mutations issued while offline are queued and retried in order by the Convex client; see tests/e2e/reconnect.spec.js.
 *
 * TODO: [ARCHITECTURE] Move to Redis for scalability in high-traffic scenarios
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
        updateTurnDuration: roomOperations.updateTurnDuration,
        startGame: roomOperations.startGame,
        drawLine: gameOperations.drawLine,
        revealMultiplier: gameOperations.revealMultiplier,
        tapSquare: gameOperations.tapSquare,
        populateLines: gameOperations.populateLines,
        subscribeToRoom: subscriptions.subscribeToRoom,
        subscribeToGameState: subscriptions.subscribeToGameState,
        subscribeToOpenLobbies: subscriptions.subscribeToOpenLobbies,
        getRoomState: roomOperations.getRoomState,
        getRoomByCode: roomOperations.getRoomByCode,
        getGameState: gameOperations.getGameState,
        endGame: gameOperations.endGame,
        resetGame: gameOperations.resetGame,
        requestRematch: gameOperations.requestRematch,
        getCurrentRoomId: shared.getCurrentRoomId,
        setCurrentRoomId: shared.setCurrentRoomId,
        closeConnection: shared.closeConnection,
        resetConnection: shared.resetConnection,
        getConnectionState: shared.getConnectionState,
        onConnectionStateChange: shared.onConnectionStateChange,
    };

    windowObject.addEventListener('beforeunload', () => {
        console.log('[Convex] Page unloading, cleaning up connection');

        // Best-effort lobby leave: closing a tab otherwise strands the
        // room as a zombie 'lobby' row that haunts everyone's JOIN LOBBY
        // browser. Fire-and-forget — the mutation may not land before the
        // page dies, which is what the sweepStaleLobbies cron backstops.
        // Gated to lobby status so a mid-match reload never hands the host
        // role to the other player (in-match leaves transfer the host).
        try {
            const roomId = windowObject.ShapeKeeperConvex?.getCurrentRoomId?.();
            const roomStatus = shared.state.lastRoomState?.status;
            if (roomId && roomStatus !== 'playing') {
                void windowObject.ShapeKeeperConvex?.leaveRoom?.();
            }
        } catch {
            // Best effort only.
        }

        shared.closeConnection();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && shared.state.convexClient) {
            console.log('[Convex] Page hidden, connection will remain active for reconnection');
        }
    });
})(window);
