import { checkForCompletedSquares } from './squares';
import { validateLineKey } from './line_validation';
import { isTurnExpired } from './turn_deadline';
import { computeTurnEndTime, resolveTurnDurationMs } from './turn_duration';
import { armTurnTimer } from './turnTimer';
import { getAllLineKeys, pickRandomFreeLine } from './shared';
import { log, errorLog, warn } from '../log';
import { checkRateLimit } from '../rateLimit';

export async function applyLineForPlayer(
    ctx: any,
    room: any,
    currentPlayer: any,
    sortedPlayers: any[],
    lineKey: string,
    clientSentAt?: number
) {
    await ctx.db.insert('lines', {
        roomId: room._id,
        lineKey,
        playerId: currentPlayer._id,
        playerIndex: currentPlayer.playerIndex,
        createdAt: Date.now(),
    });

    log('[applyLineForPlayer] Line drawn successfully', {
        roomId: room._id,
        lineKey,
        playerId: currentPlayer._id,
        playerIndex: currentPlayer.playerIndex,
    });

    const completedSquares = await checkForCompletedSquares(
        ctx,
        room._id,
        lineKey,
        currentPlayer._id,
        currentPlayer.playerIndex,
        room.gridSize
    );

    log('[applyLineForPlayer] Square check complete', {
        lineKey,
        completedSquares: completedSquares.length,
        squareKeys: completedSquares,
    });

    if (completedSquares.length > 0) {
        const newScore = currentPlayer.score + completedSquares.length;
        await ctx.db.patch(currentPlayer._id, { score: newScore });
        currentPlayer.score = newScore;
        log('[applyLineForPlayer] Score updated', {
            playerId: currentPlayer._id,
            oldScore: currentPlayer.score - completedSquares.length,
            newScore,
        });
    }

    const totalSquares = (room.gridSize - 1) * (room.gridSize - 1);
    const allSquares = await ctx.db
        .query('squares')
        .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
        .collect();

    const isGameOver = allSquares.length >= totalSquares;

    log('[applyLineForPlayer] Game progress', {
        completedSquares: allSquares.length,
        totalSquares,
        isGameOver,
    });

    if (isGameOver) {
        await ctx.db.patch(room._id, {
            status: 'finished',
            updatedAt: Date.now(),
        });
        log('[applyLineForPlayer] Game over', {
            roomId: room._id,
            finalScores: sortedPlayers.map((player: any) => ({
                name: player.name,
                score: player.score,
            })),
        });
        return {
            success: true,
            completedSquares: completedSquares.length,
            gameOver: true,
            lineKey,
        };
    }

    const serverReceivedAt = Date.now();
    const timingPatch: any = {
        lastTurnClientSentAt: clientSentAt ?? null,
        lastTurnServerReceivedAt: serverReceivedAt,
        updatedAt: serverReceivedAt,
    };

    const nextIndex =
        completedSquares.length === 0
            ? (room.currentPlayerIndex + 1) % sortedPlayers.length
            : room.currentPlayerIndex;

    await armTurnTimer(ctx, room._id, room, serverReceivedAt, {
        ...timingPatch,
        currentPlayerIndex: nextIndex,
    });

    if (completedSquares.length === 0) {
        log('[applyLineForPlayer] Turn advanced', {
            fromPlayerIndex: room.currentPlayerIndex,
            toPlayerIndex: nextIndex,
            nextPlayerName: sortedPlayers[nextIndex]?.name,
        });
    } else {
        log('[applyLineForPlayer] Turn retained (shape completed)', {
            playerIndex: currentPlayer.playerIndex,
            playerName: currentPlayer.name,
        });
    }

    return {
        success: true,
        completedSquares: completedSquares.length,
        keepTurn: completedSquares.length > 0,
        lineKey,
    };
}

export async function drawLineHandler(ctx: any, args: any) {
    // N9 per-session rate limit. Keyed by sessionId so a hostile client
    // cannot evade by joining a new room. Cap is 10/sec, plenty for
    // human play; see convex/rateLimit.js for the policy.
    const rl = await checkRateLimit(ctx, 'drawLine', args.sessionId);
    if (!rl.allowed) {
        return { error: 'Rate limit exceeded', resetMs: rl.resetMs };
    }

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

    // Authoritative server-side turn deadline. The browser renders the
    // countdown, but a hostile client could bypass that and call this
    // mutation directly; the server must enforce the window itself.
    //
    // Allowed Time feature: when the timer has run out, the server SKIPS
    // the timed-out player (advances the turn, re-arms the clock) and
    // returns turnExpired:true — the late move is rejected, but the match
    // is never stalled by a frozen or hostile client. Skipping is only
    // possible when a time limit is configured (duration > 0).
    if (isTurnExpired(room)) {
        const turnDurationMs = resolveTurnDurationMs(room);
        if (turnDurationMs > 0) {
            const skipPlayers = await ctx.db
                .query('players')
                .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
                .collect();
            const sortedSkipPlayers = skipPlayers.sort(
                (a: any, b: any) => a.playerIndex - b.playerIndex
            );
            const timedOutPlayer = sortedSkipPlayers[room.currentPlayerIndex];
            if (timedOutPlayer) {
                const drawnLines = await ctx.db
                    .query('lines')
                    .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
                    .collect();
                const drawnKeys = new Set<string>(
                    drawnLines.map((l: any) => String(l.lineKey))
                );
                const allKeys = getAllLineKeys(room.gridSize);
                const autoLine = pickRandomFreeLine(allKeys, drawnKeys);
                if (autoLine) {
                    await applyLineForPlayer(
                        ctx,
                        room,
                        timedOutPlayer,
                        sortedSkipPlayers,
                        autoLine
                    );
                    warn('[drawLine] Turn expired — random auto-line drawn', {
                        roomId: args.roomId,
                        playerIndex: room.currentPlayerIndex,
                        autoLine,
                    });
                    return {
                        error: 'Turn deadline expired',
                        turnExpired: true,
                        autoMoveLineKey: autoLine,
                    };
                }
            }
        }
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
            q.eq('roomId', args.roomId).eq('lineKey', validatedLineKey)
        )
        .first();

    if (existingLine) {
        log('[drawLine] Error: Line already drawn', {
            lineKey: validatedLineKey,
            existingLineId: existingLine._id,
        });
        return { error: 'Line already drawn' };
    }

    return await applyLineForPlayer(
        ctx,
        room,
        currentPlayer,
        sortedPlayers,
        validatedLineKey,
        args.clientSentAt
    );
}
