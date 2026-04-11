const SHARED_BACKEND_STORAGE_KEY = '__shapekeeper_e2e_shared_backend__';
const DEFAULT_SHARED_COLORS = ['#ff0000', '#0000ff', '#00ff00', '#ff8c00', '#8b00ff', '#00ffff'];

export async function installSharedMockMultiplayer(
    page,
    {
        sessionId,
        defaultPlayerName,
        roomCode = 'ABC123',
        gridSize = 5,
        partyMode = false,
        trianglesEnabled = false,
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
            trianglesEnabled: initialTrianglesEnabled,
            resetSharedState: shouldResetSharedState,
            storageKey,
            palette,
        }) => {
            const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
            const roomSubscribers = new Set();
            const gameSubscribers = new Set();
            const connectionStateListeners = new Set();
            let currentRoomId = null;
            let connectionState = 'connected';
            let connectionTransitions = [];
            let roomDeliveries = [];
            let gameDeliveries = [];
            let droppedRoomDeliveries = [];
            let droppedGameDeliveries = [];
            let leaveRoomCalls = 0;
            let lastDeliveredGameState = null;
            let lastDeliveredRoomState = null;
            let deliveryGeneration = 0;
            let transportConfig = {
                roomDeliveryDelayMs: 0,
                gameDeliveryDelayMs: 0,
                snapshotDelayMs: 0,
            };

            const waitFor = (ms) =>
                ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
            const ensureSharedState = () => {
                const parsed = JSON.parse(localStorage.getItem(storageKey) || '{"rooms":{}}');
                if (!parsed.rooms || typeof parsed.rooms !== 'object') parsed.rooms = {};
                return parsed;
            };
            const writeSharedState = (sharedState) =>
                localStorage.setItem(storageKey, JSON.stringify(sharedState));
            const getRoomByCode = (sharedState, code) =>
                Object.values(sharedState.rooms).find(
                    (room) => room.roomCode === code.toUpperCase()
                );
            const getActiveRoom = (sharedState = ensureSharedState()) =>
                currentRoomId ? sharedState.rooms[currentRoomId] || null : null;
            const toRoomPayload = (room) => {
                if (!room) return null;
                const roomState = { ...room };
                delete roomState.gameState;
                return clone(roomState);
            };
            const getLocalPlayer = (room) =>
                room?.players.find((player) => player.sessionId === initialSessionId) || null;
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
                isHost,
                isReady,
                name,
                playerIndex,
                playerNumber: playerIndex + 1,
                sessionId,
            });
            const createDeliveryEntry = ({
                kind,
                roomPayload = null,
                gamePayload = null,
                source = 'unknown',
                scheduledAt = null,
                configuredDelayMs = 0,
                reason = null,
            }) => ({
                kind,
                source,
                scheduledAt,
                configuredDelayMs,
                reason,
                deliveredAt: Date.now(),
                connectionState,
                roomStatus: roomPayload?.status || gamePayload?.room?.status || null,
                currentPlayerIndex: gamePayload?.room?.currentPlayerIndex ?? null,
                lineCount: gamePayload?.lines?.length || 0,
                squareCount: gamePayload?.squares?.length || 0,
                triangleCount: gamePayload?.triangles?.length || 0,
            });
            const record = (bucket, kind, payload, metadata = {}) => {
                bucket.push(
                    createDeliveryEntry({
                        kind,
                        ...(kind === 'room' ? { roomPayload: payload } : { gamePayload: payload }),
                        ...metadata,
                    })
                );
            };
            const dispatch = async (kind, payload, { source = 'notify' } = {}) => {
                const scheduledAt = Date.now();
                const generation = deliveryGeneration;
                const delayMs =
                    kind === 'room'
                        ? transportConfig.roomDeliveryDelayMs
                        : transportConfig.gameDeliveryDelayMs;
                await waitFor(delayMs);
                if (connectionState !== 'connected') {
                    record(
                        kind === 'room' ? droppedRoomDeliveries : droppedGameDeliveries,
                        kind,
                        payload,
                        {
                            source,
                            scheduledAt,
                            configuredDelayMs: delayMs,
                            reason: 'disconnected_before_delivery',
                        }
                    );
                    return;
                }
                if (generation !== deliveryGeneration) {
                    record(
                        kind === 'room' ? droppedRoomDeliveries : droppedGameDeliveries,
                        kind,
                        payload,
                        {
                            source,
                            scheduledAt,
                            configuredDelayMs: delayMs,
                            reason: 'stale_generation',
                        }
                    );
                    return;
                }
                if (kind === 'room') {
                    lastDeliveredRoomState = clone(payload);
                    record(roomDeliveries, kind, payload, {
                        source,
                        scheduledAt,
                        configuredDelayMs: delayMs,
                    });
                    roomSubscribers.forEach((callback) => callback(payload));
                    return;
                }
                lastDeliveredGameState = clone(payload);
                record(gameDeliveries, kind, payload, {
                    source,
                    scheduledAt,
                    configuredDelayMs: delayMs,
                });
                gameSubscribers.forEach((callback) => callback(payload));
            };
            const getSquareKeysCompletedByLine = (existingLineKeys, lineKey, size) => {
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
                const normalizedLines = new Set(existingLineKeys);
                normalizedLines.add(lineKey);
                const completedSquares = [];
                const maybeAdd = (row, col) => {
                    if (row < 0 || col < 0 || row >= size - 1 || col >= size - 1) return;
                    const top = getLineKey({ row, col }, { row, col: col + 1 });
                    const bottom = getLineKey(
                        { row: row + 1, col },
                        { row: row + 1, col: col + 1 }
                    );
                    const left = getLineKey({ row, col }, { row: row + 1, col });
                    const right = getLineKey({ row, col: col + 1 }, { row: row + 1, col: col + 1 });
                    if (
                        normalizedLines.has(top) &&
                        normalizedLines.has(bottom) &&
                        normalizedLines.has(left) &&
                        normalizedLines.has(right)
                    ) {
                        completedSquares.push(`${row},${col}`);
                    }
                };
                if (start.row === end.row) {
                    maybeAdd(start.row - 1, Math.min(start.col, end.col));
                    maybeAdd(start.row, Math.min(start.col, end.col));
                } else {
                    maybeAdd(Math.min(start.row, end.row), start.col - 1);
                    maybeAdd(Math.min(start.row, end.row), start.col);
                }
                return completedSquares;
            };
            const notifySubscribers = (source = 'notify') => {
                if (connectionState !== 'connected') return;
                const room = getActiveRoom();
                const roomPayload = toRoomPayload(room);
                const gamePayload = clone(room?.gameState || null);
                deliveryGeneration += 1;
                void dispatch('room', roomPayload, { source });
                if (gamePayload) void dispatch('game', gamePayload, { source });
            };
            const setConnectionState = (nextState) => {
                if (connectionState === nextState) return;
                const previousState = connectionState;
                connectionState = nextState;
                if (nextState !== 'connected') deliveryGeneration += 1;
                connectionTransitions.push({
                    from: previousState,
                    to: nextState,
                    timestamp: Date.now(),
                });
                connectionStateListeners.forEach((listener) => listener(nextState, previousState));
                if (nextState === 'connected') notifySubscribers('reconnect');
            };

            if (shouldResetSharedState) localStorage.removeItem(storageKey);
            window.addEventListener('storage', (event) => {
                if (event.key === storageKey) notifySubscribers();
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
                        deliveryGeneration,
                        droppedGameDeliveries: clone(droppedGameDeliveries),
                        droppedRoomDeliveries: clone(droppedRoomDeliveries),
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
                    triangles = [],
                } = {}) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);
                    if (!room) return null;
                    room.status = 'playing';
                    room.updatedAt = Date.now();
                    room.gameState = {
                        lines: clone(lines),
                        players: room.players.slice(0, 2).map((player, index) => ({
                            playerIndex: index,
                            score: playerScores[index] || 0,
                        })),
                        room: { currentPlayerIndex, status: 'playing', updatedAt: room.updatedAt },
                        squares: clone(squares),
                        triangles: clone(triangles),
                    };
                    writeSharedState(sharedState);
                    notifySubscribers('seed');
                    return clone(room.gameState);
                },
                rebroadcastCurrentState(source = 'notify') {
                    notifySubscribers(source);
                    return true;
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
                        trianglesEnabled: initialTrianglesEnabled,
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
                    await waitFor(transportConfig.snapshotDelayMs);
                    return connectionState === 'connected'
                        ? clone(getActiveRoom()?.gameState || null)
                        : null;
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
                    if (!room) return { error: 'Room not found' };
                    const existingPlayer = room.players.find(
                        (player) => player.sessionId === initialSessionId
                    );
                    if (existingPlayer) {
                        currentRoomId = room.roomId;
                        return { playerId: existingPlayer._id, roomId: room.roomId };
                    }
                    const nextPlayer = createPlayer({
                        name: playerName || initialPlayerName,
                        sessionId: initialSessionId,
                        playerIndex: room.players.length,
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
                            const leavingPlayer = room.players.find(
                                (player) => player.sessionId === initialSessionId
                            );
                            const remainingConnectedPlayers = room.players
                                .filter(
                                    (player) =>
                                        player.sessionId !== initialSessionId &&
                                        player.isConnected !== false
                                )
                                .sort((a, b) => a.playerIndex - b.playerIndex);
                            const nextTurnPlayer =
                                remainingConnectedPlayers.find(
                                    (player) =>
                                        player.playerIndex > (leavingPlayer?.playerIndex ?? -1)
                                ) ||
                                remainingConnectedPlayers[0] ||
                                null;
                            if (
                                room.hostPlayerId === initialSessionId &&
                                remainingConnectedPlayers[0]
                            )
                                room.hostPlayerId = remainingConnectedPlayers[0].sessionId;
                            if (
                                room.gameState?.room?.currentPlayerIndex ===
                                    leavingPlayer?.playerIndex &&
                                nextTurnPlayer
                            ) {
                                room.gameState.room.currentPlayerIndex = nextTurnPlayer.playerIndex;
                            }
                            room.updatedAt = Date.now();
                            if (room.gameState?.room)
                                room.gameState.room.updatedAt = room.updatedAt;
                        } else {
                            room.players = room.players.filter(
                                (player) => player.sessionId !== initialSessionId
                            );
                            if (room.players.length === 0) {
                                delete sharedState.rooms[room.roomId];
                            } else {
                                if (room.hostPlayerId === initialSessionId)
                                    room.hostPlayerId = room.players[0].sessionId;
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
                    return () => connectionStateListeners.delete(listener);
                },
                async startGame() {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);
                    if (!room) return { error: 'Not in a room' };
                    room.status = 'playing';
                    room.updatedAt = Date.now();
                    room.gameState = {
                        lines: [],
                        players: room.players
                            .slice(0, 2)
                            .map((player, index) => ({ playerIndex: index, score: 0 })),
                        triangles: [],
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
                    if (!room) return { error: 'Not in a room' };
                    if (!room.gameState) return { error: 'Game has not started' };
                    const player = getLocalPlayer(room);
                    if (!player || player.playerIndex > 1) return { error: 'Player not found' };
                    if (room.gameState.room.currentPlayerIndex !== player.playerIndex)
                        return { error: 'Not your turn' };
                    const existingLines = room.gameState.lines || [];
                    if (existingLines.some((line) => line.lineKey === lineKey))
                        return { error: 'Line already drawn' };
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
                    const completedTriangleKeys = [];
                    if (room.trianglesEnabled === true) {
                        const parseDot = (value) => {
                            const [row, col] = value.split(',').map(Number);
                            return { row, col };
                        };
                        const buildTriangleKey = (vertices) => {
                            const sortedVertices = [...vertices].sort((a, b) =>
                                a.row === b.row ? a.col - b.col : a.row - b.row
                            );
                            return `tri-${sortedVertices[0].row},${sortedVertices[0].col}-${sortedVertices[1].row},${sortedVertices[1].col}-${sortedVertices[2].row},${sortedVertices[2].col}`;
                        };
                        const [rawStart, rawEnd] = lineKey.split('-');
                        const start = parseDot(rawStart);
                        const end = parseDot(rawEnd);
                        const lineSet = new Set([
                            ...existingLines.map((line) => line.lineKey),
                            lineKey,
                        ]);
                        const potentialTriangles = [];
                        if (Math.abs(start.row - end.row) === 1 && Math.abs(start.col - end.col) === 1) {
                            const row = Math.min(start.row, end.row);
                            const col = Math.min(start.col, end.col);
                            const isTLtoBR =
                                (start.row < end.row && start.col < end.col) ||
                                (end.row < start.row && end.col < start.col);

                            if (isTLtoBR) {
                                potentialTriangles.push([
                                    { row, col },
                                    { row, col: col + 1 },
                                    { row: row + 1, col: col + 1 },
                                ]);
                                potentialTriangles.push([
                                    { row, col },
                                    { row: row + 1, col },
                                    { row: row + 1, col: col + 1 },
                                ]);
                            } else {
                                potentialTriangles.push([
                                    { row, col },
                                    { row, col: col + 1 },
                                    { row: row + 1, col },
                                ]);
                                potentialTriangles.push([
                                    { row, col: col + 1 },
                                    { row: row + 1, col },
                                    { row: row + 1, col: col + 1 },
                                ]);
                            }
                        } else if (start.row === end.row) {
                            const row = start.row;
                            const col = Math.min(start.col, end.col);
                            if (row > 0 && col > 0)
                                potentialTriangles.push([
                                    { row: row - 1, col: col - 1 },
                                    { row: row - 1, col },
                                    { row, col: col - 1 },
                                ]);
                            if (row > 0 && col < room.gridSize - 1)
                                potentialTriangles.push([
                                    { row: row - 1, col },
                                    { row: row - 1, col: col + 1 },
                                    { row, col: col + 1 },
                                ]);
                            if (row < room.gridSize - 1 && col > 0)
                                potentialTriangles.push([
                                    { row, col: col - 1 },
                                    { row: row + 1, col: col - 1 },
                                    { row: row + 1, col },
                                ]);
                            if (row < room.gridSize - 1 && col < room.gridSize - 1)
                                potentialTriangles.push([
                                    { row, col: col + 1 },
                                    { row: row + 1, col },
                                    { row: row + 1, col: col + 1 },
                                ]);
                        } else {
                            const row = Math.min(start.row, end.row);
                            const col = start.col;
                            if (col > 0 && row > 0)
                                potentialTriangles.push([
                                    { row: row - 1, col: col - 1 },
                                    { row: row - 1, col },
                                    { row, col: col - 1 },
                                ]);
                            if (col > 0 && row < room.gridSize - 1)
                                potentialTriangles.push([
                                    { row, col: col - 1 },
                                    { row: row + 1, col: col - 1 },
                                    { row: row + 1, col },
                                ]);
                            if (col < room.gridSize - 1 && row > 0)
                                potentialTriangles.push([
                                    { row: row - 1, col },
                                    { row: row - 1, col: col + 1 },
                                    { row, col: col + 1 },
                                ]);
                            if (col < room.gridSize - 1 && row < room.gridSize - 1)
                                potentialTriangles.push([
                                    { row, col: col + 1 },
                                    { row: row + 1, col },
                                    { row: row + 1, col: col + 1 },
                                ]);
                        }

                        const existingTriangles = new Set(
                            (room.gameState.triangles || []).map((triangle) => triangle.triangleKey)
                        );

                        for (const vertices of potentialTriangles) {
                            const [first, second, third] = vertices;
                            const edge1 =
                                first.row < second.row ||
                                (first.row === second.row && first.col < second.col)
                                    ? `${first.row},${first.col}-${second.row},${second.col}`
                                    : `${second.row},${second.col}-${first.row},${first.col}`;
                            const edge2 =
                                second.row < third.row ||
                                (second.row === third.row && second.col < third.col)
                                    ? `${second.row},${second.col}-${third.row},${third.col}`
                                    : `${third.row},${third.col}-${second.row},${second.col}`;
                            const edge3 =
                                third.row < first.row ||
                                (third.row === first.row && third.col < first.col)
                                    ? `${third.row},${third.col}-${first.row},${first.col}`
                                    : `${first.row},${first.col}-${third.row},${third.col}`;
                            if (!lineSet.has(edge1) || !lineSet.has(edge2) || !lineSet.has(edge3)) {
                                continue;
                            }
                            const triangleKey = buildTriangleKey(vertices);
                            if (existingTriangles.has(triangleKey)) {
                                continue;
                            }
                            existingTriangles.add(triangleKey);
                            completedTriangleKeys.push(triangleKey);
                        }
                    }

                    room.gameState.lines = [
                        ...existingLines,
                        { lineKey, playerIndex: player.playerIndex },
                    ];
                    if (completedTriangleKeys.length > 0) {
                        room.gameState.triangles = [
                            ...(room.gameState.triangles || []),
                            ...completedTriangleKeys.map((triangleKey) => ({
                                triangleKey,
                                playerIndex: player.playerIndex,
                            })),
                        ];
                    }
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
                                ? { ...entry, score: entry.score + completedSquareKeys.length }
                                : entry
                        );
                    }
                    const completedShapeCount =
                        completedSquareKeys.length + completedTriangleKeys.length;
                    if (completedShapeCount > 0) {
                        room.gameState.players = (room.gameState.players || []).map((entry) =>
                            entry.playerIndex === player.playerIndex
                                ? { ...entry, score: entry.score + completedTriangleKeys.length }
                                : entry
                        );
                        room.gameState.room.currentPlayerIndex = player.playerIndex;
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
                        completedTriangles: completedTriangleKeys.length,
                        keepTurn: completedShapeCount > 0,
                    };
                },
                subscribeToGameState(callback) {
                    gameSubscribers.add(callback);
                    const gameState = clone(getActiveRoom()?.gameState || null);
                    if (gameState) void dispatch('game', gameState, { source: 'subscribe-game' });
                    return () => gameSubscribers.delete(callback);
                },
                subscribeToRoom(callback) {
                    roomSubscribers.add(callback);
                    void dispatch('room', toRoomPayload(getActiveRoom()), {
                        source: 'subscribe-room',
                    });
                    return () => roomSubscribers.delete(callback);
                },
                async toggleReady() {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);
                    const player = room?.players.find(
                        (entry) => entry.sessionId === initialSessionId
                    );
                    if (!room) return { error: 'Not in a room' };
                    if (!player) return { error: 'Player not found' };
                    player.isReady = !player.isReady;
                    room.updatedAt = Date.now();
                    writeSharedState(sharedState);
                    notifySubscribers('toggle-ready');
                    return { isReady: player.isReady };
                },
                async updateGridSize(nextGridSize) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);
                    if (!room) return { error: 'Not in a room' };
                    room.gridSize = nextGridSize;
                    room.updatedAt = Date.now();
                    writeSharedState(sharedState);
                    notifySubscribers('update-grid-size');
                    return { success: true };
                },
                async updatePartyMode(nextPartyMode) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);
                    if (!room) return { error: 'Not in a room' };
                    room.partyMode = nextPartyMode;
                    room.updatedAt = Date.now();
                    writeSharedState(sharedState);
                    notifySubscribers('update-party-mode');
                    return { success: true };
                },
                async updateTrianglesEnabled(nextTrianglesEnabled) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);
                    if (!room) return { error: 'Not in a room' };
                    room.trianglesEnabled = nextTrianglesEnabled === true;
                    room.updatedAt = Date.now();
                    writeSharedState(sharedState);
                    notifySubscribers('update-triangles-enabled');
                    return { success: true };
                },
                async updatePlayer(updates) {
                    const sharedState = ensureSharedState();
                    const room = getActiveRoom(sharedState);
                    const player = room?.players.find(
                        (entry) => entry.sessionId === initialSessionId
                    );
                    if (!room) return { error: 'Not in a room' };
                    if (!player) return { error: 'Player not found' };
                    if (updates.name) player.name = updates.name;
                    if (updates.color) player.color = updates.color;
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
            trianglesEnabled,
            resetSharedState,
            storageKey: SHARED_BACKEND_STORAGE_KEY,
            palette: DEFAULT_SHARED_COLORS,
        }
    );
}

export async function createSharedMockMultiplayerPages(
    browser,
    {
        roomCode = 'ABC123',
        gridSize = 5,
        partyMode = false,
        trianglesEnabled = false,
        startupTimeoutMs = 1000,
    } = {}
) {
    const { gotoApp } = await import('./bootstrap-app.js');
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
        trianglesEnabled,
        resetSharedState: true,
    });

    await installSharedMockMultiplayer(guestPage, {
        sessionId: 'session_guest',
        defaultPlayerName: 'Guest',
        roomCode,
        gridSize,
        partyMode,
        trianglesEnabled,
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
