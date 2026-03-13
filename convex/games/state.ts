import { POPULATE_PLAYER_INDEX } from './shared';

export async function getGameStateHandler(ctx: any, args: any) {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
        return null;
    }

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    const lines = await ctx.db
        .query('lines')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    const squares = await ctx.db
        .query('squares')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    return {
        room,
        players: players.sort((a: any, b: any) => a.playerIndex - b.playerIndex),
        lines,
        squares,
    };
}

export async function revealMultiplierHandler(ctx: any, args: any) {
    console.log('[revealMultiplier] Reveal request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
        squareKey: args.squareKey,
    });

    const square = await ctx.db
        .query('squares')
        .withIndex('by_room_and_key', (q: any) =>
            q.eq('roomId', args.roomId).eq('squareKey', args.squareKey)
        )
        .first();

    if (!square) {
        console.log('[revealMultiplier] Error: Square not found', {
            roomId: args.roomId,
            squareKey: args.squareKey,
        });
        return { error: 'Square not found' };
    }

    const player = await ctx.db.get(square.playerId);
    if (!player || player.sessionId !== args.sessionId) {
        console.log('[revealMultiplier] Error: Not player square', {
            squarePlayerId: square.playerId,
            squarePlayerSession: player?.sessionId,
            requestingSession: args.sessionId,
        });
        return { error: 'Not your square' };
    }

    if (!square.multiplier) {
        console.log('[revealMultiplier] Error: No multiplier', { squareKey: args.squareKey });
        return { error: 'No multiplier on this square' };
    }

    console.log('[revealMultiplier] Multiplier found', {
        squareKey: args.squareKey,
        multiplier: square.multiplier,
        currentScore: player.score,
    });

    if (square.multiplier.type === 'multiplier' && square.multiplier.value) {
        const bonus = square.multiplier.value;
        const newScore = player.score * bonus;
        await ctx.db.patch(player._id, { score: newScore });
        console.log('[revealMultiplier] Score multiplied', {
            playerId: player._id,
            oldScore: player.score,
            newScore,
            multiplier: bonus,
        });
    }

    return {
        success: true,
        multiplier: square.multiplier,
    };
}

export async function endGameHandler(ctx: any, args: any) {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
        return { error: 'Room not found' };
    }

    if (room.hostPlayerId !== args.sessionId) {
        return { error: 'Only the host can end the game' };
    }

    await ctx.db.patch(args.roomId, {
        status: 'finished',
        updatedAt: Date.now(),
    });

    return { success: true };
}

export async function resetGameHandler(ctx: any, args: any) {
    console.log('[resetGame] Reset request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        console.log('[resetGame] Error: Room not found', { roomId: args.roomId });
        return { error: 'Room not found' };
    }

    if (room.hostPlayerId !== args.sessionId) {
        console.log('[resetGame] Error: Not host', {
            requestingSession: args.sessionId,
            hostSession: room.hostPlayerId,
        });
        return { error: 'Only the host can reset the game' };
    }

    const lines = await ctx.db
        .query('lines')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();
    for (const line of lines) {
        await ctx.db.delete(line._id);
    }
    console.log('[resetGame] Lines deleted', { count: lines.length });

    const squares = await ctx.db
        .query('squares')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();
    for (const square of squares) {
        await ctx.db.delete(square._id);
    }
    console.log('[resetGame] Squares deleted', { count: squares.length });

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();
    for (const player of players) {
        await ctx.db.patch(player._id, { score: 0, isReady: false });
    }
    console.log('[resetGame] Player scores reset', { playerCount: players.length });

    await ctx.db.patch(args.roomId, {
        status: 'lobby',
        currentPlayerIndex: 0,
        updatedAt: Date.now(),
    });

    console.log('[resetGame] Game reset complete', {
        roomId: args.roomId,
        linesDeleted: lines.length,
        squaresDeleted: squares.length,
        playersReset: players.length,
    });

    return { success: true };
}

export async function populateLinesHandler(ctx: any, args: any) {
    console.log('[populateLines] Populate request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
        lineCount: args.lineKeys.length,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        console.log('[populateLines] Error: Room not found', { roomId: args.roomId });
        return { error: 'Room not found' };
    }

    if (room.status !== 'playing') {
        console.log('[populateLines] Error: Game not in progress', {
            roomId: args.roomId,
            status: room.status,
        });
        return { error: 'Game not in progress' };
    }

    if (room.hostPlayerId !== args.sessionId) {
        console.log('[populateLines] Error: Not host', {
            requestingSession: args.sessionId,
            hostSession: room.hostPlayerId,
        });
        return { error: 'Only the host can populate lines' };
    }

    const hostPlayer = await ctx.db
        .query('players')
        .withIndex('by_room_and_session', (q: any) =>
            q.eq('roomId', args.roomId).eq('sessionId', args.sessionId)
        )
        .first();

    if (!hostPlayer) {
        console.log('[populateLines] Error: Host player not found', {
            roomId: args.roomId,
            sessionId: args.sessionId,
        });
        return { error: 'Host player not found' };
    }

    console.log('[populateLines] Starting line insertion', {
        hostPlayerId: hostPlayer._id,
        linesToInsert: args.lineKeys.length,
    });

    let insertedCount = 0;
    let skippedCount = 0;

    for (const lineKey of args.lineKeys) {
        const existingLine = await ctx.db
            .query('lines')
            .withIndex('by_room_and_key', (q: any) =>
                q.eq('roomId', args.roomId).eq('lineKey', lineKey)
            )
            .first();

        if (existingLine) {
            skippedCount++;
            continue;
        }

        await ctx.db.insert('lines', {
            roomId: args.roomId,
            lineKey,
            playerId: hostPlayer._id,
            playerIndex: POPULATE_PLAYER_INDEX,
            createdAt: Date.now(),
        });
        insertedCount++;
    }

    console.log('[populateLines] Line insertion complete', {
        requestedLines: args.lineKeys.length,
        inserted: insertedCount,
        skipped: skippedCount,
    });

    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });
    console.log('[populateLines] Populate complete', { linesPopulated: insertedCount });

    return {
        success: true,
        linesPopulated: insertedCount,
    };
}
