import { checkForCompletedSquares } from './squares';
import { validateLineKey } from './line-validation';
import { isTurnExpired } from './turn-deadline';
import { log, errorLog, warn } from '../log';

export async function drawLineHandler(ctx: any, args: any) {
    log('[drawLine] Line draw request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
        lineKey: args.lineKey,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        log('[drawLine] Error: Room not found', { roomId: args.roomId });
        return { error: 'Room not found' };
    }

    if (room.status !== 'playing') {
        log('[drawLine] Error: Game not in progress', {
            roomId: args.roomId,
            status: room.status,
        });
        return { error: 'Game not in progress' };
    }

    // Authoritative server-side turn deadline. The browser renders a 10s
    // countdown, but a hostile client could bypass that and call this
    // mutation directly; the server must enforce the window itself.
    if (isTurnExpired(room)) {
        log('[drawLine] Error: Turn deadline expired', {
            roomId: args.roomId,
            turnEndTime: room.turnEndTime,
        });
        return { error: 'Turn deadline expired' };
    }

    const validatedLineKey = validateLineKey(args.lineKey, room.gridSize);
    if (!validatedLineKey) {
        log('[drawLine] Error: Invalid line key', {
            roomId: args.roomId,
            lineKey: args.lineKey,
            gridSize: room.gridSize,
        });
        return { error: 'Invalid line' };
    }

    const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();

    const sortedPlayers = players.sort((a: any, b: any) => a.playerIndex - b.playerIndex);
    const currentPlayer = sortedPlayers[room.currentPlayerIndex];

    log('[drawLine] Turn validation', {
        currentPlayerIndex: room.currentPlayerIndex,
        currentPlayerSession: currentPlayer?.sessionId,
        requestingSession: args.sessionId,
        isValidTurn: currentPlayer?.sessionId === args.sessionId,
    });

    if (!currentPlayer || currentPlayer.sessionId !== args.sessionId) {
        log('[drawLine] Error: Not player turn', {
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
        log('[drawLine] Error: Line already drawn', {
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

    log('[drawLine] Line drawn successfully', {
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

    log('[drawLine] Square check complete', {
        lineKey: args.lineKey,
        completedSquares: completedSquares.length,
        squareKeys: completedSquares,
    });

    if (completedSquares.length > 0) {
        const newScore = currentPlayer.score + completedSquares.length;
        await ctx.db.patch(currentPlayer._id, { score: newScore });
        log('[drawLine] Score updated', {
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

    const isGameOver = allSquares.length >= totalSquares;

    log('[drawLine] Game progress', {
        completedSquares: allSquares.length,
        totalSquares,
        isGameOver,
    });

    if (isGameOver) {
        await ctx.db.patch(args.roomId, {
            status: 'finished',
            updatedAt: Date.now(),
        });
        log('[drawLine] Game over', {
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

    const serverReceivedAt = Date.now();
    // Record the client/server timestamps used for RTT + clock-offset smoothing
    // on the client (FR-2 / FR-3).
    const timingPatch: any = {
        lastTurnClientSentAt: args.clientSentAt ?? null,
        lastTurnServerReceivedAt: serverReceivedAt,
        updatedAt: serverReceivedAt,
    };

    if (completedSquares.length === 0) {
        const nextPlayerIndex = (room.currentPlayerIndex + 1) % sortedPlayers.length;
        // Re-arm the turn countdown for the next player (FR-2 / FR-3).
        timingPatch.currentPlayerIndex = nextPlayerIndex;
        timingPatch.turnStartTime = serverReceivedAt;
        timingPatch.turnEndTime = serverReceivedAt + 10000;
        await ctx.db.patch(args.roomId, timingPatch);
        log('[drawLine] Turn advanced', {
            fromPlayerIndex: room.currentPlayerIndex,
            toPlayerIndex: nextPlayerIndex,
            nextPlayerName: sortedPlayers[nextPlayerIndex]?.name,
        });
    } else {
        await ctx.db.patch(args.roomId, timingPatch);
        log('[drawLine] Turn retained (shape completed)', {
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
