(function initializeShapeKeeperConvexRoomOperations(windowObject) {
    'use strict';

    const shared = windowObject.ShapeKeeperConvexShared;
    if (!shared) {
        console.error('[Convex] Shared helpers must load before room operations');
        return;
    }

    async function createRoom(playerName, gridSize, partyMode = true) {
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
            console.log('[Convex] Room created:', result.roomCode, 'partyMode:', partyMode);
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
            console.log('[Convex] Joined room:', roomCode);
        }

        return result;
    }

    async function leaveRoom() {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        const result = await shared.runMutation(
            shared.api.rooms.leaveRoom,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
            },
            'leaving room'
        );

        if (!result?.error) {
            shared.cleanupRoomResources();
            console.log('[Convex] Left room');
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
                partyMode,
            },
            'updating party mode'
        );
    }

    async function startGame() {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.rooms.startGame,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
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
            { roomId: shared.state.currentRoomId },
            'getting room state'
        );
    }

    async function getRoomByCode(roomCode) {
        return shared.runQuery(
            shared.api.rooms.getRoomByCode,
            { roomCode: roomCode.toUpperCase() },
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
