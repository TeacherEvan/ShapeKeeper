import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { armTurnTimer } from '../games/turnTimer';

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

    await armTurnTimer(ctx, args.roomId, room, Date.now(), {
      status: 'playing',
      currentPlayerIndex: 0,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});