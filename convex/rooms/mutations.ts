import { generateHostToken, hashToken } from '../auth/token';
import { generateSecureRoomCode, DEFAULT_COLORS } from './shared';
import { log, errorLog, warn } from '../log';

export async function createRoomHandler(ctx: any, args: any) {
    log('[createRoom] Starting room creation', {
        sessionId: args.sessionId,
        playerName: args.playerName,
        gridSize: args.gridSize,
        partyMode: args.partyMode,
    });

    let roomCode = generateSecureRoomCode();
    let existingRoom = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q: any) => q.eq('roomCode', roomCode))
        .first();

    let collisionCount = 0;
    while (existingRoom) {
        collisionCount++;
        log('[createRoom] Room code collision detected', { roomCode, collisionCount });
        roomCode = generateSecureRoomCode();
        existingRoom = await ctx.db
            .query('rooms')
            .withIndex('by_code', (q: any) => q.eq('roomCode', roomCode))
            .first();
    }

    const now = Date.now();
    const hostToken = generateHostToken();
    const hostTokenHash = await hashToken(hostToken);
    const roomId = await ctx.db.insert('rooms', {
        roomCode,
        hostPlayerId: args.sessionId,
        hostTokenHash: hostTokenHash ?? undefined,
        gridSize: args.gridSize,
        partyMode: args.partyMode !== false,
        status: 'lobby',
        currentPlayerIndex: 0,
        createdAt: now,
        updatedAt: now,
    });

    log('[createRoom] Room created successfully', { roomId, roomCode });

    await ctx.db.insert('players', {
        roomId,
        sessionId: args.sessionId,
        name: args.playerName,
        color: DEFAULT_COLORS[0],
        score: 0,
        isReady: false,
        isConnected: true,
        playerIndex: 0,
        joinedAt: now,
    });

    log('[createRoom] Host player added', { roomId, sessionId: args.sessionId });
    // The hostToken is shown ONCE. The browser must stash it in sessionStorage
    // and pass it on every host-gated mutation. The server only stores the
    // SHA-256 hash, so a leak of the room row cannot be used to forge host
    // actions.
    return { roomId, roomCode, hostToken };
}

export async function joinRoomHandler(ctx: any, args: any) {
    log('[joinRoom] Join request', {
        roomCode: args.roomCode,
        sessionId: args.sessionId,
        playerName: args.playerName,
    });

    const room = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q: any) => q.eq('roomCode', args.roomCode.toUpperCase()))
        .first();

    if (!room) {
        log('[joinRoom] Error: Room not found', { roomCode: args.roomCode });
        return { error: 'Room not found' };
    }

    log('[joinRoom] Room found', { roomId: room._id, status: room.status });

    if (room.status !== 'lobby') {
        log('[joinRoom] Error: Game already in progress', {
            roomId: room._id,
            status: room.status,
        });
        return { error: 'Game already in progress' };
    }

    const existingPlayer = await ctx.db
        .query('players')
        .withIndex('by_room_and_session', (q: any) =>
            q.eq('roomId', room._id).eq('sessionId', args.sessionId)
        )
        .first();

    if (existingPlayer) {
        log('[joinRoom] Player rejoining', {
            roomId: room._id,
            playerId: existingPlayer._id,
        });
        await ctx.db.patch(existingPlayer._id, {
            isConnected: true,
            name: args.playerName,
        });
        return { roomId: room._id, playerId: existingPlayer._id, rejoined: true };
    }

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
        .collect();

    log('[joinRoom] Current players', { roomId: room._id, playerCount: players.length });

    if (players.length >= 6) {
        log('[joinRoom] Error: Room is full', {
            roomId: room._id,
            playerCount: players.length,
        });
        return { error: 'Room is full (max 6 players)' };
    }

    const usedColors = new Set(players.map((player: any) => player.color));
    const availableColor =
        DEFAULT_COLORS.find((color) => !usedColors.has(color)) || DEFAULT_COLORS[0];
    const playerId = await ctx.db.insert('players', {
        roomId: room._id,
        sessionId: args.sessionId,
        name: args.playerName,
        color: availableColor,
        score: 0,
        isReady: false,
        isConnected: true,
        playerIndex: players.length,
        joinedAt: Date.now(),
    });

    log('[joinRoom] Player added successfully', {
        roomId: room._id,
        playerId,
        playerIndex: players.length,
        color: availableColor,
    });

    await ctx.db.patch(room._id, { updatedAt: Date.now() });
    return { roomId: room._id, playerId };
}

