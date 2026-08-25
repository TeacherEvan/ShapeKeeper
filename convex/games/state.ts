import { POPULATE_PLAYER_INDEX } from './shared';

/**
 * The "effective multiplier" of a square — what the owner will actually
 * receive when they reveal it. The raw `multiplier` is the value the square
 * was born with (2x/3x/4x/5x/10x or truth-or-dare). The opponent-tap mechanic
 * reduces it: after at least one opponent tap, any multiplier square collapses
 * to 0.5x. truthOrDare is immune (different mechanic).
 *
 * Pure function — no DB access — so it can be unit-tested in isolation.
 *
 * @param {any} multiplier
 * @param {number | undefined} taps
 * @returns {any}
 */
export function computeEffectiveMultiplier(multiplier: any, taps?: number): any {
    if (!multiplier) return multiplier;
    if (multiplier.type === 'truthOrDare') return multiplier;
    if ((taps ?? 0) > 0) return { type: 'multiplier', value: 0.5 };
    return multiplier;
}

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
        // Use the EFFECTIVE multiplier (post-tap), not the raw one. A square
        // that was born 2x but got tapped by an opponent is 0.5x when the
        // owner reveals it.
        const effective = square.effectiveMultiplier ?? square.multiplier;
        const bonus = effective.value;
        const newScore = player.score + (bonus - 1);
        await ctx.db.patch(player._id, { score: newScore });
        console.log('[revealMultiplier] Score updated with bonus', {
            playerId: player._id,
            oldScore: player.score,
            newScore,
            bonus: bonus - 1,
            rawMultiplier: square.multiplier,
            effectiveMultiplier: effective,
            taps: square.taps ?? 0,
        });
    }

    return {
        success: true,
        multiplier: square.effectiveMultiplier ?? square.multiplier,
        taps: square.taps ?? 0,
    };
}

/**
 * Opponent-tap handler. Multiplayer-only: an opponent taps a completed square
 * to reduce its effective multiplier from the raw value (typically 2x) down to
 * 0.5x. Multiple taps are idempotent — the value is capped at 0.5x, it never
 * halves further. The mechanic creates a real-time race between the owner's
 * "reveal" and the opponent's "tap"; see `docs/feature-opponent-tap.md`.
 *
 * Validation:
 *   - Room must be in 'playing' state.
 *   - Square must exist.
 *   - Square must NOT be revealed yet (tapping a revealed square is meaningless).
 *   - Tapper must NOT be the square's owner (owners tap their own boxes via
 *     the existing reveal path, not this one).
 *   - truthOrDare squares are immune to taps.
 */
export async function tapSquareHandler(ctx: any, args: any) {
    console.log('[tapSquare] Tap request', {
        roomId: args.roomId,
        sessionId: args.sessionId,
        squareKey: args.squareKey,
    });

    const room = await ctx.db.get(args.roomId);
    if (!room) {
        return { error: 'Room not found' };
    }
    if (room.status !== 'playing') {
        return { error: 'Game is not in progress' };
    }

    const square = await ctx.db
        .query('squares')
        .withIndex('by_room_and_key', (q: any) =>
            q.eq('roomId', args.roomId).eq('squareKey', args.squareKey)
        )
        .first();

    if (!square) {
        return { error: 'Square not found' };
    }

    const ownerPlayer = await ctx.db.get(square.playerId);
    if (!ownerPlayer) {
        return { error: 'Square owner not found' };
    }
    if (ownerPlayer.sessionId === args.sessionId) {
        return { error: 'You cannot tap your own square' };
    }

    if (square.multiplier && square.multiplier.type === 'truthOrDare') {
        return { error: 'Truth-or-dare squares cannot be tapped' };
    }

    const nextTaps = (square.taps ?? 0) + 1;
    const nextEffective = computeEffectiveMultiplier(square.multiplier, nextTaps);

    await ctx.db.patch(square._id, {
        taps: nextTaps,
        effectiveMultiplier: nextEffective,
    });

    console.log('[tapSquare] Tap recorded', {
        squareKey: args.squareKey,
        sessionId: args.sessionId,
        previousTaps: square.taps ?? 0,
        nextTaps,
        rawMultiplier: square.multiplier,
        effectiveMultiplier: nextEffective,
    });

    return {
        success: true,
        squareKey: args.squareKey,
        taps: nextTaps,
        effectiveMultiplier: nextEffective,
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
        turnStartTime: undefined,
        turnEndTime: undefined,
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
        turnStartTime: undefined,
        turnEndTime: undefined,
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
