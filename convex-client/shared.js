(function initializeShapeKeeperConvexShared(windowObject) {
    'use strict';

    const CONVEX_URL = windowObject.CONVEX_URL || 'https://oceanic-antelope-781.convex.cloud';
    const ConvexClient = windowObject.convex ? windowObject.convex.ConvexClient : null;
    const api = windowObject.convex ? windowObject.convex.anyApi : null;
    const CONVEX_CONNECTION_ERROR = 'Convex backend not available. Please check your connection.';

    const state = {
        convexClient: null,
        sessionId: null,
        currentRoomId: null,
        currentSubscription: null,
        gameStateSubscription: null,
        connectionState: 'disconnected',
        connectionStateListeners: [],
        activeSubscriptions: new Set(),
        lastGameState: null,
        lastRoomState: null,
        updateDebounceTimer: null,
    };

    const UPDATE_DEBOUNCE_MS = 50;

    function setConnectionState(newState) {
        if (state.connectionState !== newState) {
            const oldState = state.connectionState;
            state.connectionState = newState;
            console.log(`[Convex] Connection state: ${oldState} → ${newState}`);
            state.connectionStateListeners.forEach((listener) => listener(newState, oldState));
        }
    }

    function onConnectionStateChange(callback) {
        state.connectionStateListeners.push(callback);
        callback(state.connectionState, state.connectionState);
        return () => {
            state.connectionStateListeners = state.connectionStateListeners.filter(
                (listener) => listener !== callback
            );
        };
    }

    function getConnectionState() {
        return state.connectionState;
    }

    function initConvex() {
        if (state.convexClient) {
            console.log('[Convex] Reusing existing client connection (pooling)');
            return state.convexClient;
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
            state.convexClient = new ConvexClient(CONVEX_URL);
            state.sessionId = localStorage.getItem('shapekeeper_session_id');
            if (!state.sessionId) {
                state.sessionId =
                    'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('shapekeeper_session_id', state.sessionId);
            }

            setConnectionState('connected');
            console.log('[Convex] Client initialized with session:', state.sessionId);
            return state.convexClient;
        } catch (error) {
            console.error('[Convex] Failed to initialize client:', error);
            setConnectionState('disconnected');
            return null;
        }
    }

    function getSessionId() {
        if (!state.sessionId) {
            initConvex();
        }
        return state.sessionId;
    }

    function cleanupRoomResources() {
        if (state.currentSubscription) {
            state.currentSubscription();
            state.activeSubscriptions.delete(state.currentSubscription);
            state.currentSubscription = null;
        }

        if (state.gameStateSubscription) {
            state.gameStateSubscription();
            state.activeSubscriptions.delete(state.gameStateSubscription);
            state.gameStateSubscription = null;
        }

        if (state.updateDebounceTimer) {
            clearTimeout(state.updateDebounceTimer);
            state.updateDebounceTimer = null;
        }

        state.lastGameState = null;
        state.lastRoomState = null;
        state.currentRoomId = null;
    }

    function closeConnection() {
        if (!state.convexClient) {
            console.log('[Convex] No active connection to close');
            return;
        }

        console.log('[Convex] Closing connection and cleaning up resources');
        cleanupRoomResources();

        state.activeSubscriptions.forEach((unsubscribe) => {
            try {
                unsubscribe();
            } catch (error) {
                console.error('[Convex] Error unsubscribing:', error);
            }
        });
        state.activeSubscriptions.clear();

        try {
            if (state.convexClient.close && typeof state.convexClient.close === 'function') {
                state.convexClient.close();
            }
        } catch (error) {
            console.error('[Convex] Error closing client:', error);
        }

        state.convexClient = null;
        setConnectionState('disconnected');
        console.log('[Convex] Connection closed and resources cleaned up');
    }

    function resetConnection() {
        console.log('[Convex] Resetting connection');
        closeConnection();
        setConnectionState('reconnecting');
        return initConvex();
    }

    async function runMutation(apiRef, args, actionName) {
        const client = initConvex();
        if (!client) {
            return { error: CONVEX_CONNECTION_ERROR };
        }

        try {
            return await client.mutation(apiRef, args);
        } catch (error) {
            console.error(`[Convex] Error ${actionName}:`, error);
            return { error: error.message };
        }
    }

    async function runQuery(apiRef, args, actionName) {
        const client = initConvex();
        if (!client) {
            console.error('[Convex] Cannot query: client not initialized');
            return null;
        }

        try {
            return await client.query(apiRef, args);
        } catch (error) {
            console.error(`[Convex] Error ${actionName}:`, error);
            return null;
        }
    }

    function getCurrentRoomId() {
        return state.currentRoomId;
    }

    function setCurrentRoomId(roomId) {
        state.currentRoomId = roomId;
    }

    windowObject.ShapeKeeperConvexShared = {
        CONVEX_CONNECTION_ERROR,
        UPDATE_DEBOUNCE_MS,
        api,
        cleanupRoomResources,
        closeConnection,
        getConnectionState,
        getCurrentRoomId,
        getSessionId,
        initConvex,
        onConnectionStateChange,
        resetConnection,
        runMutation,
        runQuery,
        setConnectionState,
        setCurrentRoomId,
        state,
    };
})(window);
