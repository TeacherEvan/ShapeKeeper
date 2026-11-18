import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { armTurnTimer } from '../games/turnTimer';
import { getHostTokenHash } from '../utils/roomUtils';

// Start the game (host only). Arms the first turn's countdown via armTurnTimer.
export const startGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
        hostToken: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const room = await ctx.db.get(args.roomId);
        if (!room) return { error: 'Room not found' };
        if (room.hostPlayerId !== args.sessionId) return { error: 'Only the host can start the game' };

        if (room.hostTokenHash) {
            if (!args.hostToken) return { error: 'Host token required' };
            const providedHash = await getHostTokenHash(args.hostToken);
            if (providedHash !== room.hostTokenHash) return { error: 'Invalid host token' };
        }

        if (room.status !== 'lobby') return { error: 'Game already started' };

        const players = await ctx.db.query('players').withIndex('by_room', (q: any) => q.eq('roomId', args.roomId)).collect();

        if (players.length < 2) return { error: 'Need at least 2 players to start' };

        const allReady = players.every((p: any) => p.isReady || p.sessionId === room.hostPlayerId);
        if (!allReady) return { error: 'All players must be ready' };

        const startedAt = Date.now();
        await armTurnTimer(ctx, args.roomId, room, startedAt, {
            status: 'playing',
            currentPlayerIndex: 0,
            updatedAt: startedAt,
        });

        return { success: true };
    },
});
