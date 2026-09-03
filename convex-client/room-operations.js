(function initializeShapeKeeperConvexRoomOperations(windowObject) {
    'use strict';

    const shared = windowObject.ShapeKeeperConvexShared;
    if (!shared) {
        console.error('[Convex] Shared helpers must load before room operations');
        return;
    }

    // Per-tab hostToken storage. sessionStorage is cleared on tab close, so
    // closing and re-opening the tab makes the host re-authenticate by
    // re-creating the room. This is the correct threat model: the token is
    // never persisted across sessions. For rooms created before the hostToken
    // scheme (legacy rooms), no entry is created and the mutations fall back
    // to the previous sessionId-only check.
    function hostTokenKey(roomId) {
        return roomId ? `shapekeeper_host_token_${roomId}` : null;
    }
    function stashHostToken(roomId, hostToken) {
        if (!roomId || typeof hostToken !== 'string' || hostToken.length === 0) return;
        try {
            windowObject.sessionStorage.setItem(hostTokenKey(roomId), hostToken);
        } catch {
            // sessionStorage can throw in private-browsing modes; not fatal.
        }
    }
    function getHostToken(roomId) {
        if (!roomId) return null;
        try {
            return windowObject.sessionStorage.getItem(hostTokenKey(roomId));
        } catch {
            return null;
        }
    }
    function clearHostToken(roomId) {
        if (!roomId) return;
        try {
            windowObject.sessionStorage.removeItem(hostTokenKey(roomId));
        } catch {
            // ignore
        }
    }
    // Expose helpers for tests / debug. They are namespaced under shared
    // so other modules (game-operations) can reach them without a circular
    // import.
    shared.stashHostToken = stashHostToken;
    shared.getHostToken = getHostToken;
    shared.clearHostToken = clearHostToken;

    async function createRoom(playerName, gridSize, partyMode = false) {
        const result = await shared.runMutation(
            shared.api.rooms.createRoom,
            {
                sessionId: shared.getSessionId(),
                playerName,
                gridSize,
                partyMode,
            },
            'creating room'
        );

        if (result?.roomId) {
            shared.state.currentRoomId = result.roomId;
            // Server-issued hostToken: stash for the lifetime of this tab.
            if (typeof result.hostToken === 'string' && result.hostToken.length > 0) {
                stashHostToken(result.roomId, result.hostToken);
            }
        }

        return result;
    }

    async function joinRoom(roomCode, playerName) {
        const result = await shared.runMutation(
            shared.api.rooms.joinRoom,
            {
                roomCode: roomCode.toUpperCase(),
                sessionId: shared.getSessionId(),
                playerName,
            },
            'joining room'
        );

        if (result?.roomId) {
            shared.state.currentRoomId = result.roomId;
        }

        return result;
    }

    async function leaveRoom() {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        const roomId = shared.state.currentRoomId;
        const result = await shared.runMutation(
            shared.api.rooms.leaveRoom,
            {
                roomId,
                sessionId: shared.getSessionId(),
            },
            'leaving room'
        );

        if (!result?.error) {
            shared.cleanupRoomResources();
            clearHostToken(roomId);
        }

        return result;
    }

    async function toggleReady() {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.rooms.toggleReady,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
            },
            'toggling ready'
        );
    }

    async function updatePlayer(updates) {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.rooms.updatePlayer,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
                ...updates,
            },
            'updating player'
        );
    }

    async function updateGridSize(gridSize) {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.rooms.updateGridSize,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
                hostToken: getHostToken(shared.state.currentRoomId),
                gridSize,
            },
            'updating grid size'
        );
    }

    async function updatePartyMode(partyMode) {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.rooms.updatePartyMode,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
                hostToken: getHostToken(shared.state.currentRoomId),
                partyMode,
            },
            'updating party mode'
        );
    }

    async function startGame(_roomId) {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.rooms.startGame,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
                hostToken: getHostToken(shared.state.currentRoomId),
            },
            'starting game'
        );
    }

    async function getRoomState() {
        if (!shared.state.currentRoomId) {
            return null;
        }

        return shared.runQuery(
            shared.api.rooms.getRoom,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
            },
            'getting room state'
        );
    }

    async function getRoomByCode(roomCode) {
        return shared.runQuery(
            shared.api.rooms.getRoomByCode,
            {
                roomCode: roomCode.toUpperCase(),
                sessionId: shared.getSessionId(),
            },
            'getting room by code'
        );
    }

    windowObject.ShapeKeeperConvexRoomOperations = {
        createRoom,
        getRoomByCode,
        getRoomState,
        joinRoom,
        leaveRoom,
        startGame,
        toggleReady,
        updateGridSize,
        updatePartyMode,
        updatePlayer,
    };
})(window);
