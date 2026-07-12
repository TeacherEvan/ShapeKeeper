(function initializeShapeKeeperConvexSubscriptions(windowObject) {
    'use strict';

    const shared = windowObject.ShapeKeeperConvexShared;
    if (!shared) {
        console.error('[Convex] Shared helpers must load before subscription helpers');
        return;
    }

    function stateHasChanged(newState, lastState) {
        if (!lastState) return true;
        if (!newState) return lastState !== null;

        const newRoom = newState.room || {};
        const lastRoom = lastState.room || {};

        if (newRoom.currentPlayerIndex !== lastRoom.currentPlayerIndex) return true;
        if (newRoom.status !== lastRoom.status) return true;
        if (newRoom.updatedAt !== lastRoom.updatedAt) return true;

        const newLines = newState.lines || [];
        const lastLines = lastState.lines || [];
        if (newLines.length !== lastLines.length) return true;

        const newSquares = newState.squares || [];
        const lastSquares = lastState.squares || [];
        if (newSquares.length !== lastSquares.length) return true;

        const newPlayers = newState.players || [];
        const lastPlayers = lastState.players || [];
        if (newPlayers.length !== lastPlayers.length) return true;

        for (let index = 0; index < newPlayers.length; index++) {
            if (newPlayers[index]?.score !== lastPlayers[index]?.score) {
                return true;
            }
        }

        return false;
    }

    function subscribeToRoom(callback) {
        if (!shared.state.currentRoomId) {
            console.error('[Convex] Cannot subscribe: not in a room');
            return () => {};
        }

        const client = shared.initConvex();
        if (!client) {
            console.error('[Convex] Cannot subscribe: client not initialized');
            return () => {};
        }

        if (shared.state.currentSubscription) {
            shared.state.currentSubscription();
            shared.state.activeSubscriptions.delete(shared.state.currentSubscription);
        }

        shared.state.lastRoomState = null;

        const debouncedCallback = (newState) => {
            if (!newState) {
                shared.state.lastRoomState = null;
                callback(newState);
                return;
            }

            const newPlayersLength = newState.players?.length || 0;
            const lastPlayersLength = shared.state.lastRoomState?.players?.length || 0;
            const hasChanged =
                !shared.state.lastRoomState ||
                newState.status !== shared.state.lastRoomState.status ||
                newState.updatedAt !== shared.state.lastRoomState.updatedAt ||
                newPlayersLength !== lastPlayersLength;

            if (hasChanged) {
                shared.state.lastRoomState = {
                    status: newState.status,
                    updatedAt: newState.updatedAt,
                    players: { length: newPlayersLength },
                };
                callback(newState);
            }
        };

        shared.state.currentSubscription = client.onUpdate(
            shared.api.rooms.getRoom,
            { roomId: shared.state.currentRoomId },
            debouncedCallback
        );

        shared.state.activeSubscriptions.add(shared.state.currentSubscription);
        console.log('[Convex] Subscribed to room updates (turn-based optimized)');
        return shared.state.currentSubscription;
    }

    function subscribeToGameState(callback) {
        if (!shared.state.currentRoomId) {
            console.error('[Convex] Cannot subscribe: not in a room');
            return () => {};
        }

        const client = shared.initConvex();
        if (!client) {
            console.error('[Convex] Cannot subscribe: client not initialized');
            return () => {};
        }

        if (shared.state.gameStateSubscription) {
            shared.state.gameStateSubscription();
            shared.state.activeSubscriptions.delete(shared.state.gameStateSubscription);
        }

        shared.state.lastGameState = null;

        const optimizedCallback = (newState) => {
            if (shared.state.updateDebounceTimer) {
                clearTimeout(shared.state.updateDebounceTimer);
                shared.state.updateDebounceTimer = null;
            }

            if (!stateHasChanged(newState, shared.state.lastGameState)) {
                console.log('[Convex] Skipping duplicate game state update');
                return;
            }

            shared.state.updateDebounceTimer = setTimeout(() => {
                if (newState) {
                    shared.state.lastGameState = {
                        room: newState.room
                            ? {
                                  currentPlayerIndex: newState.room.currentPlayerIndex,
                                  status: newState.room.status,
                                  updatedAt: newState.room.updatedAt,
                              }
                            : null,
                        lines: { length: (newState.lines || []).length },
                        squares: { length: (newState.squares || []).length },
                        players: (newState.players || []).map((player) => ({
                            score: player?.score || 0,
                        })),
                    };
                } else {
                    shared.state.lastGameState = null;
                }

                callback(newState);
                console.log('[Convex] Game state update processed (turn-based)');
            }, shared.UPDATE_DEBOUNCE_MS);
        };

        shared.state.gameStateSubscription = client.onUpdate(
            shared.api.games.getGameState,
            { roomId: shared.state.currentRoomId },
            optimizedCallback
        );

        shared.state.activeSubscriptions.add(shared.state.gameStateSubscription);
        console.log('[Convex] Subscribed to game state updates (turn-based optimized)');
        return shared.state.gameStateSubscription;
    }

    windowObject.ShapeKeeperConvexSubscriptions = {
        subscribeToGameState,
        subscribeToRoom,
    };
})(window);
