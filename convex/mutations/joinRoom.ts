import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { DEFAULT_COLORS } from '../utils/roomUtils';

export const joinRoom = mutation({
  args: {
    roomCode: v.string(),
    sessionId: v.string(),
    playerName: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q: any) => q.eq('roomCode', args.roomCode.toUpperCase()))
      .first();

    if (!room) return { error: 'Room not found' };
    if (room.status !== 'lobby') return { error: 'Game already in progress' };

    const existingPlayer = await ctx.db
      .query('players')
      .withIndex('by_room_and_session', (q: any) => q.eq('roomId', room._id).eq('sessionId', args.sessionId))
      .first();

    if (existingPlayer) {
      await ctx.db.patch(existingPlayer._id, { isConnected: true, name: args.playerName });
      return { roomId: room._id, playerId: existingPlayer._id, rejoined: true };
    }

    const players = await ctx.db.query('players').withIndex('by_room', (q: any) => q.eq('roomId', room._id)).collect();

    if (players.length >= 6) return { error: 'Room is full (max 6 players)' };

    const usedColors = new Set(players.map((p: any) => p.color));
    const availableColor = DEFAULT_COLORS.find((c) => !usedColors.has(c)) || DEFAULT_COLORS[0];

    const playerId = await ctx.db.insert('players', {
      roomId: room._id,
      sessionId: args.sessionId,
      name: args.playerName,
      color: availableColor,
      score: 0,
      isReady: false,
      isConnected: true,
      playerIndex: players.length,
      joinedAt: Date.now(),
    });

    await ctx.db.patch(room._id, { updatedAt: Date.now() });
    return { roomId: room._id, playerId };
  },
});
