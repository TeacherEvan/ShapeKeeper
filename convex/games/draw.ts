import { checkForCompletedSquares } from './squares';

export async function drawLineHandler(ctx: any, args: any) {
    console.log('[drawLine] Line draw request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
        lineKey: args.lineKey,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        console.log('[drawLine] Error: Room not found', { roomId: args.roomId });
        return { error: 'Room not found' };
    }

    if (room.status !== 'playing') {
        console.log('[drawLine] Error: Game not in progress', {
            roomId: args.roomId,
            status: room.status,
        });
        return { error: 'Game not in progress' };
    }

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    const sortedPlayers = players.sort((a: any, b: any) => a.playerIndex - b.playerIndex);
    const currentPlayer = sortedPlayers[room.currentPlayerIndex];

    console.log('[drawLine] Turn validation', {
        currentPlayerIndex: room.currentPlayerIndex,
        currentPlayerSession: currentPlayer?.sessionId,
        requestingSession: args.sessionId,
        isValidTurn: currentPlayer?.sessionId === args.sessionId,
    });

    if (!currentPlayer || currentPlayer.sessionId !== args.sessionId) {
        console.log('[drawLine] Error: Not player turn', {
            expectedSession: currentPlayer?.sessionId,
            receivedSession: args.sessionId,
        });
        return { error: 'Not your turn' };
    }

    const existingLine = await ctx.db
        .query('lines')
        .withIndex('by_room_and_key', (q: any) =>
            q.eq('roomId', args.roomId).eq('lineKey', args.lineKey)
        )
        .first();

    if (existingLine) {
        console.log('[drawLine] Error: Line already drawn', {
            lineKey: args.lineKey,
            existingLineId: existingLine._id,
        });
        return { error: 'Line already drawn' };
    }

    await ctx.db.insert('lines', {
        roomId: args.roomId,
        lineKey: args.lineKey,
        playerId: currentPlayer._id,
        playerIndex: currentPlayer.playerIndex,
        createdAt: Date.now(),
    });

    console.log('[drawLine] Line drawn successfully', {
        lineKey: args.lineKey,
        playerId: currentPlayer._id,
        playerIndex: currentPlayer.playerIndex,
    });

    const completedSquares = await checkForCompletedSquares(
        ctx,
        args.roomId,
        args.lineKey,
        currentPlayer._id,
        currentPlayer.playerIndex,
        room.gridSize
    );

    console.log('[drawLine] Square check complete', {
        lineKey: args.lineKey,
        completedSquares: completedSquares.length,
        squareKeys: completedSquares,
    });

    if (completedSquares.length > 0) {
        const newScore = currentPlayer.score + completedSquares.length;
        await ctx.db.patch(currentPlayer._id, { score: newScore });
        console.log('[drawLine] Score updated', {
            playerId: currentPlayer._id,
            oldScore: currentPlayer.score,
            newScore,
        });
    }

    const totalSquares = (room.gridSize - 1) * (room.gridSize - 1);
    const allSquares = await ctx.db
        .query('squares')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    console.log('[drawLine] Game progress', {
        completedSquares: allSquares.length,
        totalSquares,
        isGameOver: allSquares.length >= totalSquares,
    });

    if (allSquares.length >= totalSquares) {
        await ctx.db.patch(args.roomId, {
            status: 'finished',
            updatedAt: Date.now(),
        });
        console.log('[drawLine] Game over', {
            roomId: args.roomId,
            finalScores: sortedPlayers.map((player: any) => ({
                name: player.name,
                score: player.score,
            })),
        });
        return {
            success: true,
            completedSquares: completedSquares.length,
            gameOver: true,
        };
    }

    if (completedSquares.length === 0) {
        const nextPlayerIndex = (room.currentPlayerIndex + 1) % sortedPlayers.length;
        await ctx.db.patch(args.roomId, {
            currentPlayerIndex: nextPlayerIndex,
            updatedAt: Date.now(),
        });
        console.log('[drawLine] Turn advanced', {
            fromPlayerIndex: room.currentPlayerIndex,
            toPlayerIndex: nextPlayerIndex,
            nextPlayerName: sortedPlayers[nextPlayerIndex]?.name,
        });
    } else {
        await ctx.db.patch(args.roomId, { updatedAt: Date.now() });
        console.log('[drawLine] Turn retained (squares completed)', {
            playerIndex: currentPlayer.playerIndex,
            playerName: currentPlayer.name,
        });
    }

    return {
        success: true,
        completedSquares: completedSquares.length,
        keepTurn: completedSquares.length > 0,
    };
}