export async function leaveRoomHandler(ctx: any, args: any) {
    log('[leaveRoom] Leave request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
    });

    const player = await ctx.db
        .query('players')
        .withIndex('by_room_and_session', (q: any) =>
            q.eq('roomId', args.roomId).eq('sessionId', args.sessionId)
        )
        .first();

    if (!player) {
        log('[leaveRoom] Error: Player not found', {
            roomId: args.roomId,
            sessionId: args.sessionId,
        });
        return { error: 'Player not found' };
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        log('[leaveRoom] Error: Room not found', { roomId: args.roomId });
        return { error: 'Room not found' };
    }

    log('[leaveRoom] Processing leave', {
        roomId: args.roomId,
        playerId: player._id,
        roomStatus: room.status,
        isHost: room.hostPlayerId === args.sessionId,
    });

    if (room.status === 'playing') {
        const roomPlayers = await ctx.db
            .query('players')
            .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
            .collect();

        const remainingConnectedPlayers = roomPlayers
            .filter((entry: any) => entry.sessionId !== args.sessionId && entry.isConnected)
            .sort((a: any, b: any) => a.playerIndex - b.playerIndex);

        const nextTurnPlayer =
            remainingConnectedPlayers.find(
                (entry: any) => entry.playerIndex > player.playerIndex
            ) ||
            remainingConnectedPlayers[0] ||
            null;

        const roomUpdates: {
            updatedAt: number;
            currentPlayerIndex?: number;
            hostPlayerId?: string;
        } = {
            updatedAt: Date.now(),
        };

        if (room.hostPlayerId === args.sessionId && remainingConnectedPlayers.length > 0) {
            roomUpdates.hostPlayerId = remainingConnectedPlayers[0].sessionId;
        }

        if (room.currentPlayerIndex === player.playerIndex && nextTurnPlayer) {
            roomUpdates.currentPlayerIndex = nextTurnPlayer.playerIndex;
        }

        await ctx.db.patch(player._id, { isConnected: false });
        await ctx.db.patch(args.roomId, roomUpdates);

        log('[leaveRoom] In-match leave processed', {
            playerId: player._id,
            transferredHostTo: roomUpdates.hostPlayerId || null,
            transferredTurnTo: roomUpdates.currentPlayerIndex ?? null,
            remainingConnectedPlayers: remainingConnectedPlayers.length,
        });

        return {
            success: true,
            disconnected: true,
            transferredHostTo: roomUpdates.hostPlayerId || null,
            transferredTurnTo: roomUpdates.currentPlayerIndex ?? null,
        };
    }

    await ctx.db.delete(player._id);
    log('[leaveRoom] Player removed from lobby', { playerId: player._id });

    const remainingPlayers = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    log('[leaveRoom] Remaining players', { count: remainingPlayers.length });

    if (remainingPlayers.length === 0) {
        await ctx.db.delete(args.roomId);
        log('[leaveRoom] Room deleted (no remaining players)', { roomId: args.roomId });
        return { success: true, roomDeleted: true };
    }

    if (room.hostPlayerId === args.sessionId) {
        const newHost = remainingPlayers[0];
        await ctx.db.patch(args.roomId, {
            hostPlayerId: newHost.sessionId,
            updatedAt: Date.now(),
        });
        log('[leaveRoom] Host transferred', {
            oldHost: args.sessionId,
            newHost: newHost.sessionId,
        });
    }

    for (let index = 0; index < remainingPlayers.length; index++) {
        await ctx.db.patch(remainingPlayers[index]._id, { playerIndex: index });
    }

    log('[leaveRoom] Players reindexed', { count: remainingPlayers.length });
    return { success: true };
}

export async function toggleReadyHandler(ctx: any, args: any) {
    log('[toggleReady] Toggle ready request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
    });

    const player = await ctx.db
        .query('players')
        .withIndex('by_room_and_session', (q: any) =>
            q.eq('roomId', args.roomId).eq('sessionId', args.sessionId)
        )
        .first();

    if (!player) {
        log('[toggleReady] Error: Player not found', {
            roomId: args.roomId,
            sessionId: args.sessionId,
        });
        return { error: 'Player not found' };
    }

    const newReadyState = !player.isReady;
    await ctx.db.patch(player._id, { isReady: newReadyState });
    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

    log('[toggleReady] Ready status toggled', {
        playerId: player._id,
        playerName: player.name,
        oldReady: player.isReady,
        newReady: newReadyState,
    });

    return { isReady: newReadyState };
}

export async function updatePlayerHandler(ctx: any, args: any) {
    log('[updatePlayer] Update player request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
        updates: { name: args.name, color: args.color },
    });

    const player = await ctx.db
        .query('players')
        .withIndex('by_room_and_session', (q: any) =>
            q.eq('roomId', args.roomId).eq('sessionId', args.sessionId)
        )
        .first();

    if (!player) {
        log('[updatePlayer] Error: Player not found', {
            roomId: args.roomId,
            sessionId: args.sessionId,
        });
        return { error: 'Player not found' };
    }

    const updates: { name?: string; color?: string } = {};
    if (args.name) updates.name = args.name;
    if (args.color) {
        const players = await ctx.db
            .query('players')
            .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
            .collect();

        const colorInUse = players.some(
            (entry: any) => entry._id !== player._id && entry.color === args.color
        );

        if (colorInUse) {
            log('[updatePlayer] Error: Color already in use', {
                requestedColor: args.color,
                playerId: player._id,
            });
            return { error: 'Color already in use' };
        }
        updates.color = args.color;
    }

    await ctx.db.patch(player._id, updates);
    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

    log('[updatePlayer] Player updated successfully', { playerId: player._id, updates });
    return { success: true };
}
