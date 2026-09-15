import { v } from 'convex/values';
import { mutation } from '../_generated/server';

export const leaveRoom = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query('players')
      .withIndex('by_room_and_session', (q: any) => q.eq('roomId', args.roomId).eq('sessionId', args.sessionId))
      .first();

    if (!player) return { error: 'Player not found' };

    const room = await ctx.db.get(args.roomId);
    if (!room) return { error: 'Room not found' };

    if (room.status === 'playing') {
      await ctx.db.patch(player._id, { isConnected: false });
      return { success: true, disconnected: true };
    }

    await ctx.db.delete(player._id);

    const remainingPlayers = await ctx.db.query('players').withIndex('by_room', (q: any) => q.eq('roomId', args.roomId)).collect();

    if (remainingPlayers.length === 0) {
      await ctx.db.delete(args.roomId);
      return { success: true, roomDeleted: true };
    }

    if (room.hostPlayerId === args.sessionId) {
      const newHost = remainingPlayers[0];
      await ctx.db.patch(args.roomId, { hostPlayerId: newHost.sessionId, updatedAt: Date.now() });
    }

    for (let i = 0; i < remainingPlayers.length; i++) {
      await ctx.db.patch(remainingPlayers[i]._id, { playerIndex: i });
    }

    return { success: true };
  },
});
