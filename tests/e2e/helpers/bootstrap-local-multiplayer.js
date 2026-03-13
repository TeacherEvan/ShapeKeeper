export async function installMockMultiplayer(
    page,
    { roomCode = 'ABC123', gridSize = 5, partyMode = true, autoEmitGameState = false } = {}
) {
    await page.evaluate(
        ({
            roomCode: initialRoomCode,
            gridSize: initialGridSize,
            partyMode: initialPartyMode,
            autoEmitGameState: shouldAutoEmitGameState,
        }) => {
            const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
            const state = {
                autoEmitGameState: shouldAutoEmitGameState,
                connectionState: 'connected',
                connectionStateListeners: [],
                currentRoomId: null,
                gameState: null,
                gameSubscribers: new Set(),
                leaveRoomCalls: 0,
                roomCode: initialRoomCode,
                roomState: null,
                roomSubscribers: new Set(),
                sessionId: 'session_host',
                updatedAt: 1,
            };
            const buildLobbyState = () => ({
                gridSize: initialGridSize,
                hostPlayerId: state.sessionId,
                partyMode: initialPartyMode,
                players: [
                    {
                        _id: 'player_host',
                        color: '#ff0000',
                        isReady: true,
                        name: 'Host',
                        playerIndex: 0,
                        playerNumber: 1,
                        sessionId: state.sessionId,
                    },
                    {
                        _id: 'player_guest',
                        color: '#0000ff',
                        isReady: true,
                        name: 'Guest',
                        playerIndex: 1,
                        playerNumber: 2,
                        sessionId: 'session_guest',
                    },
                ],
                roomCode: state.roomCode,
                status: 'lobby',
                updatedAt: state.updatedAt,
            });
            const emitRoomState = () =>
                state.roomSubscribers.forEach((callback) => callback(clone(state.roomState)));
            const emitGameState = () =>
                state.gameSubscribers.forEach((callback) => callback(clone(state.gameState)));
            state.roomState = buildLobbyState();

            window.__shapeKeeperTest = {
                emitAuthoritativeGameState(nextState) {
                    state.gameState = clone(nextState);
                    emitGameState();
                },
                getSnapshot() {
                    return {
                        currentRoomId: state.currentRoomId,
                        leaveRoomCalls: state.leaveRoomCalls,
                        roomState: clone(state.roomState),
                    };
                },
            };

            window.ShapeKeeperConvex = {
                async createRoom() {
                    state.currentRoomId = 'room_abc123';
                    state.roomState = buildLobbyState();
                    return { roomCode: state.roomCode, roomId: state.currentRoomId };
                },
                async getGameState() {
                    return clone(state.gameState);
                },
                getConnectionState() {
                    return state.connectionState;
                },
                getCurrentRoomId() {
                    return state.currentRoomId;
                },
                getSessionId() {
                    return state.sessionId;
                },
                async joinRoom(joinCode) {
                    state.currentRoomId = 'room_joined';
                    state.roomCode = joinCode.toUpperCase();
                    state.roomState = buildLobbyState();
                    return { playerId: 'player_guest', roomId: state.currentRoomId };
                },
                async leaveRoom() {
                    state.leaveRoomCalls += 1;
                    state.currentRoomId = null;
                    state.roomState = null;
                    return { success: true };
                },
                onConnectionStateChange(listener) {
                    state.connectionStateListeners.push(listener);
                    listener(state.connectionState, state.connectionState);
                    return () => {
                        state.connectionStateListeners = state.connectionStateListeners.filter(
                            (entry) => entry !== listener
                        );
                    };
                },
                async startGame() {
                    state.updatedAt += 1;
                    state.roomState = {
                        ...buildLobbyState(),
                        status: 'playing',
                        updatedAt: state.updatedAt,
                    };
                    emitRoomState();
                    if (state.autoEmitGameState) emitGameState();
                    return { success: true };
                },
                subscribeToGameState(callback) {
                    state.gameSubscribers.add(callback);
                    if (state.autoEmitGameState) callback(clone(state.gameState));
                    return () => state.gameSubscribers.delete(callback);
                },
                subscribeToRoom(callback) {
                    state.roomSubscribers.add(callback);
                    callback(clone(state.roomState));
                    return () => state.roomSubscribers.delete(callback);
                },
                async toggleReady() {
                    return { isReady: true };
                },
                async updateGridSize() {
                    return { success: true };
                },
                async updatePartyMode() {
                    return { success: true };
                },
                async updatePlayer() {
                    return { success: true };
                },
            };
        },
        { roomCode, gridSize, partyMode, autoEmitGameState }
    );
}
