import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { drawLineHandler } from './games/draw';
import { log, errorLog, warn } from './log';
import {
    endGameHandler,
    getGameStateHandler,
    populateLinesHandler,
    resetGameHandler,
    revealMultiplierHandler,
    tapSquareHandler,
} from './games/state';

// Draw a line (make a move) - delegated to extracted module
export { drawLine } from './mutations/drawLine';

// Get game state (lines and squares)
export const getGameState = query({
    args: {
        roomId: v.id('rooms'),
    },
    handler: getGameStateHandler,
});

// Reveal a multiplier (apply score bonus)
export const revealMultiplier = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        squareKey: v.string(),
    },
    handler: revealMultiplierHandler,
});

// End game early (host only). hostToken is the raw token returned by
// createRoom; the server hashes it and compares against room.hostTokenHash.
export const endGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
    },
    handler: endGameHandler,
});

// Reset game (go back to lobby). Host only.
export const resetGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
    },
    handler: resetGameHandler,
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
        hostToken: v.optional(v.string()),
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
