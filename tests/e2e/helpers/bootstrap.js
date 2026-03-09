const CONVEX_BROWSER_BUNDLE_STUB = `
window.convex = {
    ConvexClient: function MockConvexClient() {
        return {
            mutation: async () => ({}),
            query: async () => null,
            onUpdate: () => () => {},
            close() {},
        };
    },
    anyApi: {
        rooms: {
            createRoom: 'rooms.createRoom',
            getRoom: 'rooms.getRoom',
            getRoomByCode: 'rooms.getRoomByCode',
            joinRoom: 'rooms.joinRoom',
            leaveRoom: 'rooms.leaveRoom',
            startGame: 'rooms.startGame',
            toggleReady: 'rooms.toggleReady',
            updateGridSize: 'rooms.updateGridSize',
            updatePartyMode: 'rooms.updatePartyMode',
            updatePlayer: 'rooms.updatePlayer',
        },
        games: {
            drawLine: 'games.drawLine',
            endGame: 'games.endGame',
            getGameState: 'games.getGameState',
            populateLines: 'games.populateLines',
            resetGame: 'games.resetGame',
            revealMultiplier: 'games.revealMultiplier',
        },
    },
};
`;

const SHARED_BACKEND_STORAGE_KEY = '__shapekeeper_e2e_shared_backend__';

const DEFAULT_SHARED_COLORS = ['#ff0000', '#0000ff', '#00ff00', '#ff8c00', '#8b00ff', '#00ffff'];

export async function gotoApp(page, { startupTimeoutMs = 75 } = {}) {
    await page.route(/https:\/\/unpkg\.com\/convex@.*\/dist\/browser\.bundle\.js/, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: CONVEX_BROWSER_BUNDLE_STUB,
        })
    );

    await page.addInitScript(({ startupTimeoutOverride }) => {
        window.__SHAPEKEEPER_STARTUP_TIMEOUT_MS = startupTimeoutOverride;

        const noopAsync = async () => {};
        document.exitFullscreen = noopAsync;
        Element.prototype.requestFullscreen = noopAsync;

        if (!navigator.clipboard) {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: noopAsync },
            });
        }
    }, {
        startupTimeoutOverride: startupTimeoutMs,
    });

    await page.goto('/');
}

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
            const clone = (value) => {
                if (value == null) {
                    return value;
                }

                return JSON.parse(JSON.stringify(value));
            };

            const state = {
                autoEmitGameState: shouldAutoEmitGameState,
                connectionState: 'connected',
                connectionStateListeners: [],
                currentRoomId: null,
                gameState: null,
                leaveRoomCalls: 0,
                roomCode: initialRoomCode,
                roomState: null,
                roomSubscribers: new Set(),
                gameSubscribers: new Set(),
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

            const emitRoomState = () => {
                const payload = clone(state.roomState);
                state.roomSubscribers.forEach((callback) => callback(payload));
            };

            const emitGameState = () => {
                const payload = clone(state.gameState);
                state.gameSubscribers.forEach((callback) => callback(payload));
            };

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

                    if (state.autoEmitGameState) {
                        emitGameState();
                    }

                    return { success: true };
                },
                subscribeToGameState(callback) {
                    state.gameSubscribers.add(callback);

                    if (state.autoEmitGameState) {
                        callback(clone(state.gameState));
                    }

                    return () => {
                        state.gameSubscribers.delete(callback);
                    };
                },
                subscribeToRoom(callback) {
                    state.roomSubscribers.add(callback);
                    callback(clone(state.roomState));
                    return () => {
                        state.roomSubscribers.delete(callback);
                    };
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
        {
            roomCode,
            gridSize,
            partyMode,
            autoEmitGameState,
        }
    );
}

