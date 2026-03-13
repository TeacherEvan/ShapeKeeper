export async function updateGridSizeHandler(ctx: any, args: any) {
    console.log('[updateGridSize] Update grid size request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
        newGridSize: args.gridSize,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        console.log('[updateGridSize] Error: Room not found', { roomId: args.roomId });
        return { error: 'Room not found' };
    }

    if (room.hostPlayerId !== args.sessionId) {
        console.log('[updateGridSize] Error: Not host', {
            requestingSession: args.sessionId,
            hostSession: room.hostPlayerId,
        });
        return { error: 'Only the host can change grid size' };
    }

    if (room.status !== 'lobby') {
        console.log('[updateGridSize] Error: Game in progress', {
            roomId: args.roomId,
            status: room.status,
        });
        return { error: 'Cannot change grid size while game is in progress' };
    }

    await ctx.db.patch(args.roomId, {
        gridSize: args.gridSize,
        updatedAt: Date.now(),
    });

    console.log('[updateGridSize] Grid size updated', {
        roomId: args.roomId,
        oldGridSize: room.gridSize,
        newGridSize: args.gridSize,
    });

    return { success: true };
}

export async function updatePartyModeHandler(ctx: any, args: any) {
    console.log('[updatePartyMode] Update party mode request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
        newPartyMode: args.partyMode,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        console.log('[updatePartyMode] Error: Room not found', { roomId: args.roomId });
        return { error: 'Room not found' };
    }

    if (room.hostPlayerId !== args.sessionId) {
        console.log('[updatePartyMode] Error: Not host', {
            requestingSession: args.sessionId,
            hostSession: room.hostPlayerId,
        });
        return { error: 'Only the host can change party mode' };
    }

    if (room.status !== 'lobby') {
        console.log('[updatePartyMode] Error: Game in progress', {
            roomId: args.roomId,
            status: room.status,
        });
        return { error: 'Cannot change party mode while game is in progress' };
    }

    await ctx.db.patch(args.roomId, {
        partyMode: args.partyMode,
        updatedAt: Date.now(),
    });

    console.log('[updatePartyMode] Party mode updated', {
        roomId: args.roomId,
        oldPartyMode: room.partyMode,
        newPartyMode: args.partyMode,
    });

    return { success: true };
}

export async function startGameHandler(ctx: any, args: any) {
    console.log('[startGame] Start game request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        console.log('[startGame] Error: Room not found', { roomId: args.roomId });
        return { error: 'Room not found' };
    }

    if (room.hostPlayerId !== args.sessionId) {
        console.log('[startGame] Error: Not host', {
            requestingSession: args.sessionId,
            hostSession: room.hostPlayerId,
        });
        return { error: 'Only the host can start the game' };
    }

    if (room.status !== 'lobby') {
        console.log('[startGame] Error: Game already started', {
            roomId: args.roomId,
            status: room.status,
        });
        return { error: 'Game already started' };
    }

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    console.log('[startGame] Validating players', {
        roomId: args.roomId,
        playerCount: players.length,
        players: players.map((player: any) => ({
            name: player.name,
            isReady: player.isReady,
            sessionId: player.sessionId,
        })),
    });

    if (players.length < 2) {
        console.log('[startGame] Error: Not enough players', { playerCount: players.length });
        return { error: 'Need at least 2 players to start' };
    }

    const allReady = players.every(
        (player: any) => player.isReady || player.sessionId === room.hostPlayerId
    );
    if (!allReady) {
        console.log('[startGame] Error: Not all players ready', {
            notReady: players
                .filter((player: any) => !player.isReady && player.sessionId !== room.hostPlayerId)
                .map((player: any) => player.name),
        });
        return { error: 'All players must be ready' };
    }

    await ctx.db.patch(args.roomId, {
        status: 'playing',
        currentPlayerIndex: 0,
        updatedAt: Date.now(),
    });

    console.log('[startGame] Game started successfully', {
        roomId: args.roomId,
        playerCount: players.length,
        gridSize: room.gridSize,
        partyMode: room.partyMode,
    });

    return { success: true };
}
