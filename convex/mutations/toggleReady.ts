import { v } from 'convex/values';
import { mutation } from '../_generated/server';

export const toggleReady = mutation({
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

    const newReadyState = !player.isReady;
    await ctx.db.patch(player._id, { isReady: newReadyState });
    await ctx.db.patch(args.roomId, { updatedAt: Date.now() });

    return { isReady: newReadyState };
  },
});