export async function installSharedMockMultiplayer(
    page,
    {
        sessionId,
        defaultPlayerName,
        roomCode = 'ABC123',
        gridSize = 5,
        partyMode = true,
        resetSharedState = false,
    }
) {
    await page.evaluate(
        ({
            sessionId: initialSessionId,
            defaultPlayerName: initialPlayerName,
            roomCode: initialRoomCode,
            gridSize: initialGridSize,
            partyMode: initialPartyMode,
            resetSharedState: shouldResetSharedState,
            storageKey,
            palette,
        }) => {
            const clone = (value) => {
                if (value == null) {
                    return value;
                }

                return JSON.parse(JSON.stringify(value));
            };

            const roomSubscribers = new Set();
            const gameSubscribers = new Set();
            const connectionStateListeners = new Set();
            let currentRoomId = null;
            let connectionState = 'connected';
            let connectionTransitions = [];
            let roomDeliveries = [];
            let gameDeliveries = [];
            let leaveRoomCalls = 0;
            let lastDeliveredGameState = null;
            let lastDeliveredRoomState = null;
            let deliveryGeneration = 0;
            let transportConfig = {
                roomDeliveryDelayMs: 0,
                gameDeliveryDelayMs: 0,
                snapshotDelayMs: 0,
            };

            const ensureSharedState = () => {
                const parsed = JSON.parse(localStorage.getItem(storageKey) || '{"rooms":{}}');

                if (!parsed.rooms || typeof parsed.rooms !== 'object') {
                    parsed.rooms = {};
                }

                return parsed;
            };

            const writeSharedState = (sharedState) => {
                localStorage.setItem(storageKey, JSON.stringify(sharedState));
            };

            const getRoomByCode = (sharedState, code) => {
                const normalizedCode = code.toUpperCase();
                return Object.values(sharedState.rooms).find(
                    (room) => room.roomCode === normalizedCode
                );
            };

            const getActiveRoom = (sharedState = ensureSharedState()) => {
                if (!currentRoomId) {
                    return null;
                }

                return sharedState.rooms[currentRoomId] || null;
            };

            const toRoomPayload = (room) => {
                if (!room) {
                    return null;
                }

                const { gameState, ...roomState } = room;
                return clone(roomState);
            };

            const getLocalPlayer = (room) => {
                if (!room) {
                    return null;
                }

                return room.players.find((player) => player.sessionId === initialSessionId) || null;
            };

            const createDeliveryEntry = ({
                kind,
                roomPayload = null,
                gamePayload = null,
                source = 'unknown',
                scheduledAt = null,
                configuredDelayMs = 0,
            }) => ({
                kind,
                source,
                scheduledAt,
                configuredDelayMs,
                deliveredAt: Date.now(),
                connectionState,
                roomStatus: roomPayload?.status || gamePayload?.room?.status || null,
                currentPlayerIndex: gamePayload?.room?.currentPlayerIndex ?? null,
                lineCount: gamePayload?.lines?.length || 0,
                squareCount: gamePayload?.squares?.length || 0,
            });

            const recordRoomDelivery = (roomPayload, metadata = {}) => {
                roomDeliveries.push(
                    createDeliveryEntry({
                        kind: 'room',
                        roomPayload,
                        ...metadata,
                    })
                );
            };

            const recordGameDelivery = (gamePayload, metadata = {}) => {
                gameDeliveries.push(
                    createDeliveryEntry({
                        kind: 'game',
                        gamePayload,
                        ...metadata,
                    })
                );
            };

            const waitForTransportDelay = (delayMs) => {
                if (!delayMs || delayMs <= 0) {
                    return Promise.resolve();
                }

                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, delayMs);
                });
            };

            const dispatchRoomPayload = async (roomPayload, { source = 'notify' } = {}) => {
                const scheduledAt = Date.now();
                await waitForTransportDelay(transportConfig.roomDeliveryDelayMs);

                if (connectionState !== 'connected') {
                    return;
                }

                lastDeliveredRoomState = clone(roomPayload);
                recordRoomDelivery(roomPayload, {
                    source,
                    scheduledAt,
                    configuredDelayMs: transportConfig.roomDeliveryDelayMs,
                });
                roomSubscribers.forEach((callback) => callback(roomPayload));
            };

            const dispatchGamePayload = async (gamePayload, { source = 'notify' } = {}) => {
                const scheduledAt = Date.now();
                await waitForTransportDelay(transportConfig.gameDeliveryDelayMs);

                if (connectionState !== 'connected') {
                    return;
                }

                lastDeliveredGameState = clone(gamePayload);
                recordGameDelivery(gamePayload, {
                    source,
                    scheduledAt,
                    configuredDelayMs: transportConfig.gameDeliveryDelayMs,
                });
                gameSubscribers.forEach((callback) => callback(gamePayload));
            };

            const getSquareKeysCompletedByLine = (existingLines, lineKey, gridSize) => {
                const parseDot = (value) => {
                    const [row, col] = value.split(',').map(Number);
                    return { row, col };
                };

                const getLineKey = (dot1, dot2) => {
                    const [first, second] = [dot1, dot2].sort((a, b) =>
                        a.row === b.row ? a.col - b.col : a.row - b.row
                    );

                    return `${first.row},${first.col}-${second.row},${second.col}`;
                };

                const [rawStart, rawEnd] = lineKey.split('-');
                const start = parseDot(rawStart);
                const end = parseDot(rawEnd);
                const normalizedLines = new Set(existingLines);
                normalizedLines.add(lineKey);

                const completedSquares = [];
                const isHorizontal = start.row === end.row;

                const maybeAddCompletedSquare = (row, col) => {
                    if (row < 0 || col < 0 || row >= gridSize - 1 || col >= gridSize - 1) {
                        return;
                    }

                    const squareKey = `${row},${col}`;
                    const top = getLineKey({ row, col }, { row, col: col + 1 });
                    const bottom = getLineKey(
                        { row: row + 1, col },
                        { row: row + 1, col: col + 1 }
                    );
                    const left = getLineKey({ row, col }, { row: row + 1, col });
                    const right = getLineKey(
                        { row, col: col + 1 },
                        { row: row + 1, col: col + 1 }
                    );

                    if (
                        normalizedLines.has(top) &&
                        normalizedLines.has(bottom) &&
                        normalizedLines.has(left) &&
                        normalizedLines.has(right)
                    ) {
                        completedSquares.push(squareKey);
                    }
                };

                if (isHorizontal) {
                    maybeAddCompletedSquare(start.row - 1, Math.min(start.col, end.col));
                    maybeAddCompletedSquare(start.row, Math.min(start.col, end.col));
                } else {
                    maybeAddCompletedSquare(Math.min(start.row, end.row), start.col - 1);
                    maybeAddCompletedSquare(Math.min(start.row, end.row), start.col);
                }

                return completedSquares;
            };

            const createPlayer = ({
                name,
                sessionId,
                playerIndex,
                isHost = false,
                isReady = false,
            }) => ({
                _id: `player_${sessionId}`,
                color: palette[playerIndex % palette.length],
                isConnected: true,
                isReady,
                name,
                playerIndex,
                playerNumber: playerIndex + 1,
                sessionId,
                isHost,
            });

            const notifySubscribers = (source = 'notify') => {
                if (connectionState !== 'connected') {
                    return;
                }

                const sharedState = ensureSharedState();
                const room = getActiveRoom(sharedState);
                const roomPayload = toRoomPayload(room);
                const gamePayload = clone(room?.gameState || null);
                deliveryGeneration += 1;

                void dispatchRoomPayload(roomPayload, { source });

                if (gamePayload) {
                    void dispatchGamePayload(gamePayload, { source });
                }
            };

            const setConnectionState = (nextState) => {
                if (connectionState === nextState) {
                    return;
                }

                const previousState = connectionState;
                connectionState = nextState;
                if (nextState !== 'connected') {
                    deliveryGeneration += 1;
                }
                connectionTransitions.push({
                    from: previousState,
                    to: nextState,
                    timestamp: Date.now(),
                });
                connectionStateListeners.forEach((listener) => listener(nextState, previousState));

                if (nextState === 'connected') {
                    notifySubscribers('reconnect');
                }
            };

            if (shouldResetSharedState) {
                localStorage.removeItem(storageKey);
            }

            window.addEventListener('storage', (event) => {
                if (event.key === storageKey) {
                    notifySubscribers();
                }
            });

            window.__shapeKeeperSharedTest = {
                configureTransport(nextConfig = {}) {
                    transportConfig = {
                        ...transportConfig,
                        ...Object.fromEntries(
                            Object.entries(nextConfig).map(([key, value]) => [
                                key,
                                Number.isFinite(value) && value >= 0 ? value : 0,
                            ])
                        ),
                    };

                    return clone(transportConfig);
                },
                getSnapshot() {
                    const sharedState = ensureSharedState();
                    return {
                        connectionTransitions: clone(connectionTransitions),
                        connectionState,
                        currentRoomId,
                        gameDeliveries: clone(gameDeliveries),
                        lastDeliveredGameState: clone(lastDeliveredGameState),
                        lastDeliveredRoomState: clone(lastDeliveredRoomState),
                        leaveRoomCalls,
                        roomDeliveries: clone(roomDeliveries),
                        room: clone(getActiveRoom(sharedState)),
                        rooms: clone(sharedState.rooms),
                        sessionId: initialSessionId,
                        transportConfig: clone(transportConfig),
                    };
                },
                seedActiveMatchState({
                    lines = [],
                    playerScores = [0, 0],
                    currentPlayerIndex = 0,
                    squares = [],
                } = {}) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);

                    if (!room) {
                        return null;
                    }

                    room.status = 'playing';
                    room.updatedAt = Date.now();
                    room.gameState = {
                        lines: clone(lines),
                        players: room.players.slice(0, 2).map((player, index) => ({
                            playerIndex: index,
                            score: playerScores[index] || 0,
                        })),
                        room: {
                            currentPlayerIndex,
                            status: 'playing',
                            updatedAt: room.updatedAt,
                        },
                        squares: clone(squares),
                    };

                    writeSharedState(sharedState);
                    notifySubscribers('seed');

                    return clone(room.gameState);
                },
                setConnectionState,
            };

            window.ShapeKeeperConvex = {
                async createRoom(playerName, requestedGridSize, requestedPartyMode) {
                    const sharedState = ensureSharedState();
                    const normalizedCode = initialRoomCode.toUpperCase();
                    const roomId = `room_${normalizedCode}`;

                    sharedState.rooms[roomId] = {
                        roomId,
                        roomCode: normalizedCode,
                        gridSize: requestedGridSize || initialGridSize,
                        hostPlayerId: initialSessionId,
                        partyMode: requestedPartyMode ?? initialPartyMode,
                        players: [
                            createPlayer({
                                name: playerName || initialPlayerName,
                                sessionId: initialSessionId,
                                playerIndex: 0,
                                isHost: true,
                            }),
                        ],
                        status: 'lobby',
                        updatedAt: Date.now(),
                        gameState: null,
                    };

                    currentRoomId = roomId;
                    writeSharedState(sharedState);
                    notifySubscribers('create-room');

                    return { roomCode: normalizedCode, roomId };
                },
                async getGameState() {
                    await waitForTransportDelay(transportConfig.snapshotDelayMs);

                    if (connectionState !== 'connected') {
                        return null;
                    }

                    return clone(getActiveRoom()?.gameState || null);
                },
                getConnectionState() {
                    return connectionState;
                },
                getCurrentRoomId() {
                    return currentRoomId;
                },
                getSessionId() {
                    return initialSessionId;
                },
                async joinRoom(joinCode, playerName) {
                    const sharedState = ensureSharedState();
                    const room = getRoomByCode(sharedState, joinCode);

                    if (!room) {
                        return { error: 'Room not found' };
                    }

                    const existingPlayer = room.players.find(
                        (player) => player.sessionId === initialSessionId
                    );

                    if (existingPlayer) {
                        currentRoomId = room.roomId;
                        return { playerId: existingPlayer._id, roomId: room.roomId };
                    }

                    const playerIndex = room.players.length;
                    const nextPlayer = createPlayer({
                        name: playerName || initialPlayerName,
                        sessionId: initialSessionId,
                        playerIndex,
                    });

                    room.players.push(nextPlayer);
                    room.updatedAt = Date.now();
                    currentRoomId = room.roomId;
                    writeSharedState(sharedState);
                    notifySubscribers('join-room');

                    return { playerId: nextPlayer._id, roomId: room.roomId };
                },
                async leaveRoom() {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);

                    leaveRoomCalls += 1;

                    if (room) {
                        if (room.status === 'playing') {
                            room.players = room.players.map((player) =>
                                player.sessionId === initialSessionId
                                    ? { ...player, isConnected: false }
                                    : player
                            );

                            const remainingConnectedPlayers = room.players
                                .filter(
                                    (player) =>
                                        player.sessionId !== initialSessionId &&
                                        player.isConnected !== false
                                )
                                .sort((a, b) => a.playerIndex - b.playerIndex);

                            const leavingPlayer = room.players.find(
                                (player) => player.sessionId === initialSessionId
                            );

                            const nextTurnPlayer =
                                remainingConnectedPlayers.find(
                                    (player) =>
                                        player.playerIndex > (leavingPlayer?.playerIndex ?? -1)
                                ) || remainingConnectedPlayers[0] || null;

                            if (room.hostPlayerId === initialSessionId && remainingConnectedPlayers[0]) {
                                room.hostPlayerId = remainingConnectedPlayers[0].sessionId;
                            }

                            if (
                                room.gameState?.room?.currentPlayerIndex ===
                                    leavingPlayer?.playerIndex &&
                                nextTurnPlayer
                            ) {
                                room.gameState.room.currentPlayerIndex = nextTurnPlayer.playerIndex;
                            }

                            room.updatedAt = Date.now();

                            if (room.gameState?.room) {
                                room.gameState.room.updatedAt = room.updatedAt;
                            }
                        } else {
                            room.players = room.players.filter(
                                (player) => player.sessionId !== initialSessionId
                            );

                            if (room.players.length === 0) {
                                delete sharedState.rooms[room.roomId];
                            } else {
                                if (room.hostPlayerId === initialSessionId) {
                                    room.hostPlayerId = room.players[0].sessionId;
                                }

                                room.players = room.players.map((player, index) => ({
                                    ...player,
                                    playerIndex: index,
                                    playerNumber: index + 1,
                                }));
                                room.updatedAt = Date.now();
                            }
                        }
                    }

                    currentRoomId = null;
                    writeSharedState(sharedState);
                    notifySubscribers('leave-room');

                    return { success: true };
                },
                onConnectionStateChange(listener) {
                    connectionStateListeners.add(listener);
                    listener(connectionState, connectionState);
                    return () => {
                        connectionStateListeners.delete(listener);
                    };
                },
                async startGame() {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);

                    if (!room) {
                        return { error: 'Not in a room' };
                    }

                    room.status = 'playing';
                    room.updatedAt = Date.now();
                    room.gameState = {
                        lines: [],
                        players: room.players.slice(0, 2).map((player, index) => ({
                            playerIndex: index,
                            score: 0,
                        })),
                        room: {
                            currentPlayerIndex: 0,
                            status: 'playing',
                            updatedAt: room.updatedAt,
                        },
                        squares: [],
                    };

                    writeSharedState(sharedState);
                    notifySubscribers('start-game');

                    return { success: true };
                },
                async drawLine(lineKey) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);

                    if (!room) {
                        return { error: 'Not in a room' };
                    }

                    if (!room.gameState) {
                        return { error: 'Game has not started' };
                    }

                    const player = getLocalPlayer(room);
                    if (!player || player.playerIndex > 1) {
                        return { error: 'Player not found' };
                    }

                    if (room.gameState.room.currentPlayerIndex !== player.playerIndex) {
                        return { error: 'Not your turn' };
                    }

                    const existingLines = room.gameState.lines || [];
                    if (existingLines.some((line) => line.lineKey === lineKey)) {
                        return { error: 'Line already drawn' };
                    }

                    const completedSquareKeys = getSquareKeysCompletedByLine(
                        existingLines.map((line) => line.lineKey),
                        lineKey,
                        room.gridSize
                    ).filter(
                        (squareKey) =>
                            !(room.gameState.squares || []).some(
                                (square) => square.squareKey === squareKey
                            )
                    );

                    room.gameState.lines = [
                        ...existingLines,
                        {
                            lineKey,
                            playerIndex: player.playerIndex,
                        },
                    ];

                    if (completedSquareKeys.length > 0) {
                        room.gameState.squares = [
                            ...(room.gameState.squares || []),
                            ...completedSquareKeys.map((squareKey) => ({
                                squareKey,
                                playerIndex: player.playerIndex,
                            })),
                        ];

                        room.gameState.players = (room.gameState.players || []).map((entry) =>
                            entry.playerIndex === player.playerIndex
                                ? {
                                      ...entry,
                                      score: entry.score + completedSquareKeys.length,
                                  }
                                : entry
                        );
                    } else {
                        room.gameState.room.currentPlayerIndex = player.playerIndex === 0 ? 1 : 0;
                    }

                    room.updatedAt = Date.now();
                    room.gameState.room.status = room.status;
                    room.gameState.room.updatedAt = room.updatedAt;

                    writeSharedState(sharedState);
                    notifySubscribers('draw-line');

                    return {
                        success: true,
                        completedSquares: completedSquareKeys.length,
                        completedTriangles: 0,
                        keepTurn: completedSquareKeys.length > 0,
                    };
                },
                subscribeToGameState(callback) {
                    gameSubscribers.add(callback);

                    const gameState = clone(getActiveRoom()?.gameState || null);
                    if (gameState) {
                        void dispatchGamePayload(gameState, { source: 'subscribe-game' });
                    }

                    return () => {
                        gameSubscribers.delete(callback);
                    };
                },
                subscribeToRoom(callback) {
                    roomSubscribers.add(callback);
                    const roomPayload = toRoomPayload(getActiveRoom());
                    void dispatchRoomPayload(roomPayload, { source: 'subscribe-room' });
                    return () => {
                        roomSubscribers.delete(callback);
                    };
                },
                async toggleReady() {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);

                    if (!room) {
                        return { error: 'Not in a room' };
                    }

                    const player = room.players.find(
                        (entry) => entry.sessionId === initialSessionId
                    );

                    if (!player) {
                        return { error: 'Player not found' };
                    }

                    player.isReady = !player.isReady;
                    room.updatedAt = Date.now();
                    writeSharedState(sharedState);
                    notifySubscribers('toggle-ready');

                    return { isReady: player.isReady };
                },
                async updateGridSize(nextGridSize) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);

                    if (!room) {
                        return { error: 'Not in a room' };
                    }

                    room.gridSize = nextGridSize;
                    room.updatedAt = Date.now();
                    writeSharedState(sharedState);
                    notifySubscribers('update-grid-size');

                    return { success: true };
                },
                async updatePartyMode(nextPartyMode) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);

                    if (!room) {
                        return { error: 'Not in a room' };
                    }

                    room.partyMode = nextPartyMode;
                    room.updatedAt = Date.now();
                    writeSharedState(sharedState);
                    notifySubscribers('update-party-mode');

                    return { success: true };
                },
                async updatePlayer(updates) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);

                    if (!room) {
                        return { error: 'Not in a room' };
                    }

                    const player = room.players.find(
                        (entry) => entry.sessionId === initialSessionId
                    );

                    if (!player) {
                        return { error: 'Player not found' };
                    }

                    if (updates.name) {
                        player.name = updates.name;
                    }

                    if (updates.color) {
                        player.color = updates.color;
                    }

                    room.updatedAt = Date.now();
                    writeSharedState(sharedState);
                    notifySubscribers('update-player');

                    return { success: true };
                },
            };
        },
        {
            sessionId,
            defaultPlayerName,
            roomCode,
            gridSize,
            partyMode,
            resetSharedState,
            storageKey: SHARED_BACKEND_STORAGE_KEY,
            palette: DEFAULT_SHARED_COLORS,
        }
    );
}

export async function createSharedMockMultiplayerPages(
    browser,
    { roomCode = 'ABC123', gridSize = 5, partyMode = true, startupTimeoutMs = 1000 } = {}
) {
    const context = await browser.newContext();
    const hostPage = await context.newPage();
    const guestPage = await context.newPage();

    await gotoApp(hostPage, { startupTimeoutMs });
    await gotoApp(guestPage, { startupTimeoutMs });

    await installSharedMockMultiplayer(hostPage, {
        sessionId: 'session_host',
        defaultPlayerName: 'Host',
        roomCode,
        gridSize,
        partyMode,
        resetSharedState: true,
    });

    await installSharedMockMultiplayer(guestPage, {
        sessionId: 'session_guest',
        defaultPlayerName: 'Guest',
        roomCode,
        gridSize,
        partyMode,
    });

    return {
        context,
        guestPage,
        hostPage,
        async cleanup() {
            await context.close();
        },
    };
}
