import { v } from 'convex/values';
import { mutation } from '../_generated/server';

// Compute the turn-end epoch from the room's Allowed Time. Shared logic
// lives in games/turn_duration; this local mirror keeps the pure function
// testable and avoids a cross-module import cycle in the mutation bundle.
const DEFAULT_TURN_DURATION_SECONDS = 10;

function computeTurnEndTime(room: any, now: number): number | undefined {
    const seconds = room?.turnDurationSeconds;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
        // Legacy room: default 10s
        return now + DEFAULT_TURN_DURATION_SECONDS * 1000;
    }
    if (seconds <= 0) return undefined; // no limit
    return now + Math.round(seconds * 1000);
}

// Start the game (host only). Arms the first turn's countdown using the
// host-configured Allowed Time (unset legacy room = default 10s;
// explicit 0 = no limit, turnEndTime stays undefined).
export const startGame = mutation({
    args: {
        roomId: v.id('rooms'),
        sessionId: v.string(),
    },
    handler: async (ctx, args) => {
        const room = await ctx.db.get(args.roomId);
        if (!room) return { error: 'Room not found' };
        if (room.hostPlayerId !== args.sessionId) return { error: 'Only the host can start the game' };
        if (room.status !== 'lobby') return { error: 'Game already started' };

        const players = await ctx.db.query('players').withIndex('by_room', (q: any) => q.eq('roomId', args.roomId)).collect();

        if (players.length < 2) return { error: 'Need at least 2 players to start' };

        const allReady = players.every((p: any) => p.isReady || p.sessionId === room.hostPlayerId);
        if (!allReady) return { error: 'All players must be ready' };

        const startedAt = Date.now();
        await ctx.db.patch(args.roomId, {
            status: 'playing',
            currentPlayerIndex: 0,
            turnStartTime: startedAt,
            turnEndTime: computeTurnEndTime(room, startedAt),
            updatedAt: startedAt,
        });

        return { success: true };
    },
});
