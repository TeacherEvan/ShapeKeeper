import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Constants for populate feature
// Must match frontend DotsAndBoxesGame.POPULATE_PLAYER_ID = 3
const POPULATE_PLAYER_ID = 3; // Display player ID for populate lines
const POPULATE_PLAYER_INDEX = 2; // Backend player index (0=Player1, 1=Player2, 2=Populate)

// Draw a line (make a move) - delegated to extracted module
export { drawLine } from './mutations/drawLine';

// Get game state (lines and squares)
export const getGameState = query({
    args: {
        roomId: v.id('rooms'),
    },
    handler: async (ctx, args) => {
        const room = await ctx.db.get(args.roomId);
        if (!room) {
            return null;
        }

        const players = await ctx.db
            .query('players')
            .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
            .collect();

        const lines = await ctx.db
            .query('lines')
            .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
            .collect();

        const squares = await ctx.db
            .query('squares')
            .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
            .collect();

        return {
            room,
            players: players.sort((a, b) => a.playerIndex - b.playerIndex),
            lines,
            squares,
        };
    },
});

// Reveal a multiplier (apply score bonus)
export const revealMultiplier = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        squareKey: v.string(),
    },
    handler: async (ctx, args) => {
        console.log('[revealMultiplier] Reveal request', {
            roomId: args.roomId,
            sessionId: args.sessionId,
            squareKey: args.squareKey,
        });

        const square = await ctx.db
            .query('squares')
            .withIndex('by_room_and_key', (q) =>
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

        // Apply multiplier to score
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
    },
});

// End game early (host only, or by vote)
export const endGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: async (ctx, args) => {
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
    },
});

// Reset game (go back to lobby)
export const resetGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: async (ctx, args) => {
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

        // Delete all lines
        const lines = await ctx.db
            .query('lines')
            .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
            .collect();
        for (const line of lines) {
            await ctx.db.delete(line._id);
        }
        console.log('[resetGame] Lines deleted', { count: lines.length });

        // Delete all squares
        const squares = await ctx.db
            .query('squares')
            .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
            .collect();
        for (const square of squares) {
            await ctx.db.delete(square._id);
        }
        console.log('[resetGame] Squares deleted', { count: squares.length });

        // Reset player scores and ready status
        const players = await ctx.db
            .query('players')
            .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
            .collect();
        for (const player of players) {
            await ctx.db.patch(player._id, { score: 0, isReady: false });
        }
        console.log('[resetGame] Player scores reset', { playerCount: players.length });

        // Reset room status
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
    },
});

/**
 * Populate lines (host only) - adds safe lines that don't complete squares
 * This feature allows the host to add random "safe" lines to prevent stalemates
 * Safe lines are those that won't immediately complete any square
 *
 * @mutation populateLines
 * @permission host-only (validated server-side)
 * @returns {success: boolean, linesPopulated: number} | {error: string}
 */
export const populateLines = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        lineKeys: v.array(v.string()), // Array of normalized line keys (e.g., ["1,2-1,3", "2,3-3,3"])
    },
    handler: async (ctx, args) => {
        console.log('[populateLines] Populate request', {
            roomId: args.roomId,
            sessionId: args.sessionId,
            lineCount: args.lineKeys.length,
        });

        // Validate room exists and is in playing state
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

        // Server-side authorization: Only host can populate lines
        if (room.hostPlayerId !== args.sessionId) {
            console.log('[populateLines] Error: Not host', {
                requestingSession: args.sessionId,
                hostSession: room.hostPlayerId,
            });
            return { error: 'Only the host can populate lines' };
        }

        // Get the host player document to use their _id for the lines
        const hostPlayer = await ctx.db
            .query('players')
            .withIndex('by_room_and_session', (q) =>
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

        // Insert all the requested lines into the database
        for (const lineKey of args.lineKeys) {
            // Check if line already exists to prevent duplicates
            const existingLine = await ctx.db
                .query('lines')
                .withIndex('by_room_and_key', (q) =>
                    q.eq('roomId', args.roomId).eq('lineKey', lineKey)
                )
                .first();

            if (!existingLine) {
                await ctx.db.insert('lines', {
                    roomId: args.roomId,
                    lineKey,
                    playerId: hostPlayer._id,
                    playerIndex: POPULATE_PLAYER_INDEX,
                    createdAt: Date.now(),
                });
                insertedCount++;
            } else {
                skippedCount++;
            }
        }

        console.log('[populateLines] Line insertion complete', {
            requestedLines: args.lineKeys.length,
            inserted: insertedCount,
            skipped: skippedCount,
        });

        // Update room timestamp to trigger subscription updates
        await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

        console.log('[populateLines] Populate complete', { linesPopulated: insertedCount });

        return {
            success: true,
            linesPopulated: insertedCount,
        };
    },
});
