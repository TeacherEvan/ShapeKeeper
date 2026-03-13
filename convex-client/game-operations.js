(function initializeShapeKeeperConvexGameOperations(windowObject) {
    'use strict';

    const shared = windowObject.ShapeKeeperConvexShared;
    if (!shared) {
        console.error('[Convex] Shared helpers must load before game operations');
        return;
    }

    async function drawLine(lineKey) {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.games.drawLine,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
                lineKey,
            },
            'drawing line'
        );
    }

    async function revealMultiplier(squareKey) {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.games.revealMultiplier,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
                squareKey,
            },
            'revealing multiplier'
        );
    }

    async function getGameState() {
        if (!shared.state.currentRoomId) {
            return null;
        }

        return shared.runQuery(
            shared.api.games.getGameState,
            { roomId: shared.state.currentRoomId },
            'getting game state'
        );
    }

    async function endGame() {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.games.endGame,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
            },
            'ending game'
        );
    }

    async function resetGame() {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.games.resetGame,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
            },
            'resetting game'
        );
    }

    async function populateLines(lineKeys) {
        if (!shared.state.currentRoomId) {
            return { error: 'Not in a room' };
        }

        return shared.runMutation(
            shared.api.games.populateLines,
            {
                roomId: shared.state.currentRoomId,
                sessionId: shared.getSessionId(),
                lineKeys,
            },
            'populating lines'
        );
    }

    windowObject.ShapeKeeperConvexGameOperations = {
        drawLine,
        endGame,
        getGameState,
        populateLines,
        resetGame,
        revealMultiplier,
    };
})(window);
