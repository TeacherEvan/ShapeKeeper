import { v } from 'convex/values';
import { query } from '../_generated/server';

export const getRoomByCode = query({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q: any) => q.eq('roomCode', args.roomCode.toUpperCase()))
      .first();

    if (!room) return null;

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q: any) => q.eq('roomId', room._id))
      .collect();

    return { ...room, players: players.sort((a: any, b: any) => a.playerIndex - b.playerIndex) };
  },
});

export const getRoom = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q: any) => q.eq('roomId', args.roomId))
      .collect();

    return { ...room, players: players.sort((a: any, b: any) => a.playerIndex - b.playerIndex) };
  },
});
