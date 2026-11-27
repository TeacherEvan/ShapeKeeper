import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { cancelTurnTimer } from '../games/turnTimer';
import { log } from '../log';

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
      const lines = await ctx.db
        .query('lines')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();
      for (const line of lines) {
        await ctx.db.delete(line._id);
      }

      const squares = await ctx.db
        .query('squares')
        .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
        .collect();
      for (const square of squares) {
        await ctx.db.delete(square._id);
      }

      await cancelTurnTimer(ctx, room);
      await ctx.db.delete(args.roomId);
      return { success: true, roomDeleted: true };
    }

    remainingPlayers.sort(
      (a: any, b: any) =>
        (a.playerIndex ?? 0) - (b.playerIndex ?? 0) ||
        (a.joinedAt ?? 0) - (b.joinedAt ?? 0)
    );

    if (room.hostPlayerId === args.sessionId) {
      const newHost = remainingPlayers[0];
      log('[leaveRoom] Host transferred in lobby', {
        roomId: args.roomId,
        newHostIndex: newHost.playerIndex,
      });
      await ctx.db.patch(args.roomId, {
        hostPlayerId: newHost.sessionId,
        hostTokenHash: undefined,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(args.roomId, { updatedAt: Date.now() });
    }

    for (let i = 0; i < remainingPlayers.length; i++) {
      await ctx.db.patch(remainingPlayers[i]._id, { playerIndex: i });
    }

    return { success: true };
  },
});
