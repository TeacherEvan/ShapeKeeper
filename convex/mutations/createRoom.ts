import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { DEFAULT_COLORS, generateRoomCode } from '../utils/roomUtils';

export const createRoom = mutation({
  args: {
    sessionId: v.string(),
    playerName: v.string(),
    gridSize: v.number(),
    partyMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Generate unique room code
    let roomCode = generateRoomCode();
    let existingRoom = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q: any) => q.eq('roomCode', roomCode))
      .first();

    let collisionCount = 0;
    while (existingRoom) {
      collisionCount++;
      roomCode = generateRoomCode();
      existingRoom = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q: any) => q.eq('roomCode', roomCode))
        .first();
    }

    const now = Date.now();

    const roomId = await ctx.db.insert('rooms', {
      roomCode,
      hostPlayerId: args.sessionId,
      gridSize: args.gridSize,
      partyMode: args.partyMode !== false,
      status: 'lobby',
      currentPlayerIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert('players', {
      roomId,
      sessionId: args.sessionId,
      name: args.playerName,
      color: DEFAULT_COLORS[0],
      score: 0,
      isReady: false,
      isConnected: true,
      playerIndex: 0,
      joinedAt: now,
    });

    return { roomId, roomCode };
  },
});
